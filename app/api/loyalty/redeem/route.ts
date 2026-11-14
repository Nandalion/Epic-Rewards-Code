import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { readRewardQr } from "@/lib/loyalty-engine";
import { redeemReward } from "@/lib/loyalty-store";
import { requireStaff } from "@/lib/staff-auth";

export async function POST(request: Request) {
  try {
    const staff = await requireStaff(request);
    const body = await request.json();
    const token = readRewardQr(String(body.token || ""));
    if (!token) {
      return NextResponse.json({ success: false, error: "This redemption QR is not valid." }, { status: 400 });
    }
    const result = await redeemReward({ token, staffUid: staff.uid });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
