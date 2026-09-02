import {
  collection,
  doc,
  firestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  FieldValue,
  Timestamp,
  type DocumentData,
  type Unsubscribe,
} from '@/services/firebase/firebase';
import {
  REQUIRED_DOCUMENT_TYPES,
  type DocumentState,
  type DriverApplication,
  type DriverDocumentMetadata,
} from '@pakyaw/shared/onboarding';
import type { DriverApplicationForm, DriverApplicationSnapshot } from '@/features/onboarding/types';
import {
  resolveCanonicalDriverAccount,
  type CanonicalDriverAccount,
  type DriverOnboardingProfile,
} from './driver-profile.service';

const EMPTY_DOCUMENTS: Record<string, DocumentState> = {};

function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

function firebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'unknown';
}

function logOnboardingStage(message: string): void {
  if (isDevelopmentBuild()) console.log(`[Driver Onboarding] ${message}`);
}

function logOnboardingFailure(stage: string, error: unknown): void {
  if (isDevelopmentBuild()) {
    console.error(`[Driver Onboarding] ${stage} failed: ${firebaseErrorCode(error)}`);
  }
}

export function logApplicationCreatePayload(payload: Record<string, unknown>): void {
  if (!isDevelopmentBuild()) return;

  const topLevelKeys = Object.keys(payload);
  const personalDetails = payload.personalDetails as Record<string, unknown> | undefined;
  const personalDetailsKeys = personalDetails ? Object.keys(personalDetails) : [];
  const vehicle = payload.vehicle as Record<string, unknown> | undefined;
  const vehicleKeys = vehicle ? Object.keys(vehicle) : [];
  const vehicleTypeId = vehicle?.vehicleTypeId;
  const vehicleTypeIdPresent = typeof vehicleTypeId === 'string' && vehicleTypeId.length > 0;
  const documents = payload.documents as Record<string, unknown> | undefined;
  const documentKeys = documents ? Object.keys(documents) : [];

  console.log(
    `[Driver Application Create]\ntopLevelKeys:\n  ${topLevelKeys.join('\n  ')}\n\npersonalDetailsKeys:\n  ${personalDetailsKeys.join('\n  ')}\n\nvehicleKeys:\n  ${vehicleKeys.join('\n  ')}\n\nvehicleTypeIdPresent: ${vehicleTypeIdPresent}\ndocumentKeys: [${documentKeys.join(', ')}]\nstatus: ${String(payload.status)}`,
  );
}

function documentState(value: unknown): DocumentState {
  return value === 'missing' || value === 'uploaded' || value === 'under_review'
    || value === 'approved' || value === 'rejected' || value === 'expired'
    ? value
    : 'missing';
}

function getDocumentMetadata(value: DocumentData): DriverDocumentMetadata {
  const metadata: { identificationNumber?: string; issuanceDate?: string; expiryDate?: string } = {};
  if (typeof value.identificationNumber === 'string' && value.identificationNumber.trim()) {
    metadata.identificationNumber = value.identificationNumber.trim();
  }
  if (typeof value.issuanceDate === 'string' && value.issuanceDate.trim()) {
    metadata.issuanceDate = value.issuanceDate.trim();
  }
  if (typeof value.expiryDate === 'string' && value.expiryDate.trim()) {
    metadata.expiryDate = value.expiryDate.trim();
  }
  return metadata;
}

