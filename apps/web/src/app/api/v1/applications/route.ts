import type { ApplicationInput } from "@brandjodi/shared";
import { apiRoute } from "@/server/api";
import { applyToCampaign } from "@/server/services";

export const POST = apiRoute((actor, body) => applyToCampaign(actor, body as ApplicationInput));
