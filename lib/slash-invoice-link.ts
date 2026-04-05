const DIRECT_CANDIDATE_PATHS = [
  "invoice.invoiceUrl",
  "invoice.publicInvoiceUrl",
  "invoice.hostedInvoiceUrl",
  "invoice.paymentUrl",
  "invoice.paymentLink",
  "invoice.link",
  "invoice.url",
  "invoiceDetails.invoiceUrl",
  "invoiceDetails.publicInvoiceUrl",
  "invoiceDetails.hostedInvoiceUrl",
  "invoiceDetails.paymentUrl",
  "invoiceDetails.paymentLink",
  "invoiceDetails.link",
  "invoiceDetails.url",
  "links.invoice",
  "links.payment",
  "links.public",
  "invoice.links.invoice",
  "invoice.links.payment",
  "invoice.links.public",
] as const;

const DOCUMENT_ID_PATHS = [
  "invoiceDetails.documentId",
  "documentId",
  "invoice.documentId",
] as const;

const INVOICE_ID_PATHS = ["invoice.id", "id"] as const;

const PATH_HINTS = [
  "invoice",
  "payment",
  "collect",
  "checkout",
  "hosted",
  "public",
  "link",
  "url",
] as const;

const SLASH_HOST_HINTS = [".slash.com", "slash.com", ".joinslash.com", "joinslash.com"] as const;
const APP_SLASH_ORIGIN = "https://app.slash.com";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSlashHost(hostname: string) {
  const host = hostname.toLowerCase();
  return SLASH_HOST_HINTS.some((suffix) => host === suffix || host.endsWith(suffix));
}

function getByPath(value: unknown, path: string) {
  const segments = path.split(".");
  let current: unknown = value;

  for (const segment of segments) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }

  return current;
}

function getFirstStringByPath(value: unknown, paths: readonly string[]) {
  for (const path of paths) {
    const candidate = getByPath(value, path);
    if (typeof candidate !== "string") continue;

    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

function normalizeSlashUrlInternal(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!isSlashHost(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeSlashUrl(value: unknown) {
  return normalizeSlashUrlInternal(value);
}

type InvoiceLinkIdentifiers = {
  documentId?: string | null;
  invoiceId?: string | null;
};

export function buildSlashInvoiceLinkFromIdentifiers({
  documentId,
  invoiceId,
}: InvoiceLinkIdentifiers) {
  const normalizedDocumentId =
    typeof documentId === "string" && documentId.trim()
      ? documentId.trim()
      : null;
  const normalizedInvoiceId =
    typeof invoiceId === "string" && invoiceId.trim() ? invoiceId.trim() : null;

  if (normalizedDocumentId) {
    const encodedDocumentId = encodeURIComponent(normalizedDocumentId);
    return `${APP_SLASH_ORIGIN}/invoice/${encodedDocumentId}`;
  }

  if (normalizedInvoiceId) {
    const encodedInvoiceId = encodeURIComponent(normalizedInvoiceId);
    return `${APP_SLASH_ORIGIN}/invoice/${encodedInvoiceId}`;
  }

  return null;
}

function hasPathHint(path: string) {
  const normalized = path.toLowerCase();
  return PATH_HINTS.some((hint) => normalized.includes(hint));
}

function scoreCandidate(url: string, path: string) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const normalizedPath = path.toLowerCase();

  let score = 0;

  if (host.includes("joinslash")) score += 120;
  if (host.includes("slash")) score += 60;
  if (pathname.includes("invoice")) score += 70;
  if (pathname.includes("payment") || pathname.includes("pay")) score += 30;
  if (hasPathHint(normalizedPath)) score += 30;
  if (pathname === "/invoicing" || pathname === "/invoice") score -= 80;
  if (normalizedPath.includes("pdf")) score -= 40;
  if (host.startsWith("api.")) score -= 60;

  return score;
}

type UrlCandidate = {
  url: string;
  path: string;
  score: number;
};

function collectCandidates(
  value: unknown,
  path: string,
  depth: number,
  candidates: UrlCandidate[]
) {
  if (depth > 7 || value === null || value === undefined) return;

  const asUrl = normalizeSlashUrlInternal(value);
  if (asUrl) {
    const candidate = {
      url: asUrl,
      path,
      score: scoreCandidate(asUrl, path),
    };
    if (candidate.score > 0) {
      candidates.push(candidate);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectCandidates(entry, `${path}[${index}]`, depth + 1, candidates);
    });
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    collectCandidates(entry, nextPath, depth + 1, candidates);
  }
}

export function extractSlashInvoiceLink(payload: unknown) {
  const documentId = getFirstStringByPath(payload, DOCUMENT_ID_PATHS);
  const invoiceId = getFirstStringByPath(payload, INVOICE_ID_PATHS);
  const generatedFromIdentifiers = buildSlashInvoiceLinkFromIdentifiers({
    documentId,
    invoiceId,
  });

  for (const path of DIRECT_CANDIDATE_PATHS) {
    const candidate = normalizeSlashUrlInternal(getByPath(payload, path));
    if (!candidate) continue;

    const candidateLower = candidate.toLowerCase();
    const hasDocumentId =
      typeof documentId === "string" &&
      documentId.length > 0 &&
      candidateLower.includes(documentId.toLowerCase());
    const hasInvoiceId =
      typeof invoiceId === "string" &&
      invoiceId.length > 0 &&
      candidateLower.includes(invoiceId.toLowerCase());

    if (hasDocumentId || hasInvoiceId) {
      return candidate;
    }
  }

  const candidates: UrlCandidate[] = [];
  collectCandidates(payload, "", 0, candidates);

  if (candidates.length === 0) return generatedFromIdentifiers;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]?.url || null;

  if (generatedFromIdentifiers) {
    const normalizedGenerated = generatedFromIdentifiers.toLowerCase();
    const bestLower = best?.toLowerCase() || "";
    const looksGenericDashboard =
      bestLower.endsWith("/invoicing") || bestLower.endsWith("/invoice");

    if (!best || looksGenericDashboard || !bestLower.includes(normalizedGenerated.split("/").pop() || "")) {
      return generatedFromIdentifiers;
    }
  }

  return best;
}
