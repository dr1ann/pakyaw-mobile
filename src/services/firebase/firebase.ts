import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

import { env } from '@/services/env';

/** Public Firebase web configuration used by the in-app reCAPTCHA WebView. */
export const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
    ?? `${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`,
};

export const app: FirebaseApp =
  getApps()[0] ?? initializeApp(firebaseConfig);

type ReactNativePersistenceFn = (storage: unknown) => Persistence;

// Guard against double-initialization on hot reload.
// initializeAuth throws if called twice on the same app instance.
let _auth: Auth;
try {
  const getReactNativePersistence = (
    firebaseAuth as { readonly getReactNativePersistence?: ReactNativePersistenceFn }
  ).getReactNativePersistence;

  if (!getReactNativePersistence) {
    throw new Error('getReactNativePersistence is not defined on firebase/auth');
  }

  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized — retrieve existing instance.
  _auth = getAuth(app);
}
export const auth: Auth = _auth;

// Firebase test phone numbers need this explicit test-only switch to avoid
// loading the browser-only Enterprise script in a React Native runtime.
// Never enable it for a production build or a real phone number.
if (env.EXPO_PUBLIC_FIREBASE_AUTH_TEST_MODE === 'true') {
  auth.settings.appVerificationDisabledForTesting = true;
}

export const firestore: Firestore = getFirestore(app);
/** Private driver documents are uploaded through Storage rules, never public URLs. */
export const storage: FirebaseStorage = getStorage(app);

/** All contract callables are deployed in the same region as the Day 2 backend. */
export const functions: Functions = getFunctions(app, 'asia-southeast1');

if (env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  // Physical devices must use a reachable LAN host, never an implicit localhost.
  connectFunctionsEmulator(
    functions,
    env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST ?? '10.0.2.2',
    5001,
  );
}
