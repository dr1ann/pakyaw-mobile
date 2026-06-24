import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
} from 'firebase/firestore';

import { firestore } from '@/services/firebase/firebase';
import type { UserDoc } from '@/features/auth/types';
import type { DriverDoc } from '@/features/driver-availability/types';

// TODO(phase-6+): replace TripDoc unknown payload with concrete domain type.
export type TripDoc = { readonly id: string; readonly data: unknown };

function makeConverter<T extends { id: string; data: unknown }>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (model) => (model.data ?? {}) as Record<string, unknown>,
    fromFirestore: (snapshot) =>
      ({ id: snapshot.id, data: snapshot.data() }) as T,
  };
}

// Typed converter for the users collection (Phase 3).
type UserDocWrapper = { id: string; data: UserDoc };

const userConverter: FirestoreDataConverter<UserDocWrapper> = {
  toFirestore: (model) => (model.data ?? {}) as Record<string, unknown>,
  fromFirestore: (snapshot) => ({ id: snapshot.id, data: snapshot.data() as UserDoc }),
};

// Typed converter for the drivers collection (Phase 5).
type DriverDocWrapper = { id: string; data: DriverDoc };

const driverConverter: FirestoreDataConverter<DriverDocWrapper> = {
  toFirestore: (model) => (model.data ?? {}) as Record<string, unknown>,
  fromFirestore: (snapshot) => ({ id: snapshot.id, data: snapshot.data() as DriverDoc }),
};

const usersCol = collection(firestore, 'users').withConverter(userConverter);
const driversCol = collection(firestore, 'drivers').withConverter(driverConverter);
const tripsCol = collection(firestore, 'trips').withConverter(
  makeConverter<TripDoc>(),
);

export const collections = {
  users: (): CollectionReference<UserDocWrapper> => usersCol,
  drivers: (): CollectionReference<DriverDocWrapper> => driversCol,
  trips: (): CollectionReference<TripDoc> => tripsCol,
  userDoc: (id: string): DocumentReference<UserDocWrapper> => doc(usersCol, id),
  driverDoc: (id: string): DocumentReference<DriverDocWrapper> => doc(driversCol, id),
  tripDoc: (id: string): DocumentReference<TripDoc> => doc(tripsCol, id),
};

