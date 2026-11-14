import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountJson) {
  throw new Error("Firebase service account is missing");
}

const serviceAccount = JSON.parse(serviceAccountJson);

const adminApp =
  getApps()[0] ??
  initializeApp({
    credential: cert(serviceAccount),
  });

export const adminDb = getFirestore(adminApp);
