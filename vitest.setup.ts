import { vi } from 'vitest';

process.env.APP_ENV = process.env.APP_ENV ?? 'development';
process.env.EXPO_PUBLIC_FIREBASE_API_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'test-key';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN =
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'test.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'test-project';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID =
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:test';
process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? 'AIzaSy_test_key';

(globalThis as any).__DEV__ = true;

// In-memory mock for AsyncStorage in tests
const inMemoryStorage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => inMemoryStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      inMemoryStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      inMemoryStorage.delete(key);
    }),
    clear: vi.fn(async () => {
      inMemoryStorage.clear();
    }),
    getAllKeys: vi.fn(async () => Array.from(inMemoryStorage.keys())),
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, inMemoryStorage.get(k) ?? null])),
    multiSet: vi.fn(async (entries: [string, string][]) => {
      for (const [k, v] of entries) inMemoryStorage.set(k, v);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const k of keys) inMemoryStorage.delete(k);
    }),
  },
}));

// Default mocks for native React Native Firebase modules
const mockAppInstance = { name: '[DEFAULT]' };
vi.mock('@react-native-firebase/app', () => ({
  default: {
    app: vi.fn(() => mockAppInstance),
  },
  getApp: vi.fn(() => mockAppInstance),
  getApps: vi.fn(() => [mockAppInstance]),
  initializeApp: vi.fn(() => mockAppInstance),
}));

vi.mock('@react-native-firebase/auth', () => {
  const authInstance = {
    currentUser: null,
    settings: { appVerificationDisabledForTesting: false },
    signInWithPhoneNumber: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn((listener: (user: unknown) => void) => {
      listener(null);
      return () => undefined;
    }),
    useEmulator: vi.fn(),
  };
  const authFn = Object.assign(vi.fn(() => authInstance), authInstance);
  return {
    default: authFn,
    getAuth: vi.fn(() => authInstance),
  };
});

vi.mock('@react-native-firebase/firestore', () => {
  const firestoreInstance = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) => ({
        id,
        path: `${name}/${id}`,
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        onSnapshot: vi.fn((cb: any) => { cb({ exists: false, data: () => undefined }); return () => undefined; }),
      })),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
      onSnapshot: vi.fn((cb: any) => { cb({ docs: [] }); return () => undefined; }),
      withConverter: vi.fn().mockReturnThis(),
    })),
    doc: vi.fn((path: string) => ({
      path,
      get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      onSnapshot: vi.fn((cb: any) => { cb({ exists: false, data: () => undefined }); return () => undefined; }),
    })),
    batch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
    runTransaction: vi.fn(async (fn: any) => fn({
      get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
    useEmulator: vi.fn(),
  };
  class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    toDate() { return new Date(this.seconds * 1000); }
    toMillis() { return this.seconds * 1000; }
  }
  const firestoreFn = Object.assign(vi.fn(() => firestoreInstance), firestoreInstance, {
    FieldValue: {
      serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
      delete: vi.fn(() => ({ _type: 'delete' })),
      arrayUnion: vi.fn((...items: unknown[]) => ({ _type: 'arrayUnion', items })),
      arrayRemove: vi.fn((...items: unknown[]) => ({ _type: 'arrayRemove', items })),
    },
    Timestamp: MockTimestamp,
  });
  return {
    default: firestoreFn,
    getFirestore: vi.fn(() => firestoreInstance),
    Timestamp: MockTimestamp,
    FieldValue: firestoreFn.FieldValue,
  };
});

vi.mock('@react-native-firebase/storage', () => {
  const storageInstance = {
    ref: vi.fn((path: string) => ({
      fullPath: path,
      putFile: vi.fn().mockReturnValue({ on: vi.fn((_event, _progress, _err, done) => { done?.(); return () => undefined; }) }),
      put: vi.fn().mockReturnValue({ on: vi.fn((_event, _progress, _err, done) => { done?.(); return () => undefined; }) }),
      getDownloadURL: vi.fn().mockResolvedValue('https://storage.example.com/file'),
    })),
    useEmulator: vi.fn(),
  };
  const storageFn = Object.assign(vi.fn(() => storageInstance), storageInstance);
  return {
    default: storageFn,
    getStorage: vi.fn(() => storageInstance),
  };
});

vi.mock('@react-native-firebase/functions', () => {
  const functionsInstance = {
    httpsCallable: vi.fn((name: string) => vi.fn(async (data: unknown) => ({ data: { success: true } }))),
    useEmulator: vi.fn(),
  };
  const functionsFn = Object.assign(vi.fn(() => functionsInstance), functionsInstance);
  return {
    default: functionsFn,
    getFunctions: vi.fn(() => functionsInstance),
  };
});
