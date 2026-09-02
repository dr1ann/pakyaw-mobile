import {
  doc,
  firestore,
  putFile,
  ref,
  serverTimestamp,
  setDoc,
  storage,
} from '@/services/firebase/firebase';
import type { DriverDocumentMetadata } from '@pakyaw/shared/onboarding';

export const MAX_DRIVER_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['application/pdf'] as const;

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

export async function uploadDriverDocument(
  uid: string,
  documentType: string,
  asset: PickedDriverDocument,
  metadata: DriverDocumentMetadata = {},
  onProgress?: (ratio: number) => void,
  applicationStatus?: string,
): Promise<{ readonly storagePath: string }> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(documentType)) {
    throw new DriverDocumentUploadError('This document type is not required.');
  }
  const contentType = validatePickedDriverDocument(asset);
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `driver-documents/${uid}/${documentType}/${fileId}`;

  const diagnostic = {
    requirementKey: documentType,
    contentType,
    sizeBytes: asset.size,
    applicationStatus,
  };

  if (isDevelopmentBuild()) {
    const uriScheme = getUriScheme(asset.uri);
    console.log(
      `[Driver Document Upload] diagnostics:\nuriScheme=${uriScheme}\ncontentType=${contentType}\nsizeBytes=${asset.size ?? 'unknown'}\nuploadMethod=putFile`,
    );
  }

  logUploadStage('starting storage upload');
  const task = putFile(ref(storage, storagePath), asset.uri, { contentType });
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
    throw new DriverDocumentUploadError('We couldn’t upload that file. Try again.');
  }
  logUploadStage('storage upload completed');

  const normalizedMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
  );

  logUploadStage('writing document metadata');
  try {
    await setDoc(doc(firestore, 'drivers', uid, 'driverDocuments', documentType), {
      requirementKey: documentType,
      state: 'uploaded',
      storagePath,
      contentType,
      sizeBytes: asset.size ?? null,
      uploadedAt: serverTimestamp(),
      ...normalizedMetadata,
    });
  } catch (firestoreError) {
    logUploadFailure('document metadata write', firestoreError, diagnostic);
    throw new DriverDocumentUploadError('We couldn’t upload that file. Try again.');
  }
  logUploadStage('document metadata written');

  return { storagePath };
}
