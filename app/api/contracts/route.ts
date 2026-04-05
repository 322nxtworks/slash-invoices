import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  getAuthedUser,
  unauthorized,
  upstreamError,
} from "@/lib/session";
import { createContract, getTemplate } from "@/lib/esignatures";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isRecord(
  value: unknown
): value is Record<string, string | number | boolean | null | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKeyValueMap(value: unknown) {
  if (!isRecord(value)) return {} as Record<string, string>;

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, raw]) => {
    if (typeof raw !== "string") return acc;

    const normalizedValue = raw.trim();
    if (!normalizedValue) return acc;

    acc[key] = normalizedValue;
    return acc;
  }, {});
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildDefaultTitle(templateTitle: string, signerName: string) {
  const date = new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  return `${templateTitle} - ${signerName} - ${date}`;
}

function jsonValueOrUndefined(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const items = await prisma.esignContract.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdByUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const templateId = normalizeOptionalString(body.templateId);
    const title = normalizeOptionalString(body.title);
    const metadata = normalizeOptionalString(body.metadata);
    const signerName = normalizeOptionalString(body.signerName);
    const signerEmail = normalizeOptionalString(body.signerEmail)?.toLowerCase();
    const signerMobile = normalizeOptionalString(body.signerMobile);
    const signerCompanyName = normalizeOptionalString(body.signerCompanyName);
    const saveAsDraft = body.saveAsDraft !== false;
    const placeholderValues = normalizeKeyValueMap(body.placeholderValues);
    const signerFieldDefaults = normalizeKeyValueMap(body.signerFieldDefaults);

    if (!templateId) {
      return badRequest("Choose a template first");
    }
    if (!signerName) {
      return badRequest("Signer name is required");
    }
    if (!signerEmail && !signerMobile) {
      return badRequest("Add at least an email or mobile number for the signer");
    }
    if (signerEmail && !isValidEmail(signerEmail)) {
      return badRequest("Enter a valid signer email address");
    }

    const template = await getTemplate(templateId);
    const allowedPlaceholders = new Set(template.placeholder_fields || []);
    const allowedSignerFields = new Set(template.signer_field_ids || []);

    const invalidPlaceholder = Object.keys(placeholderValues).find(
      (key) => !allowedPlaceholders.has(key)
    );
    if (invalidPlaceholder) {
      return badRequest(`Unknown placeholder field: ${invalidPlaceholder}`);
    }

    const invalidSignerField = Object.keys(signerFieldDefaults).find(
      (key) => !allowedSignerFields.has(key)
    );
    if (invalidSignerField) {
      return badRequest(`Unknown signer field: ${invalidSignerField}`);
    }

    const nextTitle = title || buildDefaultTitle(template.title, signerName);
    const response = await createContract({
      template_id: templateId,
      title: nextTitle,
      metadata,
      test: "no",
      save_as_draft: saveAsDraft ? "yes" : "no",
      signers: [
        {
          name: signerName,
          ...(signerEmail ? { email: signerEmail } : {}),
          ...(signerMobile ? { mobile: signerMobile } : {}),
          ...(signerCompanyName ? { company_name: signerCompanyName } : {}),
        },
      ],
      ...(Object.keys(placeholderValues).length > 0
        ? {
            placeholder_fields: Object.entries(placeholderValues).map(
              ([placeholder_key, value]) => ({
                placeholder_key,
                value,
              })
            ),
          }
        : {}),
      ...(Object.keys(signerFieldDefaults).length > 0
        ? {
            signer_fields: Object.entries(signerFieldDefaults).map(
              ([signer_field_id, default_value]) => ({
                signer_field_id,
                default_value,
              })
            ),
          }
        : {}),
    });

    const contract = response.data.contract;
    const firstSigner = contract.signers?.[0];

    const item = await prisma.esignContract.create({
      data: {
        externalId: contract.id,
        templateId,
        templateTitle: template.title,
        title: contract.title || nextTitle,
        status:
          typeof contract.status === "string"
            ? contract.status
            : saveAsDraft
              ? "draft"
              : "sent",
        source: contract.source || "api",
        testMode: contract.test === "yes",
        isDraft: saveAsDraft,
        metadata,
        createdByUserId: user.id,
        signerName: firstSigner?.name || signerName,
        signerEmail: firstSigner?.email || signerEmail,
        signerMobile: firstSigner?.mobile || signerMobile,
        signerCompanyName: firstSigner?.company_name || signerCompanyName,
        signPageUrl: firstSigner?.sign_page_url,
        pdfUrl: contract.contract_pdf_url,
        placeholderValues:
          Object.keys(placeholderValues).length > 0
            ? jsonValueOrUndefined(placeholderValues)
            : undefined,
        signerFieldDefaults:
          Object.keys(signerFieldDefaults).length > 0
            ? jsonValueOrUndefined(signerFieldDefaults)
            : undefined,
        signerFieldValues: jsonValueOrUndefined(firstSigner?.signer_field_values),
        rawResponse: jsonValueOrUndefined(response),
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ item });
  } catch (error: unknown) {
    return upstreamError(error, "Failed to create contract");
  }
}
