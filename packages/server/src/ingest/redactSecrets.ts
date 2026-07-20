// Enmascara secretos conocidos y números de tarjeta antes de embeber e
// indexar. Deliberadamente NO toca emails ni teléfonos: muchas docs los
// mencionan a propósito como contacto de soporte, y enmascararlos sería
// peor experiencia (el asistente dejaría de poder responder con ellos), no
// más privacidad. Los patrones de token son prefijos específicos de cada
// proveedor (casi sin falsos positivos); una tarjeta necesita además pasar
// Luhn y tener un prefijo de red plausible, porque una tira de 13-19
// dígitos sin más contexto es demasiado común como para enmascararla a
// ciegas (un ISBN, un ticket de soporte, un número de pedido...).

export interface RedactResult {
  text: string;
  count: number;
}

const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g;

// name: solo para que el placeholder diga qué se enmascaró, nunca el valor.
const TOKEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "aws-access-key-id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "gitlab-token", pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g },
  { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  // sk_live_ solo: sk_test_ de Stripe es explícitamente seguro de publicar
  // (lo usan en su propia documentación) — enmascararlo sería ruido.
  { name: "stripe-live-key", pattern: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { name: "openai-or-anthropic-key", pattern: /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: "npm-token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
];

const CARD_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

// Visa, Mastercard (incl. el rango 2-series), Amex, Discover — cubren la
// inmensa mayoría de tarjetas reales sin intentar enumerar cada red.
function hasPlausibleCardPrefix(digits: string): boolean {
  return (
    /^4/.test(digits) ||
    /^5[1-5]/.test(digits) ||
    /^2(?:2[2-9][1-9]|[3-6]\d{2}|7[01]\d|720)/.test(digits) ||
    /^3[47]/.test(digits) ||
    /^6(?:011|5)/.test(digits)
  );
}

export function redactSecrets(text: string): RedactResult {
  let count = 0;

  let result = text.replace(PRIVATE_KEY_BLOCK, () => {
    count++;
    return "[REDACTED:private-key]";
  });

  for (const { name, pattern } of TOKEN_PATTERNS) {
    result = result.replace(pattern, () => {
      count++;
      return `[REDACTED:${name}]`;
    });
  }

  result = result.replace(CARD_CANDIDATE, (match) => {
    const digits = match.replace(/[ -]/g, "");
    if (!hasPlausibleCardPrefix(digits) || !luhnValid(digits)) return match;
    count++;
    return "[REDACTED:card-number]";
  });

  return { text: result, count };
}
