import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { registerCustomer } from "@/lib/loyalty-store";

export async function POST(request: Request) {
  try {
    const { name, phone, consent } = await request.json();
    if (consent !== true) {
      return NextResponse.json({ success: false, error: "Invalid registration details." }, { status: 400 });
    }
    const created = await registerCustomer({ name: String(name || ""), phone: String(phone || "") });
    return NextResponse.json({ success: true, ...created });
  } catch (error) {
    return apiError(error);
  }
}
