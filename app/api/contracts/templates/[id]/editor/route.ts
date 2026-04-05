import { NextResponse } from "next/server";
import {
  getAuthedUser,
  unauthorized,
  upstreamError,
} from "@/lib/session";
import { getOrCreateTemplateEditorUrl } from "@/lib/esignatures";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const displayName = user.name?.trim() || user.email;
    const editorUrl = await getOrCreateTemplateEditorUrl(id, {
      name: displayName,
    });

    return NextResponse.json({ editorUrl });
  } catch (error: unknown) {
    return upstreamError(error, "Failed to open the template editor");
  }
}
