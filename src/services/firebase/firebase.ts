import { getApp, type FirebaseApp } from '@react-native-firebase/app';
import {
  getAuth,
  type Auth,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';
import {
  getFirestore,
  Timestamp,
  FieldValue,
  type Firestore,
  type DocumentData,
  type FirestoreError,
  type CollectionReference,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type FirestoreDataConverter,
  type SetOptions,
  type WhereFilterOp,
  type OrderByDirection,
} from '@react-native-firebase/firestore';
import {
  getStorage,
  type FirebaseStorage,
  type StorageReference,
  type UploadTask,
} from '@react-native-firebase/storage';
import {
  getFunctions,
  type Functions,
} from '@react-native-firebase/functions';

import { env } from '@/services/env';

/** Public Firebase configuration values for reference. */
export const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
    ?? `${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`,
};

// ---------------------------------------------------------------------------
// Native Firebase Singleton Instances
// ---------------------------------------------------------------------------

export const app: FirebaseApp = getApp();
export const auth: Auth = getAuth(app);
export const firestore: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app, 'asia-southeast1');

// ---------------------------------------------------------------------------
// Re-export Firestore / Auth / Storage types
// ---------------------------------------------------------------------------

export type {
  Auth,
  ConfirmationResult,
  User,
  Firestore,
  DocumentData,
  FirestoreError,
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  QuerySnapshot,
  FirestoreDataConverter,
  FirebaseStorage,
  StorageReference,
  UploadTask,
  Functions,
};

export type Unsubscribe = () => void;
export { Timestamp, FieldValue };

// ---------------------------------------------------------------------------
// Error Types & Compatibility
// ---------------------------------------------------------------------------

export class FirebaseError extends Error {
  readonly code: string;
  readonly customData?: Record<string, unknown>;

  constructor(code: string, message: string, customData?: Record<string, unknown>) {
    super(message);
    this.name = 'FirebaseError';
    this.code = code;
    this.customData = customData;
  }
}

// ---------------------------------------------------------------------------
// Native Firestore Modular Wrappers
// ---------------------------------------------------------------------------

