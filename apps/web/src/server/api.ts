import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiResult } from "@brandjodi/shared";
import { requireApiActor, type Actor } from "./auth";
import { DomainError } from "./errors";

type Handler<T> = (actor: Actor, body: unknown, request: Request) => Promise<T>;

/** Wraps a /api/v1 route: authenticates the caller, parses JSON, and maps errors to ApiResult. */
export function apiRoute<T>(handler: Handler<T>) {
  return async (request: Request): Promise<NextResponse<ApiResult<T>>> => {
    try {
      const actor = await requireApiActor(request);
      const body = request.method === "GET" ? null : await request.json().catch(() => ({}));
      const data = await handler(actor, body, request);
      return NextResponse.json({ ok: true, data });
    } catch (e) {
      if (e instanceof ZodError) {
        return NextResponse.json(
          { ok: false, error: e.issues[0]?.message ?? "Invalid input", issues: e.issues },
          { status: 422 },
        );
      }
      if (e instanceof DomainError) {
        return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
      }
      console.error("[api]", e);
      return NextResponse.json({ ok: false, error: "Something went wrong" }, { status: 500 });
    }
  };
}
