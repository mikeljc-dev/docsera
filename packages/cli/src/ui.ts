// Colores ANSI a pelo: una dependencia de colores no se justifica para esto,
// y el widget/CLI comparten la regla de cero dependencias evitables.
const tty = process.stdout.isTTY ?? false;

const wrap = (code: string) => (text: string) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);

export const bold = wrap("1");
export const dim = wrap("2");
export const red = wrap("31");
export const green = wrap("32");
export const yellow = wrap("33");
export const cyan = wrap("36");
