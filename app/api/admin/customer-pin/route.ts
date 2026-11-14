import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { shareLoginPin } from "@/lib/loyalty-store";
import { requireStaff } from "@/lib/staff-auth";

export async function POST(request: Request) {
  try {
    await requireStaff(request);
    const body = await request.json();
    const result = await shareLoginPin(String(body.customerCode || ""));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
