/**
 * Fee rules. The database computes the same numbers in `public.compute_fees()` when a contract is
 * created, using the row in `platform_settings`, so the fee can change without a code change.
 * This copy lets the UI show a live breakdown before anything is saved.
 */

export interface FeeSettings {
  /** Fee charged to the brand on top of the creator price, in basis points (1000 = 10%). */
  brandFeeBps: number;
  /** Fee deducted from the creator price, in basis points. 0 at launch. */
  creatorFeeBps: number;
  /** GST charged on the platform fee, in basis points (1800 = 18%). */
  gstOnFeeBps: number;
}

export const DEFAULT_FEE_SETTINGS: FeeSettings = {
  brandFeeBps: 1000,
  creatorFeeBps: 0,
  gstOnFeeBps: 1800,
};

export interface FeeBreakdown {
  price: number;
  brandFee: number;
  creatorFee: number;
  platformFee: number;
  gstOnFee: number;
  brandTotal: number;
  creatorPayout: number;
}

const bps = (amount: number, basisPoints: number) => Math.round((amount * basisPoints) / 10_000);

/** `price` is the agreed creator price in paise. */
export function computeFees(
  price: number,
  settings: FeeSettings = DEFAULT_FEE_SETTINGS,
): FeeBreakdown {
  if (!Number.isInteger(price) || price < 0) {
    throw new Error("price must be a non-negative integer number of paise");
  }
  const brandFee = bps(price, settings.brandFeeBps);
  const creatorFee = bps(price, settings.creatorFeeBps);
  const platformFee = brandFee + creatorFee;
  const gstOnFee = bps(platformFee, settings.gstOnFeeBps);
  return {
    price,
    brandFee,
    creatorFee,
    platformFee,
    gstOnFee,
    brandTotal: price + brandFee + gstOnFee,
    creatorPayout: price - creatorFee,
  };
}
