import {
  collection,
  doc,
  firestore,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from '@/services/firebase/firebase';
import type { UserDoc } from '@pakyaw/shared/features/auth/types';
import type { DriverDoc } from '@pakyaw/shared/types/driver';

export type TripDoc = { readonly id: string; readonly data: unknown };

type UserDocWrapper = { id: string; data: UserDoc };
type DriverDocWrapper = { id: string; data: DriverDoc };

const userConverter: FirestoreDataConverter<UserDocWrapper> = {
  toFirestore: (model: UserDocWrapper) => (model.data ?? {}) as unknown as Record<string, unknown>,
  fromFirestore: (snapshot: QueryDocumentSnapshot) => ({ id: snapshot.id, data: snapshot.data() as UserDoc }),
};

const driverConverter: FirestoreDataConverter<DriverDocWrapper> = {
  toFirestore: (model: DriverDocWrapper) => (model.data ?? {}) as unknown as Record<string, unknown>,
  fromFirestore: (snapshot: QueryDocumentSnapshot) => ({ id: snapshot.id, data: snapshot.data() as DriverDoc }),
};

function makeConverter<T extends { id: string; data: unknown }>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (model: T) => (model.data ?? {}) as unknown as Record<string, unknown>,
    fromFirestore: (snapshot: QueryDocumentSnapshot) =>
      ({ id: snapshot.id, data: snapshot.data() }) as T,
  };
}

const usersCol = (collection(firestore, 'users') as CollectionReference<UserDocWrapper>).withConverter(userConverter);
const driversCol = (collection(firestore, 'drivers') as CollectionReference<DriverDocWrapper>).withConverter(driverConverter);
const tripsCol = (collection(firestore, 'trips') as CollectionReference<TripDoc>).withConverter(
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
