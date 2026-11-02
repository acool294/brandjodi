import type { SubmissionInput } from "@brandjodi/shared";
import { apiRoute } from "@/server/api";
import { submitDeliverable } from "@/server/services";

/** The app uploads files to Storage first (submissions/<contract_id>/<user_id>/...), then posts the paths here. */
export const POST = apiRoute((actor, body) => submitDeliverable(actor, body as SubmissionInput));
