import "server-only";

import crypto from "node:crypto";

const ENCRYPTED_PREFIX = "enc:v1:";
const ENCRYPTION_KEY_BYTES = 32;

export class SecretConfigError extends Error {}

function getEncryptionKey(required = false): Buffer | null {
  const rawKey = process.env.APP_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    if (!required) return null;
    throw new SecretConfigError(
      "APP_ENCRYPTION_KEY is required to decrypt stored Slash API keys"
    );
  }

  const base64Key = Buffer.from(rawKey, "base64");
  if (base64Key.length === ENCRYPTION_KEY_BYTES) {
    return base64Key;
  }

  const utf8Key = Buffer.from(rawKey, "utf8");
  if (utf8Key.length === ENCRYPTION_KEY_BYTES) {
    return utf8Key;
  }

  throw new SecretConfigError(
    "APP_ENCRYPTION_KEY must be exactly 32 bytes, either as raw text or base64"
  );
}

export function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  if (!key || !secret || secret.startsWith(ENCRYPTED_PREFIX)) {
    return secret;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, authTag, ciphertext]).toString(
    "base64"
  )}`;
}

export function decryptSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  if (!secret.startsWith(ENCRYPTED_PREFIX)) {
    return secret;
  }

  const key = getEncryptionKey(true);
  if (!key) {
    throw new SecretConfigError(
      "APP_ENCRYPTION_KEY is required to decrypt stored Slash API keys"
    );
  }

  const payload = Buffer.from(secret.slice(ENCRYPTED_PREFIX.length), "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(secret: string | null | undefined): string | null {
  const value = decryptSecret(secret);
  if (!value) return null;

  const prefix = value.slice(0, 8);
  const suffix = value.slice(-4);
  return value.length > 12 ? `${prefix}...${suffix}` : value;
}
