import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { apiError } from "@/lib/api-error";
import { normalizePhone } from "@/lib/loyalty-engine";
import { linkCustomerAuth } from "@/lib/loyalty-store";

export async function POST(request: Request) {
  try {
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json({ success: false, error: "Sign in with the OTP first." }, { status: 401 });
    }
    const decoded = await getAuth().verifyIdToken(token);
    const phone = normalizePhone(decoded.phone_number || "");
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ success: false, error: "Use an Indian mobile number." }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const linked = await linkCustomerAuth({
      name: body.name,
      phone,
      authUid: decoded.uid,
    });
    return NextResponse.json({ success: true, ...linked });
  } catch (error) {
    return apiError(error);
  }
}
