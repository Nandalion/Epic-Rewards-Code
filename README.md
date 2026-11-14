# EPIC Snacks – 5 Separate-Day Visit Challenge

A Next.js + TypeScript + Tailwind + Firebase loyalty app.

## Customer flow
1. Customer scans the shop's signup QR and registers name + Indian WhatsApp number.
2. Firestore creates a customer record.
3. Customer receives a unique personal loyalty QR (`EPIC1:<customer-id>`), which they should save or screenshot.
4. Customer can send the welcome WhatsApp message to EPIC Snacks (+91 73050 15074).

## Staff flow
1. Staff signs in at `/admin`.
2. Scan the membership QR (`ES0001`) or enter the customer's mobile number.
3. Enter the unique bill number and the amount after discount. The default campaign requires at least ₹200.
4. The server records one qualifying visit per customer per Asia/Kolkata calendar day. A second visit the same day, a reused bill, or a bill below the minimum is rejected.
5. On the fifth qualifying day the server creates one reward. The customer pulls to refresh, then opens a separate redemption QR.
6. Staff scans that reward QR and confirms the free item was given. The reward can be used once, and the customer starts a new cycle at 0/5.
7. Campaign settings are edited on the admin page. Existing cycles keep the settings they started with.

Publish `firestore.rules` before going live. Browser clients cannot read or write loyalty data; the server uses the Firebase Admin SDK.

Run `npm test` for the visit, reward, redemption, and campaign rules. Phone OTP login requires Firebase Authentication → Phone to be enabled. Until then, customers can still register with name and mobile number.

## Setup
1. Create a Firebase project at https://console.firebase.google.com/
2. Add a Firebase Web App, create Firestore, and enable Authentication > Email/Password.
3. Create your own admin user in Firebase Authentication.
4. Publish `firestore.rules` in Firestore Rules.
5. Copy `.env.example` to `.env.local` and fill Firebase config.
6. `npm install` then `npm run dev`.
7. Deploy to Vercel and add the same environment variables.

## Important
- The shop signup QR must point to the deployed public website URL, not localhost. Generate a QR for that URL and print it at the counter.
- Each customer gets their own personal QR after signup. Staff scans this QR in the admin page.
- Camera scanning requires HTTPS (Vercel provides HTTPS) and camera permission.
- One visit means one paid bill of at least the campaign minimum, on one Asia/Kolkata calendar date.
- This version does not automatically send WhatsApp messages. Staff must press Send in WhatsApp.
- Set `FIREBASE_SERVICE_ACCOUNT_KEY` on the server. Do not commit `app/service-account.json`.
- Give staff the `admin` or `staff` custom claim with `node scripts/set-admin-role.mjs you@example.com`, or set `ADMIN_EMAIL` to the existing admin address.
- Deploy with `npm run build`, then set the same environment variables on the host and publish `firestore.rules` in the Firebase console.
"# Epic-Rewards-Code" 
