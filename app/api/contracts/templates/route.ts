import { NextResponse } from "next/server";
import { getAuthedUser, unauthorized, upstreamError } from "@/lib/session";
import {
  getEsignaturesDefaultTemplateId,
  listTemplates,
} from "@/lib/esignatures";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  try {
    const defaultTemplateId = getEsignaturesDefaultTemplateId();
    const items = await listTemplates();
    const ordered = defaultTemplateId
      ? [...items].sort((a, b) => {
          if (a.template_id === defaultTemplateId) return -1;
          if (b.template_id === defaultTemplateId) return 1;
          return a.title.localeCompare(b.title);
        })
      : items;

    return NextResponse.json({
      defaultTemplateId,
      items: ordered,
    });
  } catch (error: unknown) {
    return upstreamError(error, "Failed to fetch templates");
  }
}
