import { NextResponse } from "next/server";
import { getAuthedUser, unauthorized, badRequest } from "@/lib/session";
import { listContacts, createContact } from "@/lib/slash-api";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  if (!user.slashApiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  try {
    const data = await listContacts(user.slashApiKey);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch contacts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  if (!user.slashApiKey) {
    return badRequest("No API key configured");
  }

  try {
    const body = await req.json();
    const { name, recipientLegalName, recipientEmail } = body;

    if (!name || !recipientEmail) {
      return badRequest("Name and email are required");
    }

    const data = await createContact(user.slashApiKey, {
      name,
      recipientLegalName: recipientLegalName || name,
      recipientEmail,
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create contact";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
