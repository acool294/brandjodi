import { apiRoute } from "@/server/api";
import { respondToOffer } from "@/server/services";

/** Returns { data: contractId } on accept, { data: null } on decline. */
export const POST = apiRoute((actor, body) =>
  respondToOffer(actor, body as { offer_id: string; action: "accept" | "decline" }),
);
