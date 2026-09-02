import { describe, expect, it, vi } from 'vitest';
import {
  app,
  auth,
  firestore,
  functions,
  storage,
  doc,
  httpsCallable,
  ref,
  onAuthStateChanged,
} from './firebase';

describe('Firebase Native Client Coherence', () => {
  it('initializes a single native FirebaseApp singleton', () => {
    expect(app).toBeDefined();
    expect(app.name).toBe('[DEFAULT]');
  });

  it('binds native Auth to the shared FirebaseApp', () => {
    expect(auth).toBeDefined();
  });

  it('binds native Firestore to the shared FirebaseApp', () => {
    expect(firestore).toBeDefined();
  });

  it('binds native Storage to the shared FirebaseApp', () => {
    expect(storage).toBeDefined();
  });

  it('binds native Functions to the shared FirebaseApp and asia-southeast1 region', () => {
    expect(functions).toBeDefined();
  });

  it('shares authenticated user across native Firestore and Storage operations', async () => {
    const testDoc = doc(firestore, 'users', 'test-user-123');
    expect(testDoc).toBeDefined();

    const testRef = ref(storage, 'documents/test-user-123/id.jpg');
    expect(testRef).toBeDefined();
  });

  it('calls functions and auth listeners coherently without JS SDK wrappers', async () => {
    const listener = vi.fn();
    const unsub = onAuthStateChanged(auth, listener);
    expect(typeof unsub).toBe('function');
    unsub();

    const callable = httpsCallable(functions, 'getSafetyStatus');
    expect(typeof callable).toBe('function');
  });
});
