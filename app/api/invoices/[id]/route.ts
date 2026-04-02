import { NextResponse } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/session";
import { getInvoice } from "@/lib/slash-api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  if (!user.slashApiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const data = await getInvoice(user.slashApiKey, id);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoice";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
