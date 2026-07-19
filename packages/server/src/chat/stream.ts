import { isNoAnswer, noAnswerText } from "./prompt.js";

// El centinela de no-respuesta llega troceado como cualquier otro texto:
// emitir el primer fragmento a ciegas pintaría "NO_ANS..." en la burbuja
// antes de poder rectificar. Se retienen los primeros caracteres —de sobra
// para el centinela incluso decorado ("**NO_ANSWER**")— y solo entonces se
// empieza a emitir. Una vez superado ese umbral la respuesta ya no puede
// ser el centinela, así que el resto fluye sin retención.
const HOLD_CHARS = 32;

export async function* streamAnswer(deltas: AsyncIterable<string>): AsyncGenerator<string> {
  let held = "";
  let flushed = false;

  for await (const delta of deltas) {
    if (flushed) {
      yield delta;
      continue;
    }
    held += delta;
    if (held.length >= HOLD_CHARS) {
      flushed = true;
      yield held;
    }
  }

  if (flushed) return;

  // Una respuesta vacía es un fallo del proveedor, pero para el usuario se
  // comporta mejor como "no lo sé": queda registrada como no respondida y
  // aparece en el filtro del dashboard en vez de como burbuja en blanco.
  yield !held.trim() || isNoAnswer(held) ? noAnswerText() : held;
}
