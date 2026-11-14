import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { customerProgress } from "@/lib/loyalty-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const progress = await customerProgress({
      customerCode: String(searchParams.get("customerCode") || ""),
      phone: String(searchParams.get("phone") || ""),
    });
    return NextResponse.json({ success: true, ...progress });
  } catch (error) {
    return apiError(error);
  }
}
