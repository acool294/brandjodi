import type { ReviewInput } from "@brandjodi/shared";
import { apiRoute } from "@/server/api";
import { submitReview } from "@/server/services";

export const POST = apiRoute((actor, body) => submitReview(actor, body as ReviewInput));
