

// services/firebaseClient.ts
import { initializeApp } from 'firebase/app';
// Fix: Use namespace import for Firestore functions as a workaround for environments
// where direct named exports might not be resolved correctly.
import * as FirebaseFirestore from 'firebase/firestore';
import { firebaseConfig } from '../constants';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore database instance
export const db = FirebaseFirestore.getFirestore(app);