import { NextResponse } from "next/server";
import { LoyaltyError } from "@/lib/loyalty-store";

export function apiError(error: unknown) {
  if (error instanceof LoyaltyError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ success: false, error: "Something went wrong." }, { status: 500 });
}
