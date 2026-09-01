import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  AuthError,
  NetworkError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from '@pakyaw/shared/features/auth/errors';
import type { UserDoc, UserDocInput, UserRole } from '@pakyaw/shared/features/auth/types';
import { auth, firestore } from '@/services/firebase/firebase';

// ---------------------------------------------------------------------------
// Error translation
// ---------------------------------------------------------------------------

function translateFirebaseError(
  err: unknown,
): AuthError | NetworkError | PermissionError | ValidationError | NotFoundError {
  if (!(err instanceof FirebaseError)) {
    return new AuthError('An unexpected error occurred. Please try again.');
  }

  switch (err.code) {
    case 'auth/email-already-in-use':
      return new AuthError(
        'An account with this email already exists. Try signing in instead.',
      );
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return new AuthError('Incorrect email or password. Please try again.');
    case 'auth/invalid-email':
      return new ValidationError('Enter a valid email address.');
    case 'auth/weak-password':
      return new ValidationError('Password must be at least 6 characters.');
    case 'auth/user-disabled':
      return new AuthError(
        'This account has been disabled. Contact support for help.',
      );
    case 'auth/too-many-requests':
      return new AuthError(
        'Too many attempts. Please wait a moment before trying again.',
      );
    case 'auth/network-request-failed':
      return new NetworkError();
    case 'auth/operation-not-allowed':
      return new PermissionError(
        'This sign-in method is not enabled. Contact support.',
      );
    case 'auth/unauthorized-domain':
      return new PermissionError(
        'This app is not authorized to perform this action.',
      );
    case 'permission-denied':
      return new PermissionError();
    case 'not-found':
      return new NotFoundError();
    default:
      return new AuthError(
        `Something went wrong. Please try again. (${err.code})`,
      );
  }
}

// ---------------------------------------------------------------------------
// Passenger sign-up
// ---------------------------------------------------------------------------

export async function createPassenger(
  email: string,
  password: string,
): Promise<string> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return credential.user.uid;
  } catch (err) {
    throw translateFirebaseError(err);
  }
}

// ---------------------------------------------------------------------------
// Passenger sign-in
// ---------------------------------------------------------------------------

export async function signInPassenger(
  email: string,
  password: string,
): Promise<string> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user.uid;
  } catch (err) {
    throw translateFirebaseError(err);
  }
}

// ---------------------------------------------------------------------------
// Driver sign-in — email + password
// ---------------------------------------------------------------------------

export async function signInDriver(
  email: string,
  password: string,
): Promise<{ uid: string; role: UserRole }> {
  let uid: string;
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    uid = credential.user.uid;
  } catch (err) {
    throw translateFirebaseError(err);
  }

  try {
    const [userSnap, driverSnap] = await Promise.all([
      getDoc(doc(firestore, 'users', uid)),
      getDoc(doc(firestore, 'drivers', uid)),
    ]);

    if (!userSnap.exists()) {
      throw new NotFoundError(
        'No account found for this email. Contact your fleet manager.',
      );
    }
    const userData = userSnap.data() as UserDoc;
    if (userData.role !== 'driver') {
      throw new AuthError(
        'This account is not registered as a driver. Use passenger sign-in.',
      );
    }

    if (!driverSnap.exists()) {
      throw new NotFoundError(
        'Driver profile not found. Contact your fleet manager.',
      );
    }
    const driverData = driverSnap.data() as { approved: boolean };
    if (!driverData.approved) {
      throw new AuthError(
        'Your driver account is pending approval. Please wait for confirmation.',
      );
    }

    return { uid, role: 'driver' };
  } catch (err) {
    await signOut(auth).catch(() => undefined);
    if (
      err instanceof AuthError ||
      err instanceof NotFoundError ||
      err instanceof NetworkError ||
      err instanceof PermissionError ||
      err instanceof ValidationError
    ) {
      throw err;
    }
    throw translateFirebaseError(err);
  }
}

// ---------------------------------------------------------------------------
// Sign-out
// ---------------------------------------------------------------------------

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    throw translateFirebaseError(err);
  }
}

// ---------------------------------------------------------------------------
// Firestore user document
// ---------------------------------------------------------------------------

export async function createUserDoc(
  uid: string,
  data: Partial<UserDocInput>,
): Promise<void> {
  try {
    const name = data.name ?? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
    const mobile = data.mobile ?? data.phone ?? '';
    await setDoc(doc(firestore, 'users', uid), {
      uid,
      name: name.length >= 2 ? name : 'Passenger',
      mobile,
      role: data.role ?? 'passenger',
      accountStatus: data.accountStatus ?? 'active',
      termsAcceptedAt: data.termsAcceptedAt ?? serverTimestamp(),
      privacyAcceptedAt: data.privacyAcceptedAt ?? serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw translateFirebaseError(err);
  }
}

export async function updatePassengerName(
  uid: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new ValidationError('Name must be at least 2 characters.');
  }
  try {
    await updateDoc(doc(firestore, 'users', uid), {
      name: trimmed,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw translateFirebaseError(err);
  }
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserDoc;
  } catch (err) {
    throw translateFirebaseError(err);
  }
}

export { auth as firebaseAuth };


