import crypto from "node:crypto";

/**
 * Encriptación simétrica AES-256-GCM para guardar el access token de MP en la DB.
 *
 * Usa ENCRYPTION_KEY (32 bytes base64). Si no está, lanza un error claro.
 *
 * Formato del string resultante: iv_base64:authTag_base64:ciphertext_base64
 */

const ALGO = "aes-256-gcm";

function obtenerKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta ENCRYPTION_KEY en las variables de entorno. " +
        "Generá una con: openssl rand -base64 32"
    );
  }
  // Aceptamos tanto base64 como hex o texto plano; la pasamos a 32 bytes con SHA-256.
  return crypto.createHash("sha256").update(raw).digest();
}

export function encriptar(plaintext: string): string {
  const key = obtenerKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function desencriptar(payload: string): string {
  const key = obtenerKey();
  const [ivB64, tagB64, ctB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Payload encriptado con formato inválido.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
