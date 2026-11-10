type LegacyActions = Record<string, unknown>;

function splitArguments(source: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = source.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

function resolveArgument(source: string, element: HTMLElement): unknown {
  if (source === "this") return element;
  if (source === "this.value") return (element as HTMLInputElement).value;
  const dataset = source.match(/^this\.dataset\.([\w$]+)$/);
  if (dataset) return element.dataset[dataset[1]];
  if (/^'.*'$/.test(source)) return source.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  if (/^".*"$/.test(source)) {
    try { return JSON.parse(source); } catch { return source.slice(1, -1); }
  }
  if (source === "true") return true;
  if (source === "false") return false;
  if (source === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(source)) return Number(source);
  return undefined;
}

function splitStatements(source: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) { escaped = false; continue; }
    if (character === "\\") { escaped = true; continue; }
    if (quote) { if (character === quote) quote = ""; continue; }
    if (character === "'" || character === '"') quote = character;
    else if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") depth -= 1;
    else if (character === ";" && depth === 0) {
      statements.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = source.slice(start).trim();
  if (last) statements.push(last);
  return statements;
}

export function dispatchLegacyEvent(event: Event, actions: LegacyActions): void {
  const origin = event.target instanceof Element ? event.target : null;
  const navItem = event.type === "click" ? origin?.closest<HTMLElement>(".nav-item[data-page]") : null;
  if (navItem) {
    const navigate = actions.showPage;
    if (typeof navigate === "function") navigate(navItem.dataset.page);
    return;
  }

  const attribute = `data-legacy-${event.type}`;
  const element = origin?.closest<HTMLElement>(`[${attribute}]`);
  if (!element) return;
  const source = element.getAttribute(attribute) || "";

  for (const statement of splitStatements(source)) {
    const call = statement.match(/^([\w$]+)\s*\(([\s\S]*)\)$/);
    if (!call) continue;
    const action = actions[call[1]];
    if (typeof action !== "function") {
      console.warn(`No existe la acción de AgroSen: ${call[1]}`);
      continue;
    }
    const args = splitArguments(call[2]).map((argument) => resolveArgument(argument, element));
    try {
      void (action as (...values: unknown[]) => unknown)(...args);
    } catch (error) {
      console.error(`Falló la acción ${call[1]}:`, error);
    }
  }
}
