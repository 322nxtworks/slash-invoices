import { NextResponse } from "next/server";
import {
  getAuthedUser,
  getUserSlashApiKey,
  unauthorized,
  upstreamError,
} from "@/lib/session";
import { getInvoiceSettings } from "@/lib/slash-api";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  try {
    const apiKey = getUserSlashApiKey(user);
    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key configured" },
        { status: 400 }
      );
    }

    const data = await getInvoiceSettings(apiKey);
    return NextResponse.json(data);
  } catch (error: unknown) {
    return upstreamError(error, "Failed to fetch invoice settings");
  }
}
