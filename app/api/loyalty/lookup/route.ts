import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { customerProgress } from "@/lib/loyalty-store";
import { normalizePhone } from "@/lib/loyalty-engine";
import { requireStaff } from "@/lib/staff-auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    await requireStaff(request);
    const { searchParams } = new URL(request.url);
    const customerCode = String(searchParams.get("customerCode") || "").trim().toUpperCase();
    const phone = normalizePhone(String(searchParams.get("phone") || ""));
    if (!customerCode && !phone) {
      return NextResponse.json({ success: false, error: "Scan a membership QR or enter a mobile number." }, { status: 400 });
    }
    if (customerCode && !/^ES\d{4,}$/.test(customerCode)) {
      return NextResponse.json({ success: false, error: "Invalid membership QR. Expected format: ES0001." }, { status: 400 });
    }
    const progress = await customerProgress({
      customerCode,
      phone: phone || (await phoneForCode(customerCode)),
    });
    return NextResponse.json({ success: true, customer: progress });
  } catch (error) {
    return apiError(error);
  }
}

async function phoneForCode(customerCode: string) {
  const snap = await adminDb.collection("customers").where("customerCode", "==", customerCode).limit(1).get();
  return String(snap.docs[0]?.data()?.phone || "");
}
