import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthedUser,
  unauthorized,
  upstreamError,
} from "@/lib/session";
import { getContract } from "@/lib/esignatures";

function jsonValueOrUndefined(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await prisma.esignContract.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const contract = await getContract(existing.externalId);
    const firstSigner = contract.signers?.[0];

    const item = await prisma.esignContract.update({
      where: { id },
      data: {
        title: contract.title || existing.title,
        status: contract.status || existing.status,
        source: contract.source || existing.source,
        testMode: contract.test === "yes",
        signPageUrl: firstSigner?.sign_page_url || existing.signPageUrl,
        signerName: firstSigner?.name || existing.signerName,
        signerEmail: firstSigner?.email || existing.signerEmail,
        signerMobile: firstSigner?.mobile || existing.signerMobile,
        signerCompanyName:
          firstSigner?.company_name || existing.signerCompanyName,
        signerFieldValues:
          jsonValueOrUndefined(firstSigner?.signer_field_values) ??
          jsonValueOrUndefined(existing.signerFieldValues),
        pdfUrl: contract.contract_pdf_url || existing.pdfUrl,
        rawResponse: jsonValueOrUndefined(contract),
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
    return upstreamError(error, "Failed to refresh contract");
  }
}
