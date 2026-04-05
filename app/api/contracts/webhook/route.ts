import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEsignaturesWebhookSignature } from "@/lib/esignatures";

function deriveStatus(
  eventStatus: string,
  contractStatus?: string
) {
  if (contractStatus) return contractStatus;

  switch (eventStatus) {
    case "contract-sent-to-signer":
    case "contract-reminder-sent-to-signer":
      return "sent";
    case "contract-signed":
      return "signed";
    case "contract-withdrawn":
      return "withdrawn";
    default:
      return eventStatus;
  }
}

function jsonValueOrUndefined(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export async function POST(req: Request) {
  const signature = req.headers.get("x-signature-sha256");
  const payload = await req.text();

  if (!verifyEsignaturesWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  const status =
    typeof event?.status === "string" ? event.status : "unknown";
  const data =
    typeof event?.data === "object" && event.data !== null
      ? (event.data as Record<string, unknown>)
      : null;
  const contract =
    typeof data?.contract === "object" && data.contract !== null
      ? (data.contract as Record<string, unknown>)
      : null;

  const externalId =
    typeof contract?.id === "string" ? contract.id : null;

  if (!externalId) {
    return NextResponse.json({ received: true });
  }

  const firstSigner =
    Array.isArray(contract?.signers) && contract.signers.length > 0
      ? contract.signers[0]
      : null;
  const signer =
    typeof firstSigner === "object" && firstSigner !== null
      ? (firstSigner as Record<string, unknown>)
      : null;

  await prisma.esignContract.upsert({
    where: { externalId },
    update: {
      status: deriveStatus(
        status,
        typeof contract?.status === "string" ? contract.status : undefined
      ),
      title: typeof contract?.title === "string" ? contract.title : undefined,
      metadata:
        typeof contract?.metadata === "string" ? contract.metadata : undefined,
      pdfUrl:
        typeof contract?.contract_pdf_url === "string"
          ? contract.contract_pdf_url
          : undefined,
      signerName: typeof signer?.name === "string" ? signer.name : undefined,
      signerEmail: typeof signer?.email === "string" ? signer.email : undefined,
      signerMobile:
        typeof signer?.mobile === "string" ? signer.mobile : undefined,
      signerCompanyName:
        typeof signer?.company_name === "string"
          ? signer.company_name
          : undefined,
      signerFieldValues:
        typeof signer?.signer_field_values === "object" &&
        signer.signer_field_values !== null
          ? jsonValueOrUndefined(signer.signer_field_values)
          : undefined,
      rawResponse: jsonValueOrUndefined(body),
    },
    create: {
      externalId,
      templateId: "unknown",
      title:
        typeof contract?.title === "string"
          ? contract.title
          : "eSignatures Contract",
      status: deriveStatus(
        status,
        typeof contract?.status === "string" ? contract.status : undefined
      ),
      source:
        typeof contract?.source === "string" ? contract.source : undefined,
      testMode: contract?.test === "yes",
      isDraft: false,
      metadata:
        typeof contract?.metadata === "string" ? contract.metadata : undefined,
      signerName: typeof signer?.name === "string" ? signer.name : undefined,
      signerEmail: typeof signer?.email === "string" ? signer.email : undefined,
      signerMobile:
        typeof signer?.mobile === "string" ? signer.mobile : undefined,
      signerCompanyName:
        typeof signer?.company_name === "string"
          ? signer.company_name
          : undefined,
      pdfUrl:
        typeof contract?.contract_pdf_url === "string"
          ? contract.contract_pdf_url
          : undefined,
      signerFieldValues:
        typeof signer?.signer_field_values === "object" &&
        signer.signer_field_values !== null
          ? jsonValueOrUndefined(signer.signer_field_values)
          : undefined,
      rawResponse: jsonValueOrUndefined(body),
    },
  });

  return NextResponse.json({ received: true });
}
