import {
  auth,
  doc,
  firestore,
  getDoc,
  putFile,
  ref,
  serverTimestamp,
  setDoc,
  storage,
} from '@/services/firebase/firebase';
import type {
  DriverDocumentMetadata,
  DriverOnboardingCatalog,
  OnboardingDocumentRequirement,
} from '@pakyaw/shared/onboarding';
import { notifyDocumentUploaded } from '@/features/onboarding/services/driver-application.service';

export const MAX_DRIVER_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['application/pdf'] as const;
const VALID_REQUIREMENT_KEY = /^[a-z0-9_]{1,64}$/;

type RuleCheck = boolean | 'unknown';

export type DriverDocumentUploadRuleContext = {
  readonly catalog?: DriverOnboardingCatalog | null;
  readonly vehicleTypeId?: string | null;
};

export type PickedDriverDocument = {
  readonly uri: string;
  readonly name: string;
  readonly size: number | null;
  readonly mimeType: string | null;
};

export class DriverDocumentUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverDocumentUploadError';
  }
}

export function validatePickedDriverDocument(asset: PickedDriverDocument): string {
  const contentType = asset.mimeType ?? '';
  const allowed = contentType.startsWith('image/') || ALLOWED_CONTENT_TYPES.includes(contentType as 'application/pdf');
  if (!allowed) throw new DriverDocumentUploadError('Choose an image or PDF document.');
  if (asset.size === null || asset.size <= 0 || asset.size > MAX_DRIVER_DOCUMENT_BYTES) {
    throw new DriverDocumentUploadError('Choose a file smaller than 10 MB.');
  }
  return contentType;
}

export function getUriScheme(uri: string): string {
  const match = uri.match(/^([a-zA-Z0-9+.-]+):/);
  return match ? match[1] : 'unknown';
}

function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

function extractFirebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'unknown';
}

export function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    code.endsWith('/permission-denied') ||
    code.includes('permission-denied') ||
    message.toLowerCase().includes('permission-denied') ||
    message.toLowerCase().includes('insufficient permissions')
  );
}

function logUploadStage(message: string): void {
  if (isDevelopmentBuild()) {
    console.log(`[Driver Document Upload] ${message}`);
  }
}

function logUploadFailure(
  stage: 'storage upload' | 'document metadata write',
  error: unknown,
  diagnostic: {
    requirementKey: string;
    contentType: string;
    sizeBytes: number | null;
    applicationStatus?: string;
  },
): void {
  if (!isDevelopmentBuild()) return;

  const code = extractFirebaseErrorCode(error);
  const statusLine = diagnostic.applicationStatus ? `\napplicationStatus=${diagnostic.applicationStatus}` : '';
  console.error(
    `[Driver Document Upload] ${stage} failed:\ncode=${code}\nrequirementKey=${diagnostic.requirementKey}\ncontentType=${diagnostic.contentType}\nsizeBytes=${diagnostic.sizeBytes ?? 'unknown'}${statusLine}`,
  );
}

function snapshotExists(snapshot: any): RuleCheck {
  if (!snapshot) return 'unknown';
  return typeof snapshot.exists === 'function' ? Boolean(snapshot.exists()) : Boolean(snapshot.exists);
}

