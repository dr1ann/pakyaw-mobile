import {
  auth,
  collection,
  doc,
  firestore,
  getDoc,
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
  type DriverOnboardingCatalog,
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

export function asApplication(uid: string, data: DocumentData, uploadedDocuments: Readonly<Record<string, DocumentData>> = {}): DriverApplicationSnapshot {
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
  requirementKeys: readonly string[],
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
  requirementKeys: readonly string[],
  canonicalProfileOverride?: CanonicalDriverAccount | DriverOnboardingProfile | null,
  catalog?: DriverOnboardingCatalog | null,
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
    const vehicleType = catalog?.vehicleTypes.find((candidate) => candidate.id === vehicle?.vehicleTypeId);
    const vehicleTypeInCatalog = catalog === undefined ? 'unknown' : Boolean(vehicleType);
    const vehicleTypeActive = vehicleType === undefined ? 'unknown' : vehicleType.status === 'active';
    const authUidMatchesDriver = auth?.currentUser ? auth.currentUser.uid === uid : 'unknown';

    console.log(
      `[Driver Application Create Rule Diagnostics]\nauthUidMatchesDriver=${authUidMatchesDriver}\nuserExists=${userExists}\ndriverRole=${driverRole}\naccountActive=${accountActive}\nfullLegalNameMatches=${fullLegalNameMatches}\nverifiedMobileMatches=${verifiedMobileMatches}\nvehicleTypeValid=${vehicleTypeValid}\nvehicleTypeInCatalog=${vehicleTypeInCatalog}\nvehicleTypeActive=${vehicleTypeActive}`,
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
  try {
    await updateDoc(doc(firestore, 'driverApplications', uid), {
      status: 'submitted',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    const errorMsg = String(error?.message || '');
    const code = error?.code || (errorMsg.includes('permission-denied') ? 'permission-denied' : '');
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      try {
        const snap = await getDoc(doc(firestore, 'driverApplications', uid));
        if (snapshotExists(snap)) {
          const currentStatus = snapshotData(snap)?.status;
          if (currentStatus === 'submitted' || currentStatus === 'under_review' || currentStatus === 'approved') {
            logOnboardingStage('driverApplications/{uid} already in submitted state, resuming');
            return;
          }
        }
      } catch {
        // fall through
      }
    }
    throw error;
  }
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

const activeDocumentEmitters = new Map<string, (key: string, data: DocumentData) => void>();

export function notifyDocumentUploaded(uid: string, documentType: string, data: DocumentData): void {
  const notify = activeDocumentEmitters.get(uid);
  if (notify) {
    notify(documentType, data);
  }
}

export async function syncDriverDocuments(uid: string, requirementKeys: readonly string[]): Promise<void> {
  const notify = activeDocumentEmitters.get(uid);
  if (!notify || !requirementKeys.length) return;
  await Promise.all(
    requirementKeys.map(async (key) => {
      try {
        const snap = await getDoc(doc(firestore, 'drivers', uid, 'driverDocuments', key));
        if (snapshotExists(snap)) {
          const data = snapshotData(snap);
          if (data) notify(key, data);
        }
      } catch {
        // non-blocking
      }
    }),
  );
}

export function subscribeDriverApplication(
  uid: string,
  onValue: (application: DriverApplicationSnapshot | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let applicationData: DocumentData | null = null;
  let uploadedDocuments: Record<string, DocumentData> = {};
  const emit = () => onValue(applicationData ? asApplication(uid, applicationData, uploadedDocuments) : null);

  activeDocumentEmitters.set(uid, (key, data) => {
    uploadedDocuments[key] = data;
    emit();
  });

  const fetchKnownDocuments = async (knownKeys: string[]) => {
    if (!knownKeys.length) return;
    let hasChanges = false;
    await Promise.all(
      knownKeys.map(async (key) => {
        try {
          const snap = await getDoc(doc(firestore, 'drivers', uid, 'driverDocuments', key));
          if (snapshotExists(snap)) {
            const data = snapshotData(snap);
            if (data && uploadedDocuments[key] !== data) {
              uploadedDocuments[key] = data;
              hasChanges = true;
            }
          }
        } catch {
          // non-blocking
        }
      }),
    );
    if (hasChanges) {
      emit();
    }
  };

  const unsubscribeApplication = onSnapshot(doc(firestore, 'driverApplications', uid), (snapshot) => {
    applicationData = snapshot.exists() ? snapshot.data() : null;
    emit();
    if (applicationData) {
      const storedDocs = applicationData.documents as Record<string, unknown> | undefined;
      const keys = Array.from(
        new Set([...REQUIRED_DOCUMENT_TYPES, ...Object.keys(storedDocs ?? {})]),
      );
      fetchKnownDocuments(keys);
    }
  }, onError);

  const unsubscribeDocuments = onSnapshot(
    collection(firestore, 'drivers', uid, 'driverDocuments'),
    (snapshot) => {
      uploadedDocuments = Object.fromEntries(snapshot.docs.map((document: any) => [document.id, document.data()]));
      emit();
    },
    (_error) => {
      // Drivers cannot list the driverDocuments collection (allow list: if isReviewer()).
      // Do NOT forward this error to onError, which would destroy the entire application state!
      if (isDevelopmentBuild()) {
        console.warn('[Driver Onboarding] driverDocuments collection listing not permitted for driver; individual documents will be fetched directly.');
      }
    },
  );

  return () => {
    activeDocumentEmitters.delete(uid);
    unsubscribeApplication();
    unsubscribeDocuments();
  };
}

function snapshotExists(snapshot: any): boolean {
  if (!snapshot) return false;
  return typeof snapshot.exists === 'function' ? Boolean(snapshot.exists()) : Boolean(snapshot.exists);
}

function snapshotData(snapshot: any): DocumentData | null {
  if (!snapshot || !snapshotExists(snapshot)) return null;
  const value = typeof snapshot.data === 'function' ? snapshot.data() : snapshot.data;
  return value && typeof value === 'object' ? (value as DocumentData) : null;
}

export async function validateStep4Prerequisites(
  uid: string,
  form: DriverApplicationForm,
  catalog?: DriverOnboardingCatalog | null,
  canonicalProfileOverride?: CanonicalDriverAccount | DriverOnboardingProfile | null,
): Promise<{ readonly canonicalProfile: CanonicalDriverAccount | DriverOnboardingProfile }> {
  // 1. Account ready
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

  // 2. vehicleTypeId present
  const vehicleTypeId = form.vehicle?.vehicleTypeId?.trim();
  if (!vehicleTypeId) {
    throw new Error('Please select a vehicle type.');
  }

  // 3. VehicleType active
  if (catalog) {
    const vehicleType = catalog.vehicleTypes?.find((vt) => vt.id === vehicleTypeId);
    if (!vehicleType) {
      throw new Error('The selected vehicle type is not available. Please choose another.');
    }
    if (vehicleType.status !== 'active') {
      throw new Error('The selected vehicle type is currently inactive.');
    }
  }

  return { canonicalProfile };
}

export type EnsureDriverApplicationAction =
  | 'created_draft'
  | 'resumed_draft'
  | 'route_review'
  | 'needs_correction'
  | 'approved'
  | 'rejected';

export type EnsureDriverApplicationResult = {
  readonly status: string;
  readonly action: EnsureDriverApplicationAction;
  readonly application?: DriverApplicationSnapshot | null;
};

const inFlightEnsureByUid = new Map<string, Promise<EnsureDriverApplicationResult>>();

export function _resetInFlightEnsureTasks(): void {
  inFlightEnsureByUid.clear();
}

export async function ensureDriverApplicationDraft(
  uid: string,
  form: DriverApplicationForm,
  requirementKeys: readonly string[] = REQUIRED_DOCUMENT_TYPES,
  canonicalProfileOverride?: CanonicalDriverAccount | DriverOnboardingProfile | null,
  catalog?: DriverOnboardingCatalog | null,
): Promise<EnsureDriverApplicationResult> {
  const inFlight = inFlightEnsureByUid.get(uid);
  if (inFlight) {
    return inFlight;
  }

  const task = (async (): Promise<EnsureDriverApplicationResult> => {
    try {
      const appRef = doc(firestore, 'driverApplications', uid);
      const appSnap = await getDoc(appRef);

      if (snapshotExists(appSnap)) {
        const data = snapshotData(appSnap);
        const status = data?.status;

        if (status === 'draft') {
          await saveDriverApplicationDraft(uid, form);
          const app = asApplication(uid, { ...data, ...buildDriverApplicationDraftPatch(form) });
          return { status: 'draft', action: 'resumed_draft', application: app };
        }

        if (status === 'submitted' || status === 'under_review') {
          return { status, action: 'route_review', application: asApplication(uid, data ?? {}) };
        }

        if (status === 'needs_correction') {
          return { status: 'needs_correction', action: 'needs_correction', application: asApplication(uid, data ?? {}) };
        }

        if (status === 'approved') {
          return { status: 'approved', action: 'approved', application: asApplication(uid, data ?? {}) };
        }

        if (status === 'rejected') {
          return { status: 'rejected', action: 'rejected', application: asApplication(uid, data ?? {}) };
        }

        return { status: status ?? 'draft', action: 'resumed_draft', application: asApplication(uid, data ?? {}) };
      }

      // Absent -> attempt create
      try {
        await createDriverApplicationDraft(uid, form, requirementKeys, canonicalProfileOverride, catalog);
        return { status: 'draft', action: 'created_draft' };
      } catch (createError: any) {
        // Recovery fallback: if create returns permission-denied, immediately re-read driverApplications/{uid} once
        const code = createError?.code;
        if (code === 'permission-denied' || code === 'firestore/permission-denied') {
          const recoverySnap = await getDoc(appRef);
          if (snapshotExists(recoverySnap)) {
            const recoveryData = snapshotData(recoverySnap);
            if (recoveryData?.status === 'draft') {
              console.log('[Driver Onboarding] existing draft detected, resuming');
              await saveDriverApplicationDraft(uid, form);
              return {
                status: 'draft',
                action: 'resumed_draft',
                application: asApplication(uid, { ...recoveryData, ...buildDriverApplicationDraftPatch(form) }),
              };
            }
            if (recoveryData?.status === 'submitted' || recoveryData?.status === 'under_review') {
              return { status: recoveryData.status, action: 'route_review', application: asApplication(uid, recoveryData) };
            }
            if (recoveryData?.status === 'needs_correction') {
              return { status: 'needs_correction', action: 'needs_correction', application: asApplication(uid, recoveryData) };
            }
            if (recoveryData?.status === 'approved') {
              return { status: 'approved', action: 'approved', application: asApplication(uid, recoveryData) };
            }
            if (recoveryData?.status === 'rejected') {
              return { status: 'rejected', action: 'rejected', application: asApplication(uid, recoveryData) };
            }
          }
        }
        // If no application exists after re-read or error was not permission-denied, keep the failure blocking
        throw createError;
      }
    } finally {
      inFlightEnsureByUid.delete(uid);
    }
  })();

  inFlightEnsureByUid.set(uid, task);
  return task;
}
