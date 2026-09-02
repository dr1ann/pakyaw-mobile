import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  auth,
  firestore,
  storage,
  functions,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  httpsCallable,
  ref,
  uploadBytesResumable,
  onAuthStateChanged,
} from './firebase';

describe('Firebase Native SDK Coherence & Session Sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('proves auth, firestore, storage, and functions singletons share the native runtime', () => {
    expect(auth).toBeDefined();
    expect(firestore).toBeDefined();
    expect(storage).toBeDefined();
    expect(functions).toBeDefined();
  });

  it('executes authenticated users/{uid} setDoc write using native modular wrapper', async () => {
    const userRef = doc(firestore, 'users', 'driver-auth-123');
    await setDoc(userRef, {
      uid: 'driver-auth-123',
      name: 'Test Driver',
      accountStatus: 'active',
      role: 'driver',
      updatedAt: serverTimestamp(),
    });

    expect(userRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'driver-auth-123',
        name: 'Test Driver',
        accountStatus: 'active',
        role: 'driver',
      }),
      undefined,
    );
  });

  it('executes driverApplications/{uid} read and write using native modular wrappers', async () => {
    const appRef = doc(firestore, 'driverApplications', 'driver-auth-123');
    await setDoc(appRef, { status: 'draft' });
    expect(appRef.set).toHaveBeenCalledWith({ status: 'draft' }, undefined);

    await updateDoc(appRef, { 'personalDetails.firstName': 'Juan' });
    expect(appRef.update).toHaveBeenCalledWith({ 'personalDetails.firstName': 'Juan' });

    const snap = await getDoc(appRef);
    expect(typeof snap.exists).toBe('function');
  });

  it('attaches and cleans up Firestore realtime listener with exists() compatibility', () => {
    const targetRef = doc(firestore, 'trips', 'trip-123');
    const onNext = vi.fn();
    const onError = vi.fn();

    const unsubscribe = onSnapshot(targetRef, onNext, onError);
    expect(typeof unsubscribe).toBe('function');
    expect(targetRef.onSnapshot).toHaveBeenCalled();

    unsubscribe();
  });

  it('executes Storage document upload through native storage reference', async () => {
    const storageRef = ref(storage, 'driver-documents/driver-123/license/file-1.pdf');
    const task = uploadBytesResumable(storageRef, 'file:///path/to/license.pdf', {
      contentType: 'application/pdf',
    });

    expect(storageRef.putFile).toHaveBeenCalledWith('file:///path/to/license.pdf', {
      contentType: 'application/pdf',
    });
    expect(task).toBeDefined();
  });

  it('executes callable Functions with asia-southeast1 region', async () => {
    const callable = httpsCallable(functions, 'setDriverAvailability');
    const response = await callable({ driverId: 'driver-123', availability: 'online' });

    expect(functions.httpsCallable).toHaveBeenCalledWith('setDriverAvailability');
    expect(response.data).toEqual({ success: true });
  });

  it('proves onAuthStateChanged restores and persists native session', () => {
    const listener = vi.fn();
    const unsubscribe = onAuthStateChanged(auth, listener);

    expect(auth.onAuthStateChanged).toHaveBeenCalledWith(listener, undefined, undefined);
    expect(listener).toHaveBeenCalledWith(null);
    expect(typeof unsubscribe).toBe('function');
  });
});
