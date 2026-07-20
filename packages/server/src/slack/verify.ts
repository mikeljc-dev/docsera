import { createHmac, timingSafeEqual } from "node:crypto";

// Recomendación explícita de los docs de firma de Slack: rechazar timestamps
// con más de 5 minutos de diferencia respecto al reloj del server, para que
// una petición capturada no se pueda reproducir más tarde.
const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signatureHeader: string,
): boolean {
  const requestTime = Number(timestamp);
  if (!Number.isFinite(requestTime)) return false;
  if (Math.abs(Date.now() / 1000 - requestTime) > MAX_TIMESTAMP_SKEW_SECONDS) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + createHmac("sha256", signingSecret).update(baseString).digest("hex");

  const expectedBuf = Buffer.from(expected, "utf-8");
  const actualBuf = Buffer.from(signatureHeader, "utf-8");
  // timingSafeEqual exige buffers del mismo tamaño; una firma con la
  // longitud equivocada ya es inválida sin necesidad de compararla.
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
