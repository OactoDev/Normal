// Shared display formatting for the execution views. Values always come from API read-back.
export const money = (minor: number, currency = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
export function duration(fromIso?: string, toIso?: string, now = Date.now()) {
  if (!fromIso) return "";
  const ms = Math.max(0, (toIso ? Date.parse(toIso) : now) - Date.parse(fromIso));
  return ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
}
export const clock = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-GB") : "";