export function wrapDocumentSnapshot<T = DocumentData>(
  snap: any,
): any {
  if (!snap) return snap;
  const existsVal = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
  return new Proxy(snap, {
    get(target, prop, receiver) {
      if (prop === 'exists') {
        return () => Boolean(existsVal);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function doc(first: any, ...rest: string[]): any {
  if (typeof first === 'string') {
    const fullPath = [first, ...rest].join('/');
    return (firestore as any).doc(fullPath);
  }
  if (first && typeof first.doc === 'function') {
    const fullPath = rest.join('/');
    return first.doc(fullPath);
  }
  if (first && typeof first.collection === 'function') {
    const fullPath = rest.join('/');
    return first.doc(fullPath);
  }
  return (firestore as any).doc(rest.join('/'));
}

export function collection(first: any, ...rest: string[]): any {
  if (typeof first === 'string') {
    const fullPath = [first, ...rest].join('/');
    return (firestore as any).collection(fullPath);
  }
  if (first && typeof first.collection === 'function') {
    const fullPath = rest.join('/');
    return first.collection(fullPath);
  }
  return (firestore as any).collection(rest.join('/'));
}

export async function getDoc(docRef: any): Promise<any> {
  const snap = await docRef.get();
  return wrapDocumentSnapshot(snap);
}

export async function getDocs(queryOrCollectionRef: any): Promise<any> {
  const querySnap = await queryOrCollectionRef.get();
  const wrappedDocs = querySnap.docs.map((d: any) => wrapDocumentSnapshot(d));
  return new Proxy(querySnap, {
    get(target, prop, receiver) {
      if (prop === 'docs') return wrappedDocs;
      if (prop === 'forEach') {
        return (callback: (doc: any, index: number) => void) => {
          wrappedDocs.forEach(callback);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export async function setDoc(docRef: any, data: any, options?: SetOptions): Promise<void> {
  return docRef.set(data, options);
}

export async function updateDoc(docRef: any, data: any): Promise<void> {
  return docRef.update(data);
}

export async function deleteDoc(docRef: any): Promise<void> {
  return docRef.delete();
}

export function onSnapshot(
  refOrQuery: any,
  onNext: (snapshot: any) => void,
  onError?: (error: Error) => void,
): () => void {
  return refOrQuery.onSnapshot(
    (snap: any) => {
      if (!snap) {
        onNext(snap);
        return;
      }
      if (typeof snap.exists === 'boolean' || typeof snap.exists === 'function') {
        onNext(wrapDocumentSnapshot(snap));
      } else if (Array.isArray(snap.docs)) {
        const wrappedDocs = snap.docs.map((d: any) => wrapDocumentSnapshot(d));
        const wrappedSnap = new Proxy(snap, {
          get(target, prop, receiver) {
            if (prop === 'docs') return wrappedDocs;
            if (prop === 'forEach') {
              return (callback: (doc: any, index: number) => void) => {
                wrappedDocs.forEach(callback);
              };
            }
            return Reflect.get(target, prop, receiver);
          },
        });
        onNext(wrappedSnap);
      } else {
        onNext(snap);
      }
    },
    onError,
  );
}

export function query(collectionRef: any, ...constraints: any[]): any {
  let q = collectionRef;
  for (const constraint of constraints) {
    if (typeof constraint === 'function') {
      q = constraint(q);
    }
  }
  return q;
}

export function where(fieldPath: string, opStr: WhereFilterOp, value: any) {
  return (q: any) => q.where(fieldPath, opStr, value);
}

export function orderBy(fieldPath: string, directionStr?: OrderByDirection) {
  return (q: any) => q.orderBy(fieldPath, directionStr);
}

export function limit(limitNum: number) {
  return (q: any) => q.limit(limitNum);
}

export function startAfter(...args: any[]) {
  return (q: any) => q.startAfter(...args);
}

export function serverTimestamp(): any {
  return FieldValue.serverTimestamp();
}

export async function runTransaction<T>(
  fs: any,
  updateFunction: (transaction: any) => Promise<T>,
): Promise<T> {
  const targetFirestore = fs && typeof fs.runTransaction === 'function' ? fs : firestore;
  return targetFirestore.runTransaction(async (transaction: any) => {
    const wrappedTx = {
      get: async (docRef: any) => {
        const snap = await transaction.get(docRef);
        return wrapDocumentSnapshot(snap);
      },
      set: (docRef: any, data: any, options?: any) => transaction.set(docRef, data, options),
      update: (docRef: any, data: any) => transaction.update(docRef, data),
      delete: (docRef: any) => transaction.delete(docRef),
    };
    return updateFunction(wrappedTx);
  });
}

export function writeBatch(fs?: any): any {
  const targetFirestore = fs && typeof fs.batch === 'function' ? fs : firestore;
  return targetFirestore.batch();
}

// ---------------------------------------------------------------------------
// Native Functions Modular Wrappers
// ---------------------------------------------------------------------------

export function httpsCallable<TReq = unknown, TRes = unknown>(
  fnInstance: any,
  name: string,
): (data?: TReq) => Promise<{ data: TRes }> {
  const callable = (typeof fnInstance?.httpsCallable === 'function' ? fnInstance : functions).httpsCallable(name);
  return async (data?: TReq) => {
    const result = await callable(data);
    return { data: result.data as TRes };
  };
}

// ---------------------------------------------------------------------------
// Native Storage Modular Wrappers
// ---------------------------------------------------------------------------

export function ref(storageInstance: any, path?: string): any {
  const targetStorage = storageInstance && typeof storageInstance.ref === 'function' ? storageInstance : storage;
  return typeof path === 'string' ? targetStorage.ref(path) : targetStorage.ref();
}

export function uploadBytesResumable(storageRef: any, data: any, metadata?: any): any {
  if (typeof data === 'string') {
    return storageRef.putFile(data, metadata);
  }
  return storageRef.put(data, metadata);
}

// ---------------------------------------------------------------------------
// Native Auth Modular Wrappers
// ---------------------------------------------------------------------------

export function onAuthStateChanged(
  authInstance: any,
  nextOrObserver: any,
  error?: any,
  completed?: any,
): () => void {
  const targetAuth = authInstance && typeof authInstance.onAuthStateChanged === 'function' ? authInstance : auth;
  return targetAuth.onAuthStateChanged(nextOrObserver, error, completed);
}

export async function signInWithEmailAndPassword(
  authInstance: any,
  email: string,
  pass: string,
): Promise<any> {
  const targetAuth = authInstance && typeof authInstance.signInWithEmailAndPassword === 'function' ? authInstance : auth;
  return targetAuth.signInWithEmailAndPassword(email, pass);
}

export async function createUserWithEmailAndPassword(
  authInstance: any,
  email: string,
  pass: string,
): Promise<any> {
  const targetAuth = authInstance && typeof authInstance.createUserWithEmailAndPassword === 'function' ? authInstance : auth;
  return targetAuth.createUserWithEmailAndPassword(email, pass);
}

export async function signOut(authInstance: any): Promise<void> {
  const targetAuth = authInstance && typeof authInstance.signOut === 'function' ? authInstance : auth;
  return targetAuth.signOut();
}

export async function signInWithPhoneNumber(authInstance: any, phone: string): Promise<any> {
  const targetAuth = authInstance && typeof authInstance.signInWithPhoneNumber === 'function' ? authInstance : auth;
  return targetAuth.signInWithPhoneNumber(phone);
}
