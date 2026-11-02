import type { PayoutAccountInput } from "@brandjodi/shared";
import { apiRoute } from "@/server/api";
import { savePayoutAccount } from "@/server/services";

/** Saves payout KYC and releases any payouts that were waiting for it. Returns the number released. */
export const POST = apiRoute((actor, body) => savePayoutAccount(actor, body as PayoutAccountInput));
