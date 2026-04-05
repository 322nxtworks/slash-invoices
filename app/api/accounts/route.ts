import { NextResponse } from "next/server";
import {
  getAuthedUser,
  getUserSlashApiKey,
  unauthorized,
  upstreamError,
} from "@/lib/session";
import { listAccounts } from "@/lib/slash-api";

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const legalEntityId = url.searchParams.get("legalEntityId") || undefined;
    const data = await listAccounts(apiKey, { legalEntityId });
    return NextResponse.json(data);
  } catch (error: unknown) {
    return upstreamError(error, "Failed to fetch accounts");
  }
}
