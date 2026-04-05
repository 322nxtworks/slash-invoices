import { NextResponse } from "next/server";
import {
  getAuthedUser,
  getUserSlashApiKey,
  unauthorized,
  upstreamError,
} from "@/lib/session";
import { getInvoice } from "@/lib/slash-api";
import { extractSlashInvoiceLink } from "@/lib/slash-invoice-link";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

    if (!isRecord(data)) {
      return NextResponse.json(data);
    }

    return NextResponse.json({
      ...data,
      slashInvoiceLink: extractSlashInvoiceLink(data),
    });
  } catch (error: unknown) {
    return upstreamError(error, "Failed to fetch invoice");
  }
}
