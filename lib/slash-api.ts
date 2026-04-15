const SLASH_BASE = "https://api.joinslash.com";

export const KNOWN_INVOICE_PAYMENT_METHODS = [
  "ach_debit",
  "crypto_deposit",
  "inbound_ach_transfer",
  "inbound_international_wire",
  "inbound_rtp",
  "inbound_wire_transfer",
] as const;

export type InvoicePaymentMethodType =
  (typeof KNOWN_INVOICE_PAYMENT_METHODS)[number];

export interface InvoicePaymentMethod {
  method: InvoicePaymentMethodType;
  config: {
    passFeeToPayer?: boolean;
  };
}

export class SlashApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function slashFetch(
  path: string,
  apiKey: string,
  options?: RequestInit
): Promise<Response> {
  const res = await fetch(`${SLASH_BASE}${path}`, {
    ...options,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SlashApiError(
      `Slash API error ${res.status}: ${body || res.statusText}`,
      res.status
    );
  }

  return res;
}

export async function listLegalEntities(apiKey: string) {
  const res = await slashFetch("/legal-entity", apiKey);
  return res.json();
}

export async function listAccounts(
  apiKey: string,
  params?: { legalEntityId?: string }
) {
  const search = new URLSearchParams();
  if (params?.legalEntityId) {
    search.set("filter:legalEntityId", params.legalEntityId);
  }

  const qs = search.toString();
  const res = await slashFetch(`/account${qs ? `?${qs}` : ""}`, apiKey);
  return res.json();
}

export async function listContacts(
  apiKey: string,
  params?: { legalEntityId?: string; name?: string }
) {
  const search = new URLSearchParams();
  if (params?.legalEntityId) {
    search.set("filter:legalEntityId", params.legalEntityId);
  }
  if (params?.name) {
    search.set("filter:name", params.name);
  }

  const qs = search.toString();
  const res = await slashFetch(`/contact${qs ? `?${qs}` : ""}`, apiKey);
  return res.json();
}

export async function createContact(
  apiKey: string,
  data: {
    name: string;
    recipientLegalName: string;
    recipientEmail: string;
  },
  params?: { legalEntityId?: string }
) {
  const search = new URLSearchParams();
  if (params?.legalEntityId) {
    search.set("filter:legalEntityId", params.legalEntityId);
  }

  const qs = search.toString();
  const res = await slashFetch(`/contact${qs ? `?${qs}` : ""}`, apiKey, {
    method: "POST",
    body: JSON.stringify({ ...data, recipientType: "contact" }),
  });
  return res.json();
}

export async function listInvoices(
  apiKey: string,
  params?: {
    status?: string;
    contactId?: string;
    accountId?: string;
    legalEntityId?: string;
    sort?: string;
    sortDirection?: string;
  }
) {
  const search = new URLSearchParams();
  if (params?.legalEntityId) search.set("filter:legalEntityId", params.legalEntityId);
  if (params?.status) search.set("filter:status", params.status);
  if (params?.contactId) {
    search.set("filter:legalEntityContactId", params.contactId);
  }
  if (params?.accountId) search.set("filter:accountId", params.accountId);
  if (params?.sort) search.set("sort", params.sort);
  if (params?.sortDirection) search.set("sortDirection", params.sortDirection);
  const qs = search.toString();
  const res = await slashFetch(`/invoice${qs ? `?${qs}` : ""}`, apiKey);
  return res.json();
}

export async function getInvoice(apiKey: string, invoiceId: string) {
  const res = await slashFetch(`/invoice/${invoiceId}`, apiKey);
  return res.json();
}

export async function createInvoice(
  apiKey: string,
  data: {
    accountId: string;
    legalEntityContactId: string;
    paymentMethods?: InvoicePaymentMethod[];
    details: {
      issuedAt: string;
      dueAt: string;
      invoiceTz: string;
      lineItemsAndTotals: {
        lineItems: { name: string; quantity: number; priceCents: number }[];
        discount?: { type: "percentage"; percent: number };
        tax?: { type: "percentage"; percent: number };
      };
      invoiceNumber?: string;
      memo?: string;
      version: number;
    };
  }
) {
  const res = await slashFetch("/invoice", apiKey, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getInvoiceSettings(apiKey: string) {
  const res = await slashFetch("/invoice/settings", apiKey);
  return res.json();
}
