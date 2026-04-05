import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const globalForSchema = globalThis as unknown as {
  ensureEsignContractTablePromise?: Promise<void>;
};

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function createEsignContractTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EsignContract" (
      "id" TEXT NOT NULL,
      "externalId" TEXT NOT NULL,
      "templateId" TEXT NOT NULL,
      "templateTitle" TEXT,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "source" TEXT,
      "testMode" BOOLEAN NOT NULL DEFAULT false,
      "isDraft" BOOLEAN NOT NULL DEFAULT true,
      "metadata" TEXT,
      "createdByUserId" TEXT,
      "signerName" TEXT,
      "signerEmail" TEXT,
      "signerMobile" TEXT,
      "signerCompanyName" TEXT,
      "signPageUrl" TEXT,
      "pdfUrl" TEXT,
      "placeholderValues" JSONB,
      "signerFieldDefaults" JSONB,
      "signerFieldValues" JSONB,
      "rawResponse" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EsignContract_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "EsignContract_createdByUserId_fkey"
        FOREIGN KEY ("createdByUserId")
        REFERENCES "User"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "EsignContract_externalId_key"
    ON "EsignContract"("externalId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EsignContract_createdAt_idx"
    ON "EsignContract"("createdAt" DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EsignContract_createdByUserId_idx"
    ON "EsignContract"("createdByUserId")
  `);
}

export async function ensureEsignContractTable() {
  if (!globalForSchema.ensureEsignContractTablePromise) {
    globalForSchema.ensureEsignContractTablePromise = createEsignContractTable()
      .catch((error) => {
        globalForSchema.ensureEsignContractTablePromise = undefined;
        throw error;
      });
  }

  await globalForSchema.ensureEsignContractTablePromise;
}
