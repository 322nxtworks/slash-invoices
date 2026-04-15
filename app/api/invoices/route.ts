import { NextResponse } from "next/server";
import {
  getAuthedUser,
  getUserSlashApiKey,
  unauthorized,
  badRequest,
  upstreamError,
} from "@/lib/session";
import {
  listInvoices,
  createInvoice,
  getInvoiceSettings,
  KNOWN_INVOICE_PAYMENT_METHODS,
  type InvoicePaymentMethod,
  type InvoicePaymentMethodType,
} from "@/lib/slash-api";
import { extractSlashInvoiceLink } from "@/lib/slash-invoice-link";
import { DEFAULT_INVOICE_TIME_ZONE } from "@/lib/utils";

const DEFAULT_NON_CRYPTO_PAYMENT_METHOD: InvoicePaymentMethodType =
  "inbound_ach_transfer";
const CRYPTO_PAYMENT_METHOD: InvoicePaymentMethodType = "crypto_deposit";

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownPaymentMethod(
  value: unknown
): value is InvoicePaymentMethodType {
  return (
    typeof value === "string" &&
    KNOWN_INVOICE_PAYMENT_METHODS.includes(value as InvoicePaymentMethodType)
  );
}

function parsePaymentMethodList(value: unknown): InvoicePaymentMethod[] {
  if (!Array.isArray(value)) return [];

  const parsed: InvoicePaymentMethod[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isKnownPaymentMethod(item.method)) continue;

    const method: InvoicePaymentMethod = {
      method: item.method,
      config: {},
    };
    if (isRecord(item.config) && typeof item.config.passFeeToPayer === "boolean") {
      method.config.passFeeToPayer = item.config.passFeeToPayer;
    }
    parsed.push(method);
  }
  return parsed;
}

function extractInvoicePaymentMethods(settingsData: unknown): InvoicePaymentMethod[] {
  if (!isRecord(settingsData)) return [];

  const candidates: unknown[] = [settingsData.paymentMethods];

  if (isRecord(settingsData.settings)) {
    candidates.push(settingsData.settings.paymentMethods);
    candidates.push(settingsData.settings.defaultPaymentMethods);
  }
  if (isRecord(settingsData.invoiceSettings)) {
    candidates.push(settingsData.invoiceSettings.paymentMethods);
    if (isRecord(settingsData.invoiceSettings.settings)) {
      candidates.push(settingsData.invoiceSettings.settings.paymentMethods);
      candidates.push(settingsData.invoiceSettings.settings.defaultPaymentMethods);
    }
  }

  const deduped = new Map<InvoicePaymentMethodType, InvoicePaymentMethod>();
  for (const candidate of candidates) {
    for (const method of parsePaymentMethodList(candidate)) {
      deduped.set(method.method, method);
    }
  }

  return Array.from(deduped.values());
}

function buildInvoicePaymentMethods(
  settingsData: unknown,
  includeCrypto: boolean
): InvoicePaymentMethod[] {
  const configured = extractInvoicePaymentMethods(settingsData);
  const withoutCrypto = configured.filter(
    (method) => method.method !== CRYPTO_PAYMENT_METHOD
  );
  const baseMethods: InvoicePaymentMethod[] =
    withoutCrypto.length > 0
      ? withoutCrypto
      : [{ method: DEFAULT_NON_CRYPTO_PAYMENT_METHOD, config: {} }];

  if (!includeCrypto) {
    return baseMethods;
  }

  return [...baseMethods, { method: CRYPTO_PAYMENT_METHOD, config: {} }];
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

    if (!isRecord(data)) {
      return NextResponse.json(data);
    }

    const response: Record<string, unknown> = {
      ...data,
      slashInvoiceLink: extractSlashInvoiceLink(data),
    };

    if (Array.isArray(data.items)) {
      response.items = data.items.map((item) => {
        if (!isRecord(item)) return item;
        return {
          ...item,
          slashInvoiceLink: extractSlashInvoiceLink(item),
        };
      });
    }

    return NextResponse.json(response);
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
      includeCrypto,
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
    const normalizedIncludeCrypto = includeCrypto === true;
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

    const invoiceSettings = await getInvoiceSettings(apiKey).catch(() => null);
    const data = await createInvoice(apiKey, {
      accountId: user.accountId,
      legalEntityContactId: normalizedContactId,
      paymentMethods: buildInvoicePaymentMethods(
        invoiceSettings,
        normalizedIncludeCrypto
      ),
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

    if (!isRecord(data)) {
      return NextResponse.json(data);
    }

    return NextResponse.json({
      ...data,
      slashInvoiceLink: extractSlashInvoiceLink(data),
    });
  } catch (error: unknown) {
    return upstreamError(error, "Failed to create invoice");
  }
}
