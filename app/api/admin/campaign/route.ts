import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { saveCampaign } from "@/lib/loyalty-store";
import { requireStaff } from "@/lib/staff-auth";

export async function PUT(request: Request) {
  try {
    await requireStaff(request);
    const body = await request.json();
    const campaign = await saveCampaign({
      name: body.name,
      requiredVisits: Number(body.requiredVisits),
      minimumBillAmount: Number(body.minimumBillAmount),
      rewardType: body.rewardType,
      rewardName: body.rewardName,
      rewardItemId: body.rewardItemId,
      validity: body.validity ? String(body.validity) : null,
      status: body.status === "inactive" ? "inactive" : "active",
    });
    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    return apiError(error);
  }
}
