import { NextResponse } from "next/server";
import { getAuthedUser, unauthorized, upstreamError } from "@/lib/session";
import { getTemplate } from "@/lib/esignatures";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const item = await getTemplate(id);
    return NextResponse.json({ item });
  } catch (error: unknown) {
    return upstreamError(error, "Failed to fetch template details");
  }
}
