import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { adminOverview } from "@/lib/loyalty-store";
import { requireStaff } from "@/lib/staff-auth";


export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireStaff(request);
    const search = new URL(request.url).searchParams.get("search") || "";
    const result = await adminOverview(search);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
