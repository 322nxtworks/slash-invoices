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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHttpUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
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

  const asUrl = normalizeHttpUrl(value);
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
  for (const path of DIRECT_CANDIDATE_PATHS) {
    const candidate = normalizeHttpUrl(getByPath(payload, path));
    if (candidate) return candidate;
  }

  const candidates: UrlCandidate[] = [];
  collectCandidates(payload, "", 0, candidates);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}
