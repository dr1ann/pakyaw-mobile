import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  REQUIRED_DOCUMENT_TYPES,
  type DocumentState,
  type DriverApplication,
} from '@pakyaw/shared/onboarding';
import { firestore } from '@/services/firebase/firebase';
import type { DriverApplicationForm, DriverApplicationSnapshot } from '@/features/onboarding/types';

const EMPTY_DOCUMENTS = Object.fromEntries(
  REQUIRED_DOCUMENT_TYPES.map((documentType) => [documentType, 'missing' as const]),
) as Record<(typeof REQUIRED_DOCUMENT_TYPES)[number], DocumentState>;

function documentState(value: unknown): DocumentState {
  return value === 'missing' || value === 'uploaded' || value === 'under_review'
    || value === 'approved' || value === 'rejected' || value === 'expired'
    ? value
    : 'missing';
}

function asApplication(uid: string, data: DocumentData): DriverApplicationSnapshot {
  const documents = Object.fromEntries(REQUIRED_DOCUMENT_TYPES.map((documentType) => [
    documentType,
    documentState((data.documents as Record<string, unknown> | undefined)?.[documentType]),
  ]));
  return {
    ...(data as Omit<DriverApplication, 'id' | 'uid' | 'documents' | 'auditTrail'>),
    id: uid,
    uid,
    documents,
    auditTrail: Array.isArray(data.auditTrail) ? data.auditTrail : [],
    correctionReason: typeof data.correctionReason === 'string' ? data.correctionReason : undefined,
    correctionDocumentTypes: Array.isArray(data.correctionDocumentTypes)
      ? data.correctionDocumentTypes.filter((value): value is (typeof REQUIRED_DOCUMENT_TYPES)[number] =>
        (REQUIRED_DOCUMENT_TYPES as readonly string[]).includes(value as string),
      )
      : undefined,
  };
}

export async function createDriverApplicationDraft(
  uid: string,
  form: DriverApplicationForm,
): Promise<void> {
  await setDoc(doc(firestore, 'driverApplications', uid), {
    ...form,
    uid,
    status: 'draft',
    documents: EMPTY_DOCUMENTS,
    auditTrail: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveDriverApplicationDraft(
  uid: string,
  form: DriverApplicationForm,
): Promise<void> {
  await updateDoc(doc(firestore, 'driverApplications', uid), {
    ...form,
    updatedAt: serverTimestamp(),
  });
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
  documentType: (typeof REQUIRED_DOCUMENT_TYPES)[number],
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
  return onSnapshot(doc(firestore, 'driverApplications', uid), (snapshot) => {
    onValue(snapshot.exists() ? asApplication(uid, snapshot.data()) : null);
  }, onError);
}
