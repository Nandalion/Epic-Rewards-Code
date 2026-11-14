import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { apiError } from "@/lib/api-error";
import { issueRewardToken } from "@/lib/loyalty-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const header = request.headers.get("authorization") || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    let authUid: string | null = null;
    if (bearer) {
      const decoded = await getAuth().verifyIdToken(bearer);
      authUid = decoded.uid;
    }
    const result = await issueRewardToken({
      customerCode: String(body.customerCode || ""),
      phone: String(body.phone || ""),
      authUid,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
