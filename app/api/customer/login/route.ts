import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { loginWithPin } from "@/lib/loyalty-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customer = await loginWithPin(String(body.phone || ""), String(body.pin || ""));
    return NextResponse.json({ success: true, ...customer });
  } catch (error) {
    return apiError(error);
  }
}