function snapshotData(snapshot: any): Record<string, unknown> | null {
  if (!snapshot || !snapshotExists(snapshot)) return null;
  const value = snapshot.data?.();
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function requirementForKey(
  catalog: DriverOnboardingCatalog | null | undefined,
  requirementKey: string,
): OnboardingDocumentRequirement | null | undefined {
  if (catalog === undefined) return undefined;
  if (catalog === null) return null;
  return catalog.documentRequirements.find((requirement) => requirement.key === requirementKey) ?? null;
}

async function logStorageRuleDiagnostics(
  uid: string,
  requirementKey: string,
  contentType: string,
  sizeBytes: number | null,
  applicationStatusFallback: string | undefined,
  context: DriverDocumentUploadRuleContext | undefined,
): Promise<void> {
  if (!isDevelopmentBuild()) return;

  let accountSnapshot: any;
  let applicationSnapshot: any;
  try {
    [accountSnapshot, applicationSnapshot] = await Promise.all([
      getDoc(doc(firestore, 'users', uid)),
      getDoc(doc(firestore, 'driverApplications', uid)),
    ]);
  } catch {
    // Keep the upload path unchanged if diagnostics cannot read the current state.
  }

  const account = snapshotData(accountSnapshot);
  const application = snapshotData(applicationSnapshot);
  const requirement = requirementForKey(context?.catalog, requirementKey);
  const catalogRequirements = context?.catalog?.documentRequirements;
  const catalogVehicleTypes = context?.catalog?.vehicleTypes;
  const applicationVehicle = application?.vehicle;
  const applicationVehicleTypeId = applicationVehicle && typeof applicationVehicle === 'object'
    ? (applicationVehicle as Record<string, unknown>).vehicleTypeId
    : undefined;
  // Storage Rules read the persisted application, not unsaved form state.
  // Report that exact predicate so diagnostics cannot hide a draft-save race.
  const vehicleTypeId = typeof applicationVehicleTypeId === 'string'
    ? applicationVehicleTypeId
    : undefined;
  const applicationExists = snapshotExists(applicationSnapshot);
  const applicationStatus = typeof application?.status === 'string'
    ? application.status
    : applicationSnapshot !== undefined ? 'missing' : applicationStatusFallback ?? 'unknown';
  const vehicleTypeIdPresent = typeof vehicleTypeId === 'string' && vehicleTypeId.trim().length > 0;
  const vehicleType = catalogVehicleTypes?.find((candidate) => candidate.id === vehicleTypeId);
  const requirementExistsInCatalog: RuleCheck = catalogRequirements === undefined
    ? 'unknown'
    : Boolean(requirement);
  const requirementActive: RuleCheck = requirement === undefined
    ? 'unknown'
    : requirement === null ? false : requirement.active === true;
  const requiredForApplication: RuleCheck = requirement === undefined
    ? 'unknown'
    : requirement === null ? false : requirement.requiredForApplication === true;
  const vehicleApplicable: RuleCheck = !vehicleTypeIdPresent
    ? false
    : requirement === undefined
      ? 'unknown'
    : requirement === null
      ? false
      : requirement.vehicleTypeIds.length === 0 || requirement.vehicleTypeIds.includes(vehicleTypeId as string);
  const sizeValid: RuleCheck = typeof sizeBytes === 'number'
    ? sizeBytes > 0 && sizeBytes <= MAX_DRIVER_DOCUMENT_BYTES
    : 'unknown';

  console.log(
    `[Driver Document Upload] storage rule diagnostics:\n` +
      `requirementKey=${requirementKey}\n` +
      `requirementKeyValid=${VALID_REQUIREMENT_KEY.test(requirementKey)}\n` +
      `driverAccountExists=${snapshotExists(accountSnapshot)}\n` +
      `driverRole=${account ? account.role === 'driver' : 'unknown'}\n` +
      `driverAccountActive=${account ? account.accountStatus === 'active' : 'unknown'}\n` +
      `applicationExists=${applicationExists}\n` +
      `applicationStatus=${applicationStatus}\n` +
      `vehicleTypeIdPresent=${vehicleTypeIdPresent}\n` +
      `vehicleTypeInCatalog=${catalogVehicleTypes === undefined ? 'unknown' : Boolean(vehicleType)}\n` +
      `vehicleTypeActive=${vehicleType === undefined ? 'unknown' : vehicleType.status === 'active'}\n` +
      `requirementExistsInCatalog=${requirementExistsInCatalog}\n` +
      `requirementActive=${requirementActive}\n` +
      `requiredForApplication=${requiredForApplication}\n` +
      `vehicleApplicable=${vehicleApplicable}\n` +
      `authUidMatchesDriver=${auth?.currentUser ? auth.currentUser.uid === uid : false}\n` +
      `contentType=${contentType}\n` +
      `sizeValid=${sizeValid}`,
  );
}

/**
 * Normalizes a URI from expo-document-picker into a path suitable for
 * React Native Firebase Storage `putFile`.
 *
 * - iOS `putFile` expects a raw filesystem path without the `file://` scheme.
 * - Android `putFile` accepts both `file://` URIs and `content://` URIs.
 * - `content://` URIs are passed through unchanged on Android.
 */
function normalizeFilePathForUpload(uri: string): string {
  // On Android, content:// URIs are valid for putFile — pass through.
  if (uri.startsWith('content://')) return uri;

  // Strip `file://` prefix for iOS compatibility.
  // putFile on Android also accepts raw paths, so this is safe cross-platform.
  if (uri.startsWith('file://')) {
    return uri.replace(/^file:\/\//, '');
  }

  // Already a raw path or unknown scheme — pass through.
  return uri;
}

export async function uploadDriverDocument(
  uid: string,
  documentType: string,
  asset: PickedDriverDocument,
  metadata: DriverDocumentMetadata = {},
  onProgress?: (ratio: number) => void,
  applicationStatus?: string,
  ruleContext?: DriverDocumentUploadRuleContext,
): Promise<{ readonly storagePath: string }> {
  const selectedContentType = asset.mimeType ?? '';
  await logStorageRuleDiagnostics(
    uid,
    documentType,
    selectedContentType,
    asset.size,
    applicationStatus,
    ruleContext,
  );

  if (!VALID_REQUIREMENT_KEY.test(documentType)) {
    throw new DriverDocumentUploadError('This document type is not required.');
  }
  const contentType = validatePickedDriverDocument(asset);
  const catalogRequirement = requirementForKey(ruleContext?.catalog, documentType);
  if (ruleContext?.catalog && !catalogRequirement) {
    throw new DriverDocumentUploadError('This document requirement is no longer available. Refresh and try again.');
  }
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `driver-documents/${uid}/${documentType}/${fileId}`;

  const diagnostic = {
    requirementKey: documentType,
    contentType,
    sizeBytes: asset.size,
    applicationStatus,
  };

  const normalizedPath = normalizeFilePathForUpload(asset.uri);

  if (isDevelopmentBuild()) {
    const uriScheme = getUriScheme(asset.uri);
    console.log(
      `[Driver Document Upload] diagnostics:\nuriScheme=${uriScheme}\ncontentType=${contentType}\nsizeBytes=${asset.size ?? 'unknown'}\nuploadMethod=putFile`,
    );
  }

  logUploadStage('starting storage upload');
  let task: any;
  try {
    task = putFile(ref(storage, storagePath), normalizedPath, { contentType });
  } catch (putFileError) {
    logUploadFailure('storage upload', putFileError, diagnostic);
    if (isDevelopmentBuild()) {
      console.error('[Driver Document Upload] putFile call failed immediately:', putFileError);
    }
    throw new DriverDocumentUploadError('We couldn\u2019t start the upload. Choose the file again.');
  }

  // React Native Firebase's StorageTask owns an internal promise in addition
  // to its state_changed callbacks. The callback below remains authoritative,
  // while this handler prevents the same native rejection from surfacing as an
  // unrelated unhandled promise after we have already converted the error.
  if (typeof task?.catch === 'function') {
    void task.catch(() => undefined);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot: any) => {
          if (snapshot && typeof snapshot.bytesTransferred === 'number' && typeof snapshot.totalBytes === 'number') {
            onProgress?.(snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
          }
        },
        (error: any) => reject(error),
        () => resolve(),
      );
    });
  } catch (storageError) {
    logUploadFailure('storage upload', storageError, diagnostic);
    if (isDevelopmentBuild()) {
      console.error('[Driver Document Upload] storage state_changed error:', storageError);
    }
    throw new DriverDocumentUploadError('We couldn\u2019t upload that file. Check your connection and try again.');
  }
  logUploadStage('storage upload completed');

  const allowedKeys = ['identificationNumber', 'issuanceDate', 'expiryDate'] as const;
  const filteredMetadata: Record<string, string> = {};
  for (const key of allowedKeys) {
    const val = metadata[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      if (key === 'issuanceDate' || key === 'expiryDate') {
        if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(val.trim())) {
          filteredMetadata[key] = val.trim();
        }
      } else {
        filteredMetadata[key] = val.trim();
      }
    }
  }

  const safeSizeBytes = typeof asset.size === 'number' && asset.size > 0 ? Math.round(asset.size) : 1024;
  const docRef = doc(firestore, 'drivers', uid, 'driverDocuments', documentType);

  logUploadStage('writing document metadata');
  try {
    await setDoc(
      docRef,
      {
        requirementKey: documentType,
        state: 'uploaded',
        storagePath,
        contentType,
        sizeBytes: safeSizeBytes,
        uploadedAt: serverTimestamp(),
        ...filteredMetadata,
      },
      { merge: true },
    );

    notifyDocumentUploaded(uid, documentType, {
      requirementKey: documentType,
      state: 'uploaded',
      storagePath,
      contentType,
      sizeBytes: safeSizeBytes,
      ...filteredMetadata,
    });
  } catch (firestoreError: any) {
    const code = extractFirebaseErrorCode(firestoreError);

    // If permission-denied: check if the document is already recorded in Firestore as uploaded
    if (isPermissionDenied(firestoreError)) {
      try {
        const existingSnap = await getDoc(docRef);
        const exists = existingSnap && (typeof existingSnap.exists === 'function' ? existingSnap.exists() : existingSnap.exists);
        if (exists) {
          const existingData = typeof existingSnap.data === 'function' ? existingSnap.data() : existingSnap.data;
          if (existingData?.state === 'uploaded' || existingData?.state === 'approved') {
            logUploadStage('document already uploaded in Firestore, resuming');
            notifyDocumentUploaded(uid, documentType, {
              requirementKey: documentType,
              state: existingData?.state ?? 'uploaded',
              storagePath: (existingData?.storagePath as string) || storagePath,
              ...filteredMetadata,
            });
            return { storagePath: (existingData?.storagePath as string) || storagePath };
          }
        }
      } catch {
        // Fall through to regular error handling
      }
    }

    logUploadFailure('document metadata write', firestoreError, diagnostic);
    if (isDevelopmentBuild()) {
      console.error(`[Driver Document Upload] Firestore setDoc error code: ${code}`);
    }
    throw new DriverDocumentUploadError(
      'The file was uploaded but we couldn\u2019t save the record. Try uploading again.',
    );
  }
  logUploadStage('document metadata written');

  return { storagePath };
}
