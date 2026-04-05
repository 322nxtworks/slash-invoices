import { NextResponse } from "next/server";
import {
  getAuthedUser,
  getUserSlashApiKey,
  unauthorized,
  badRequest,
  upstreamError,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listAccounts, listLegalEntities } from "@/lib/slash-api";
import { encryptSecret, maskSecret } from "@/lib/secrets";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  try {
    return NextResponse.json({
      hasApiKey: !!user.slashApiKey,
      legalEntityId: user.legalEntityId,
      accountId: user.accountId,
      maskedKey: maskSecret(user.slashApiKey),
    });
  } catch (error: unknown) {
    return upstreamError(error, "Failed to load saved Slash settings");
  }
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const apiKey = normalizeOptionalString(body.apiKey);
  const hasApiKeyField = Object.prototype.hasOwnProperty.call(body, "apiKey");
  const hasLegalEntityField = Object.prototype.hasOwnProperty.call(
    body,
    "legalEntityId"
  );
  const hasAccountField = Object.prototype.hasOwnProperty.call(body, "accountId");

  let nextLegalEntityId = hasLegalEntityField
    ? normalizeOptionalString(body.legalEntityId)
    : user.legalEntityId;
  let nextAccountId = hasAccountField
    ? normalizeOptionalString(body.accountId)
    : user.accountId;
  let activeApiKey = apiKey;

  if (apiKey) {
    try {
      await listLegalEntities(apiKey);
    } catch (error: unknown) {
      return error instanceof Error
        ? badRequest(error.message)
        : badRequest("Invalid API key — could not connect to Slash");
    }

    activeApiKey = apiKey;
    if (!hasLegalEntityField) nextLegalEntityId = null;
    if (!hasAccountField) nextAccountId = null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        slashApiKey: encryptSecret(apiKey),
        legalEntityId: nextLegalEntityId,
        accountId: nextAccountId,
      },
    });
  }

  if (hasLegalEntityField || hasAccountField) {
    try {
      if (!activeApiKey) {
        activeApiKey = getUserSlashApiKey(user);
      }
      if (!activeApiKey) {
        return badRequest("Connect a Slash API key before saving preferences");
      }

      if (nextLegalEntityId) {
        const entities = await listLegalEntities(activeApiKey);
        const items = Array.isArray(entities?.items) ? entities.items : [];
        const legalEntityExists = items.some(
          (entity: { id: string }) => entity.id === nextLegalEntityId
        );

        if (!legalEntityExists) {
          return badRequest("Selected legal entity was not found in Slash");
        }
      }

      if (nextAccountId) {
        const accounts = await listAccounts(activeApiKey, {
          legalEntityId: nextLegalEntityId || undefined,
        });
        const items = Array.isArray(accounts?.items) ? accounts.items : [];
        const accountExists = items.some(
          (account: { id: string }) => account.id === nextAccountId
        );

        if (!accountExists) {
          return badRequest("Selected account was not found for this Slash setup");
        }
      }
    } catch (error: unknown) {
      return upstreamError(error, "Failed to validate Slash preferences");
    }

    if (!apiKey) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          legalEntityId: nextLegalEntityId,
          accountId: nextAccountId,
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
