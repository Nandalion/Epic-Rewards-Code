
import dotenv from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

dotenv.config({ path: ".env.local" });

async function main() {
  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountJson) {
    throw new Error("Firebase service account is missing.");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(serviceAccount),
    });

  const adminAuth = getAuth(app);

  const email = process.argv[2];

  if (!email) {
    throw new Error(
      "Usage: node scripts/set-admin-role.mjs admin@example.com"
    );
  }

  const user = await adminAuth.getUserByEmail(email);

  const existingClaims = user.customClaims || {};

  await adminAuth.setCustomUserClaims(user.uid, {
    ...existingClaims,
    active: true,
    role: "admin",
  });

  console.log("Admin permissions assigned successfully!");
  console.log("Email:", user.email);
  console.log("UID:", user.uid);
  console.log("Claims:", {
    active: true,
    role: "admin",
  });
}

main().catch((error) => {
  console.error("Failed to assign admin permissions:", error);
  process.exit(1);
});
