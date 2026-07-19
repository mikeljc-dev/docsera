import { createPublicKey, verify } from "node:crypto";

// Discord firma cada interacción con Ed25519 y exige rechazar las firmas
// inválidas (lo comprueba activamente al validar el endpoint). node:crypto
// verifica Ed25519 de serie; solo hay que envolver la clave cruda de 32
// bytes que da el portal de Discord en la cabecera DER/SPKI que espera
// createPublicKey.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifyDiscordSignature(
  publicKeyHex: string,
  timestamp: string,
  rawBody: string,
  signatureHex: string,
): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(
      null,
      Buffer.from(timestamp + rawBody, "utf-8"),
      publicKey,
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    // Clave o firma con formato roto (hex inválido, longitud incorrecta):
    // equivale a firma inválida, nunca a un 500.
    return false;
  }
}
