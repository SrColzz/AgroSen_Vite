export type AppPreferences = {
  organizacion?: string;
  zona_horaria?: string;
  moneda?: string;
  unidad_area?: string;
  unidad_peso?: string;
  unidad_volumen?: string;
  tema?: string;
};

export function getAppPreferences(): AppPreferences {
  try { return JSON.parse(localStorage.getItem("agrosen-config") || "{}"); } catch { return {}; }
}

export function getCurrency(): string {
  // Los importes guardados actualmente están en COP y no se convierten por tasa de cambio.
  // Mantener COP evita mostrar, por ejemplo, pesos colombianos con símbolo de USD.
  return "COP";
}

export function formatCurrency(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: getCurrency(), maximumFractionDigits }).format(Number.isFinite(value) ? value : 0);
}

const areaToHectare: Record<string, number> = { ha: 1, "m²": 0.0001, ac: 0.404685642 };
const weightToKilogram: Record<string, number> = { kg: 1, t: 1000, lb: 0.45359237 };
export function getAreaUnit(): string { return getAppPreferences().unidad_area || "ha"; }
export function areaToHa(value: number): number { return value * (areaToHectare[getAreaUnit()] || 1); }
export function areaFromHa(value: number): number { return value / (areaToHectare[getAreaUnit()] || 1); }
export function formatArea(valueHa: number): string {
  const value = areaFromHa(valueHa);
  const decimals = getAreaUnit() === "m²" ? 0 : 2;
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: decimals })} ${getAreaUnit()}`;
}
export function getWeightUnit(): string { return getAppPreferences().unidad_peso || "kg"; }
export function weightToKg(value: number): number { return value * (weightToKilogram[getWeightUnit()] || 1); }
export function weightFromKg(value: number): number { return value / (weightToKilogram[getWeightUnit()] || 1); }
export function formatWeight(valueKg: number): string {
  return `${weightFromKg(valueKg).toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${getWeightUnit()}`;
}
export function getStockWarningPercent(): number {
  try {
    const prefs = JSON.parse(localStorage.getItem("agrosen-alert-preferences") || "[]") as { tipo?: string; activo?: boolean; umbral?: number }[];
    const stock = prefs.find((item) => item.tipo === "Stock bajo");
    if (stock?.activo === false) return 0;
    return Math.max(0, Math.min(100, Number(stock?.umbral) || 0));
  } catch { return 0; }
}
