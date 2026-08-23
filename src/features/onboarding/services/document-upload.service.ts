import { ref, uploadBytesResumable } from 'firebase/storage';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { REQUIRED_DOCUMENT_TYPES, type RequiredDocumentType } from '@pakyaw/shared/onboarding';
import { firestore, storage } from '@/services/firebase/firebase';

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

export async function uploadDriverDocument(
  uid: string,
  documentType: RequiredDocumentType,
  asset: PickedDriverDocument,
  onProgress?: (ratio: number) => void,
): Promise<{ readonly storagePath: string }> {
  if (!(REQUIRED_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
    throw new DriverDocumentUploadError('This document type is not required.');
  }
  const contentType = validatePickedDriverDocument(asset);
  const response = await fetch(asset.uri);
  if (!response.ok) throw new DriverDocumentUploadError('The selected file could not be read. Please choose it again.');
  const blob = await response.blob();
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `driver-documents/${uid}/${documentType}/${fileId}`;
  const task = uploadBytesResumable(ref(storage, storagePath), blob, { contentType });
  await new Promise<void>((resolve, reject) => {
    task.on('state_changed', (snapshot) => {
      onProgress?.(snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
    }, () => reject(new DriverDocumentUploadError('Upload failed. Please try once more.')), () => resolve());
  });

  await setDoc(doc(firestore, 'drivers', uid, 'driverDocuments', documentType), {
    state: 'uploaded',
    storagePath,
    contentType,
    sizeBytes: asset.size,
    uploadedAt: serverTimestamp(),
  });
  return { storagePath };
}
