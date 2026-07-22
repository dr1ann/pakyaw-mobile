import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBHqAnvMN4d_RTAVpaVCNkBRkKh-Y4AADE",
  authDomain: "pakyaw-39434.firebaseapp.com",
  projectId: "pakyaw-39434",
  storageBucket: "pakyaw-39434.appspot.com",
  messagingSenderId: "125987429193",
  appId: "1:125987429193:web:3796c7bbf894e2ebf15898"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const email = 'driver@gmail.com';
  const password = '123456';

  let uid = null;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    console.log('Created new Firebase Auth user:', uid);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('User already exists, signing in to retrieve UID...');
      const cred = await signInWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
      console.log('Signed in user UID:', uid);
    } else {
      console.error('Error creating user:', err);
      process.exit(1);
    }
  }

  // 1. Write users/{uid} document
  await setDoc(doc(db, 'users', uid), {
    uid,
    role: 'driver',
    email,
    firstName: 'Ormoc',
    lastName: 'Driver',
    displayName: 'Ormoc Driver',
    phone: '09123456789',
    phoneVerified: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  console.log('Wrote users/' + uid + ' document');

  // 2. Write drivers/{uid} document
  await setDoc(doc(db, 'drivers', uid), {
    uid,
    email,
    driverName: 'Ormoc Driver',
    displayName: 'Ormoc Driver',
    firstName: 'Ormoc',
    lastName: 'Driver',
    approved: true,
    availability: 'online',
    vehicleModel: 'Pakyaw Fleet Tricycle',
    vehiclePlate: 'ORM-2026',
    maxSeats: 6,
    serviceAreaId: 'ormoc',
    currentLocation: {
      latitude: 11.006,
      longitude: 124.607,
      geohash: 'w9z7x4v',
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
  console.log('Wrote drivers/' + uid + ' document');

  console.log('SUCCESS: Driver account driver@gmail.com successfully created and configured!');
  process.exit(0);
}

main().catch(console.error);
