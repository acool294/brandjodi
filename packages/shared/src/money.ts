/** All money is stored as integer paise (1 rupee = 100 paise). */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatINR(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return inr.format(paise / 100);
}
