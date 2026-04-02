import { NextResponse } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/session";
import { listAccounts } from "@/lib/slash-api";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  if (!user.slashApiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  try {
    const data = await listAccounts(user.slashApiKey);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch accounts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
