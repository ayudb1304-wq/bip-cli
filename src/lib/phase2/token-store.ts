import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type StoredToken = {
  key: string;
  token: string;
  expiresAt?: string;
  updatedAt: string;
};

type EncryptedPayload = {
  iv: string;
  authTag: string;
  data: string;
};

function getTokenPath(cwd = process.cwd()): string {
  return path.join(cwd, ".bip", "engine", "tokens.enc.json");
}

function getMasterKey(): Buffer {
  const secret = process.env.BIP_TOKEN_MASTER_KEY;
  if (!secret || secret.trim().length < 16) {
    throw new Error("BIP_TOKEN_MASTER_KEY must be set (min 16 chars) for secure token storage.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plainText: string): EncryptedPayload {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function decrypt(payload: EncryptedPayload): string {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf-8");
}

function readAll(cwd = process.cwd()): StoredToken[] {
  const filePath = getTokenPath(cwd);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const decrypted = decrypt(JSON.parse(raw) as EncryptedPayload);
  return JSON.parse(decrypted) as StoredToken[];
}

function writeAll(tokens: StoredToken[], cwd = process.cwd()): void {
  const filePath = getTokenPath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const encrypted = encrypt(JSON.stringify(tokens));
  fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

function keyFor(repoFullName: string, installationId?: number): string {
  return `${repoFullName}:${installationId ?? "na"}`;
}

export function upsertInstallationToken(
  repoFullName: string,
  token: string,
  options?: { installationId?: number; expiresAt?: string; cwd?: string }
): void {
  const cwd = options?.cwd ?? process.cwd();
  const tokens = readAll(cwd);
  const key = keyFor(repoFullName, options?.installationId);
  const now = new Date().toISOString();
  const withoutExisting = tokens.filter((entry) => entry.key !== key);
  withoutExisting.push({
    key,
    token,
    expiresAt: options?.expiresAt,
    updatedAt: now,
  });
  writeAll(withoutExisting, cwd);
}

export function getInstallationToken(
  repoFullName: string,
  options?: { installationId?: number; cwd?: string }
): string | null {
  const cwd = options?.cwd ?? process.cwd();
  const tokens = readAll(cwd);
  const key = keyFor(repoFullName, options?.installationId);
  const token = tokens.find((entry) => entry.key === key);
  if (!token) return null;
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) return null;
  return token.token;
}
