import { apiRoute } from "@/server/api";
import { setApplicationStatus } from "@/server/services";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/applications/[id]/withdraw">,
) {
  const { id } = await ctx.params;
  return apiRoute((actor) => setApplicationStatus(actor, id, "withdrawn"))(request);
}
