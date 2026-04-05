import { NextResponse } from "next/server";
import {
  getAuthedUser,
  getUserSlashApiKey,
  unauthorized,
  badRequest,
  upstreamError,
} from "@/lib/session";
import { listInvoices, createInvoice } from "@/lib/slash-api";
import { DEFAULT_INVOICE_TIME_ZONE } from "@/lib/utils";

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
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
    const status = url.searchParams.get("status") || undefined;
    const contactId = url.searchParams.get("contactId") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const sortDirection = url.searchParams.get("sortDirection") || undefined;

    const data = await listInvoices(apiKey, {
      status,
      contactId,
      accountId: user.accountId || undefined,
      legalEntityId: user.legalEntityId || undefined,
      sort,
      sortDirection,
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    return upstreamError(error, "Failed to fetch invoices");
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
    if (!user.accountId) {
      return badRequest("No account selected — go to Settings first");
    }

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

    const normalizedContactId =
      typeof legalEntityContactId === "string"
        ? legalEntityContactId.trim()
        : "";
    const normalizedIssuedAt = normalizeDate(issuedAt);
    const normalizedDueAt = normalizeDate(dueAt);
    const normalizedInvoiceNumber = normalizeOptionalText(invoiceNumber);
    const normalizedMemo = normalizeOptionalText(memo);
    const normalizedDiscount =
      typeof discount === "number" && Number.isFinite(discount)
        ? discount
        : undefined;
    const normalizedTax =
      typeof tax === "number" && Number.isFinite(tax) ? tax : undefined;
    const normalizedLineItems = Array.isArray(lineItems)
      ? lineItems
          .map((item) => {
            const name =
              typeof item?.name === "string" ? item.name.trim() : "";
            const quantity = Number(item?.quantity);
            const priceCents = Number(item?.priceCents);

            if (
              !name ||
              !Number.isInteger(quantity) ||
              quantity <= 0 ||
              !Number.isInteger(priceCents) ||
              priceCents < 0
            ) {
              return null;
            }

            return { name, quantity, priceCents };
          })
          .filter((item): item is { name: string; quantity: number; priceCents: number } => Boolean(item))
      : [];

    if (!normalizedContactId || normalizedLineItems.length === 0) {
      return badRequest("Contact and at least one line item are required");
    }
    if (!normalizedIssuedAt || !normalizedDueAt) {
      return badRequest("Issue date and due date must be valid dates");
    }
    if (normalizedDueAt < normalizedIssuedAt) {
      return badRequest("Due date must be on or after the issue date");
    }
    if (
      normalizedDiscount !== undefined &&
      (normalizedDiscount < 0 || normalizedDiscount > 100)
    ) {
      return badRequest("Discount must be between 0 and 100");
    }
    if (normalizedTax !== undefined && (normalizedTax < 0 || normalizedTax > 100)) {
      return badRequest("Tax must be between 0 and 100");
    }

    const data = await createInvoice(apiKey, {
      accountId: user.accountId,
      legalEntityContactId: normalizedContactId,
      details: {
        issuedAt: normalizedIssuedAt,
        dueAt: normalizedDueAt,
        invoiceTz: DEFAULT_INVOICE_TIME_ZONE,
        lineItemsAndTotals: {
          lineItems: normalizedLineItems,
          ...(normalizedDiscount !== undefined && normalizedDiscount > 0
            ? { discount: { type: "percentage", percent: normalizedDiscount } }
            : {}),
          ...(normalizedTax !== undefined && normalizedTax > 0
            ? { tax: { type: "percentage", percent: normalizedTax } }
            : {}),
        },
        invoiceNumber: normalizedInvoiceNumber || `INV-${Date.now()}`,
        ...(normalizedMemo ? { memo: normalizedMemo } : {}),
        version: 2,
      },
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    return upstreamError(error, "Failed to create invoice");
  }
}
