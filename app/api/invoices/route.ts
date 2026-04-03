import { NextResponse } from "next/server";
import { getAuthedUser, unauthorized, badRequest } from "@/lib/session";
import { listInvoices, createInvoice } from "@/lib/slash-api";

export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  if (!user.slashApiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const contactId = url.searchParams.get("contactId") || undefined;
    const sortBy = url.searchParams.get("sortBy") || undefined;
    const sortDirection = url.searchParams.get("sortDirection") || undefined;

    const data = await listInvoices(user.slashApiKey, {
      status,
      contactId,
      sortBy,
      sortDirection,
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoices";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  if (!user.slashApiKey) {
    return badRequest("No API key configured");
  }
  if (!user.accountId) {
    return badRequest("No account selected — go to Settings first");
  }

  try {
    const body = await req.json();
    const {
      legalEntityContactId,
      issuedAt,
      dueAt,
      lineItems,
      discount,
      tax,
      invoiceNumber,
      memo,
    } = body;

    if (!legalEntityContactId || !lineItems?.length) {
      return badRequest("Contact and at least one line item are required");
    }

    const data = await createInvoice(user.slashApiKey, {
      accountId: user.accountId,
      legalEntityContactId,
      details: {
        issuedAt,
        dueAt,
        invoiceTz: "Australia/Perth",
        lineItemsAndTotals: {
          lineItems,
          ...(discount && discount > 0
            ? { discount: { type: "percentage", percent: discount } }
            : {}),
          ...(tax && tax > 0
            ? { tax: { type: "percentage", percent: tax } }
            : {}),
        },
        invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
        ...(memo ? { memo } : {}),
        version: 2,
      },
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
