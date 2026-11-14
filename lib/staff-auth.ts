import { getAuth } from "firebase-admin/auth";
import { isStaffAccount } from "@/lib/loyalty-engine";
import { LoyaltyError } from "@/lib/loyalty-store";

export async function requireStaff(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new LoyaltyError(401, "Staff sign-in is required.");

  try {
    const decoded = await getAuth().verifyIdToken(token);
    const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
    if (!isStaffAccount({ email: decoded.email, role: decoded.role }, adminEmail)) {
      throw new LoyaltyError(403, "This account cannot verify visits or redeem rewards.");
    }
    return decoded;
  } catch (error) {
    if (error instanceof LoyaltyError) throw error;
    throw new LoyaltyError(401, "Staff sign-in is required.");
  }
}
