import type { CounterOfferInput } from "@brandjodi/shared";
import { apiRoute } from "@/server/api";
import { counterOffer } from "@/server/services";

export const POST = apiRoute((actor, body) => counterOffer(actor, body as CounterOfferInput));
