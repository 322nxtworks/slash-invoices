import { NextResponse } from "next/server";
import {
  getAuthedUser,
  getUserSlashApiKey,
  unauthorized,
  upstreamError,
} from "@/lib/session";
import { getInvoice } from "@/lib/slash-api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const data = await getInvoice(apiKey, id);
    return NextResponse.json(data);
  } catch (error: unknown) {
    return upstreamError(error, "Failed to fetch invoice");
  }
}
