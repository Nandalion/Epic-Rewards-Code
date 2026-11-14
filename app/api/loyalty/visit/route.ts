import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { creditVisit } from "@/lib/loyalty-store";
import { requireStaff } from "@/lib/staff-auth";

export async function POST(request: Request) {
  try {
    const staff = await requireStaff(request);
    const body = await request.json();
    const result = await creditVisit({
      customerCode: body.customerCode,
      phone: body.phone,
      billReference: String(body.billReference || ""),
      billAmount: Number(body.billAmount),
      staffUid: staff.uid,
    });
    return NextResponse.json({
      success: true,
      customerCode: result.customer.customerCode,
      visitCount: result.visitCount,
      requiredVisits: result.requiredVisits,
      rewardStatus: result.rewardStatus,
      rewardName: result.reward?.rewardName || null,
      visitDate: result.visitDate,
    });
  } catch (error) {
    return apiError(error);
  }
}
