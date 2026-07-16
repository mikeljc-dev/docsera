const DIACRITICS_PATTERN = /[̀-ͯ]/g;

export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_PATTERN, "");
}
