import { NextResponse } from "next/server";
import { getAuthedUser, unauthorized, badRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listLegalEntities } from "@/lib/slash-api";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  return NextResponse.json({
    hasApiKey: !!user.slashApiKey,
    legalEntityId: user.legalEntityId,
    accountId: user.accountId,
    maskedKey: user.slashApiKey
      ? `${user.slashApiKey.slice(0, 8)}...${user.slashApiKey.slice(-4)}`
      : null,
  });
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const { apiKey, legalEntityId, accountId } = await req.json();

  if (apiKey) {
    // Test the key
    try {
      await listLegalEntities(apiKey);
    } catch {
      return badRequest("Invalid API key — could not connect to Slash");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { slashApiKey: apiKey },
    });
  }

  if (legalEntityId !== undefined || accountId !== undefined) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(legalEntityId !== undefined && { legalEntityId }),
        ...(accountId !== undefined && { accountId }),
      },
    });
  }

  return NextResponse.json({ success: true });
}
