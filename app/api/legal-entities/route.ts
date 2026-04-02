import { NextResponse } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/session";
import { listLegalEntities } from "@/lib/slash-api";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  if (!user.slashApiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  try {
    const data = await listLegalEntities(user.slashApiKey);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch legal entities";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
