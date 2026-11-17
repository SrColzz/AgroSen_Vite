const formatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2, useGrouping: true });

export function parseLocalizedNumber(value: string): number {
  let text = value.trim().replace(/[^\d.,+-]/g, "");
  if (!text) return NaN;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = text[decimalIndex];
    text = text.split(decimal).join("#").replace(/[.,]/g, "").replace("#", ".");
  } else if (decimalIndex >= 0) {
    const separator = text[decimalIndex];
    const trailingDigits = text.length - decimalIndex - 1;
    const occurrences = [...text].filter((char) => char === separator).length;
    if (trailingDigits > 0 && trailingDigits < 3 && occurrences === 1) {
      text = text.replace(separator, ".");
    } else {
      text = text.split(separator).join("");
    }
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function formatLocalizedNumber(value: string): string {
  const number = parseLocalizedNumber(value);
  return Number.isFinite(number) ? formatter.format(number) : value;
}

export function ungroupNumber(value: string): string {
  const number = parseLocalizedNumber(value);
  return Number.isFinite(number) ? String(number) : value;
}

export function formatNumberWhileTyping(input: HTMLInputElement): void {
  const oldValue = input.value;
  const caret = input.selectionStart ?? oldValue.length;
  const digitsBeforeCaret = (oldValue.slice(0, caret).match(/\d/g) || []).length;
  const trailingSeparator = /[.,]$/.test(oldValue);
  const value = formatLocalizedNumber(oldValue);
  input.value = trailingSeparator && !/[.,]$/.test(value) ? `${value},` : value;
  if (document.activeElement === input) {
    let seen = 0;
    let nextCaret = input.value.length;
    for (let index = 0; index < input.value.length; index += 1) {
      if (/\d/.test(input.value[index])) seen += 1;
      if (seen >= digitsBeforeCaret) { nextCaret = index + 1; break; }
    }
    input.setSelectionRange(nextCaret, nextCaret);
  }
}