function asApplication(uid: string, data: DocumentData, uploadedDocuments: Readonly<Record<string, DocumentData>> = {}): DriverApplicationSnapshot {
  const storedDocuments = data.documents as Record<string, unknown> | undefined;
  const documents = Object.fromEntries(Object.entries(storedDocuments ?? {}).map(([documentType, value]) => [
    documentType,
    documentState(value),
  ]));
  // Historical applications may not have a map entry for every legacy key.
  for (const documentType of REQUIRED_DOCUMENT_TYPES) {
    documents[documentType] ??= documentState(storedDocuments?.[documentType]);
  }
  for (const [documentType, document] of Object.entries(uploadedDocuments)) {
    documents[documentType] = documentState(document);
  }
  const documentMetadata = Object.fromEntries(
    Object.entries(uploadedDocuments)
      .map(([documentType, document]) => [documentType, getDocumentMetadata(document)] as const)
      .filter(([, metadata]) => Object.keys(metadata).length > 0),
  );
  return {
    ...(data as Omit<DriverApplication, 'id' | 'uid' | 'documents' | 'auditTrail'>),
    id: uid,
    uid,
    documents,
    documentMetadata,
    auditTrail: Array.isArray(data.auditTrail) ? data.auditTrail : [],
    correctionReason: typeof data.correctionReason === 'string' ? data.correctionReason : undefined,
    correctionDocumentTypes: Array.isArray(data.correctionDocumentTypes)
      ? data.correctionDocumentTypes.filter((value): value is string => typeof value === 'string')
      : undefined,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  if (value instanceof Date) return false;
  if (typeof Timestamp !== 'undefined' && typeof Timestamp === 'function' && value instanceof Timestamp) return false;
  if (typeof FieldValue !== 'undefined' && typeof FieldValue === 'function' && value instanceof FieldValue) return false;
  if ('_methodName' in value || '_elements' in value || '_type' in value) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function assertNoUndefinedProperties(value: unknown, path = ''): void {
  if (value === undefined) {
    throw new Error(`Found undefined at ${path || 'root'}`);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const currentPath = path ? `${path}[${i}]` : `[${i}]`;
      const prop = value[i];
      if (prop === undefined) {
        throw new Error(`Found undefined at ${currentPath}`);
      }
      if (isPlainObject(prop) || Array.isArray(prop)) {
        assertNoUndefinedProperties(prop, currentPath);
      }
    }
  } else if (isPlainObject(value)) {
    for (const [key, prop] of Object.entries(value)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (prop === undefined) {
        throw new Error(`Found undefined at ${currentPath}`);
      }
      if (isPlainObject(prop) || Array.isArray(prop)) {
        assertNoUndefinedProperties(prop, currentPath);
      }
    }
  }
}

export function buildDriverApplicationCreatePayload(
  uid: string,
  form: DriverApplicationForm,
  requirementKeys: readonly string[] = REQUIRED_DOCUMENT_TYPES,
  canonicalProfile?: { readonly name: string; readonly mobile: string } | null,
): Record<string, unknown> {
  const documents = Object.fromEntries(requirementKeys.map((key) => [key, 'missing' as const]));

  const fullLegalName = (canonicalProfile?.name ?? form.personalDetails?.fullLegalName ?? '').trim();
  const verifiedMobile = (canonicalProfile?.mobile ?? form.personalDetails?.verifiedMobile ?? '').trim();

  const personalDetails: Record<string, unknown> = {
    fullLegalName,
    verifiedMobile,
    barangayAddress: form.personalDetails?.barangayAddress ?? '',
    emergencyContact: {
      name: form.personalDetails?.emergencyContact?.name ?? '',
      mobile: form.personalDetails?.emergencyContact?.mobile ?? '',
    },
  };

  if (typeof form.personalDetails?.firstName === 'string' && form.personalDetails.firstName.trim().length > 0) {
    personalDetails.firstName = form.personalDetails.firstName.trim();
  }
  if (typeof form.personalDetails?.middleName === 'string' && form.personalDetails.middleName.trim().length > 0) {
    personalDetails.middleName = form.personalDetails.middleName.trim();
  }
  if (typeof form.personalDetails?.lastName === 'string' && form.personalDetails.lastName.trim().length > 0) {
    personalDetails.lastName = form.personalDetails.lastName.trim();
  }
  if (typeof form.personalDetails?.suffix === 'string' && form.personalDetails.suffix.trim().length > 0) {
    personalDetails.suffix = form.personalDetails.suffix.trim();
  }

  const vehicle: Record<string, unknown> = {
    plateNumber: form.vehicle?.plateNumber ?? '',
    unitBodyNumber: form.vehicle?.unitBodyNumber ?? '',
    description: form.vehicle?.description ?? '',
    ownerOperatorInfo: form.vehicle?.ownerOperatorInfo ?? '',
    isDriverOwner: typeof form.vehicle?.isDriverOwner === 'boolean' ? form.vehicle.isDriverOwner : true,
    orcrNumber: form.vehicle?.orcrNumber ?? '',
    orcrExpiry: form.vehicle?.orcrExpiry ?? '',
  };
  if (typeof form.vehicle?.vehicleTypeId === 'string' && form.vehicle.vehicleTypeId.trim().length > 0) {
    vehicle.vehicleTypeId = form.vehicle.vehicleTypeId.trim();
  }

  const license: Record<string, unknown> = {
    number: form.license?.number ?? '',
    expiry: form.license?.expiry ?? '',
  };

  const franchise: Record<string, unknown> = {
    documentType: form.franchise?.documentType ?? 'franchise',
    documentNumber: form.franchise?.documentNumber ?? '',
    expiry: form.franchise?.expiry ?? '',
  };

  const payload: Record<string, unknown> = {
    uid,
    status: 'draft',
    personalDetails,
    vehicle,
    license,
    franchise,
    documents: Object.keys(documents).length > 0 ? documents : EMPTY_DOCUMENTS,
    auditTrail: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  assertNoUndefinedProperties(payload);
  return payload;
}

export function buildDriverApplicationDraftPatch(
  form: DriverApplicationForm,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (form.personalDetails) {
    if (form.personalDetails.fullLegalName !== undefined) {
      patch['personalDetails.fullLegalName'] = form.personalDetails.fullLegalName;
    }
    if (form.personalDetails.verifiedMobile !== undefined) {
      patch['personalDetails.verifiedMobile'] = form.personalDetails.verifiedMobile;
    }
    if (form.personalDetails.barangayAddress !== undefined) {
      patch['personalDetails.barangayAddress'] = form.personalDetails.barangayAddress;
    }
    if (typeof form.personalDetails.firstName === 'string' && form.personalDetails.firstName.trim().length > 0) {
      patch['personalDetails.firstName'] = form.personalDetails.firstName.trim();
    }
    if (typeof form.personalDetails.middleName === 'string' && form.personalDetails.middleName.trim().length > 0) {
      patch['personalDetails.middleName'] = form.personalDetails.middleName.trim();
    }
    if (typeof form.personalDetails.lastName === 'string' && form.personalDetails.lastName.trim().length > 0) {
      patch['personalDetails.lastName'] = form.personalDetails.lastName.trim();
    }
    if (typeof form.personalDetails.suffix === 'string' && form.personalDetails.suffix.trim().length > 0) {
      patch['personalDetails.suffix'] = form.personalDetails.suffix.trim();
    }
    if (form.personalDetails.emergencyContact) {
      if (form.personalDetails.emergencyContact.name !== undefined) {
        patch['personalDetails.emergencyContact.name'] = form.personalDetails.emergencyContact.name;
      }
      if (form.personalDetails.emergencyContact.mobile !== undefined) {
        patch['personalDetails.emergencyContact.mobile'] = form.personalDetails.emergencyContact.mobile;
      }
    }
  }

  if (form.vehicle) {
    if (typeof form.vehicle.vehicleTypeId === 'string' && form.vehicle.vehicleTypeId.trim().length > 0) {
      patch['vehicle.vehicleTypeId'] = form.vehicle.vehicleTypeId.trim();
    }
    if (form.vehicle.plateNumber !== undefined) {
      patch['vehicle.plateNumber'] = form.vehicle.plateNumber;
    }
    if (form.vehicle.unitBodyNumber !== undefined) {
      patch['vehicle.unitBodyNumber'] = form.vehicle.unitBodyNumber;
    }
    if (form.vehicle.description !== undefined) {
      patch['vehicle.description'] = form.vehicle.description;
    }
    if (form.vehicle.ownerOperatorInfo !== undefined) {
      patch['vehicle.ownerOperatorInfo'] = form.vehicle.ownerOperatorInfo;
    }
    if (typeof form.vehicle.isDriverOwner === 'boolean') {
      patch['vehicle.isDriverOwner'] = form.vehicle.isDriverOwner;
    }
    if (form.vehicle.orcrNumber !== undefined) {
      patch['vehicle.orcrNumber'] = form.vehicle.orcrNumber;
    }
    if (form.vehicle.orcrExpiry !== undefined) {
      patch['vehicle.orcrExpiry'] = form.vehicle.orcrExpiry;
    }
  }

  if (form.license) {
    if (form.license.number !== undefined) {
      patch['license.number'] = form.license.number;
    }
    if (form.license.expiry !== undefined) {
      patch['license.expiry'] = form.license.expiry;
    }
  }

  if (form.franchise) {
    if (form.franchise.documentType !== undefined) {
      patch['franchise.documentType'] = form.franchise.documentType;
    }
    if (form.franchise.documentNumber !== undefined) {
      patch['franchise.documentNumber'] = form.franchise.documentNumber;
    }
    if (form.franchise.expiry !== undefined) {
      patch['franchise.expiry'] = form.franchise.expiry;
    }
  }

  assertNoUndefinedProperties(patch);
  return patch;
}

export async function createDriverApplicationDraft(
  uid: string,
  form: DriverApplicationForm,
  requirementKeys: readonly string[] = REQUIRED_DOCUMENT_TYPES,
  canonicalProfileOverride?: CanonicalDriverAccount | DriverOnboardingProfile | null,
): Promise<void> {
  // 1. Explicit Account Readiness Preflight (direct read to ensure fresh, authoritative user document)
  let canonicalProfile = canonicalProfileOverride;
  if (!canonicalProfile) {
    try {
      canonicalProfile = await resolveCanonicalDriverAccount(uid);
    } catch (error) {
      if (isDevelopmentBuild()) {
        console.warn('[Driver Onboarding] account identity not ready');
      }
      throw error;
    }
  }

  const payload = buildDriverApplicationCreatePayload(uid, form, requirementKeys, canonicalProfile);

  // 2. Safe identity diagnostics (booleans only in DEV)
  if (isDevelopmentBuild()) {
    const userExists = Boolean(canonicalProfile);
    const driverRole = 'role' in canonicalProfile ? canonicalProfile.role === 'driver' : true;
    const accountActive = 'accountStatus' in canonicalProfile ? canonicalProfile.accountStatus === 'active' : true;
    const payloadPersonal = payload.personalDetails as Record<string, unknown> | undefined;
    const fullLegalNameMatches = payloadPersonal?.fullLegalName === canonicalProfile.name.trim();
    const verifiedMobileMatches = payloadPersonal?.verifiedMobile === canonicalProfile.mobile.trim();
    const vehicle = payload.vehicle as Record<string, unknown> | undefined;
    const vehicleTypeValid = typeof vehicle?.vehicleTypeId === 'string' && vehicle.vehicleTypeId.trim().length > 0;

    console.log(
      `[Driver Application Identity Preflight]\nuserExists=${userExists}\ndriverRole=${driverRole}\naccountActive=${accountActive}\nfullLegalNameMatches=${fullLegalNameMatches}\nverifiedMobileMatches=${verifiedMobileMatches}\nvehicleTypeValid=${vehicleTypeValid}`,
    );
  }

  logApplicationCreatePayload(payload);
  logOnboardingStage('creating driverApplications/{uid}');
  try {
    await setDoc(doc(firestore, 'driverApplications', uid), payload);
  } catch (error) {
    logOnboardingFailure('driverApplications/{uid} create', error);
    throw error;
  }
  logOnboardingStage('driverApplications/{uid} created');
}

export async function saveDriverApplicationDraft(
  uid: string,
  form: DriverApplicationForm,
): Promise<void> {
  const patch = buildDriverApplicationDraftPatch(form);
  logOnboardingStage('updating driverApplications/{uid}');
  try {
    await updateDoc(doc(firestore, 'driverApplications', uid), patch);
  } catch (error) {
    logOnboardingFailure('driverApplications/{uid} update', error);
    throw error;
  }
  logOnboardingStage('driverApplications/{uid} updated');
}

export async function submitDriverApplication(uid: string): Promise<void> {
  await updateDoc(doc(firestore, 'driverApplications', uid), {
    status: 'submitted',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markDocumentUploaded(
  uid: string,
  documentType: string,
): Promise<void> {
  await updateDoc(doc(firestore, 'driverApplications', uid), {
    [`documents.${documentType}`]: 'uploaded',
    updatedAt: serverTimestamp(),
  });
}

export function subscribeDriverApplication(
  uid: string,
  onValue: (application: DriverApplicationSnapshot | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let applicationData: DocumentData | null = null;
  let uploadedDocuments: Record<string, DocumentData> = {};
  const emit = () => onValue(applicationData ? asApplication(uid, applicationData, uploadedDocuments) : null);
  const unsubscribeApplication = onSnapshot(doc(firestore, 'driverApplications', uid), (snapshot) => {
    applicationData = snapshot.exists() ? snapshot.data() : null;
    emit();
  }, onError);
  const unsubscribeDocuments = onSnapshot(collection(firestore, 'drivers', uid, 'driverDocuments'), (snapshot) => {
    uploadedDocuments = Object.fromEntries(snapshot.docs.map((document: any) => [document.id, document.data()]));
    emit();
  }, onError);
  return () => {
    unsubscribeApplication();
    unsubscribeDocuments();
  };
}
