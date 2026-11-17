// Prices travel as decimal strings and are settled as integer micro-units (CCD and the PLT stablecoins use 6 decimals).
const RE = /^\d+(\.\d{1,6})?$/;
export const DECIMALS = 6;
const SCALE = 10n ** BigInt(DECIMALS);

export function toMicro(s) {
  if (typeof s !== "string" || !RE.test(s)) throw new Error(`invalid amount "${s}" (max ${DECIMALS} decimals)`);
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * SCALE + BigInt(frac.padEnd(DECIMALS, "0"));
}

export function fromMicro(n) {
  const whole = n / SCALE;
  const frac = (n % SCALE).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function totalMicro({ unit_price, quantity }) {
  return toMicro(unit_price) * BigInt(quantity);
}
