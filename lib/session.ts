import { getServerSession } from "next-auth";
import type { User } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SecretConfigError, decryptSecret } from "@/lib/secrets";
import { ESignaturesConfigError } from "@/lib/esignatures";

export async function getAuthedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  return user;
}

export function getUserSlashApiKey(user: Pick<User, "slashApiKey">) {
  return decryptSecret(user.slashApiKey);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function upstreamError(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error ? error.message : fallbackMessage;
  const status =
    error instanceof SecretConfigError || error instanceof ESignaturesConfigError
      ? 500
      : 502;

  return NextResponse.json({ error: message }, { status });
}
