import { NextResponse } from "next/server";
import {
  getAuthedUser,
  getUserSlashApiKey,
  unauthorized,
  badRequest,
  upstreamError,
} from "@/lib/session";
import { listContacts, createContact } from "@/lib/slash-api";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
    const search = url.searchParams.get("q")?.trim() || undefined;

    const data = await listContacts(apiKey, {
      legalEntityId: user.legalEntityId || undefined,
      name: search,
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    return upstreamError(error, "Failed to fetch contacts");
  }
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  try {
    const apiKey = getUserSlashApiKey(user);
    if (!apiKey) {
      return badRequest("No API key configured");
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const recipientLegalName =
      typeof body.recipientLegalName === "string"
        ? body.recipientLegalName.trim()
        : "";
    const recipientEmail =
      typeof body.recipientEmail === "string"
        ? body.recipientEmail.trim().toLowerCase()
        : "";

    if (!name || !recipientEmail) {
      return badRequest("Name and email are required");
    }
    if (!isValidEmail(recipientEmail)) {
      return badRequest("Enter a valid billing email address");
    }

    const data = await createContact(apiKey, {
      name,
      recipientLegalName: recipientLegalName || name,
      recipientEmail,
    }, {
      legalEntityId: user.legalEntityId || undefined,
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    return upstreamError(error, "Failed to create contact");
  }
}
