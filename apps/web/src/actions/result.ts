import { ZodError } from "zod";
import { DomainError } from "@/server/errors";

export type ActionState = { ok: boolean; error?: string; message?: string; data?: unknown } | null;

/** Converts thrown errors into a form-friendly result for useActionState. */
export function toActionError(e: unknown): ActionState {
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return {
      ok: false,
      error: first ? `${first.path.join(".") || "Input"}: ${first.message}` : "Check the form.",
    };
  }
  if (e instanceof DomainError) return { ok: false, error: e.message };
  // redirect() and notFound() throw special errors that must propagate.
  throw e;
}

export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

export const int = (fd: FormData, key: string) => {
  const v = Number(str(fd, key));
  return Number.isFinite(v) ? Math.round(v) : NaN;
};

/** Form inputs take rupees; the domain uses paise. */
export const rupees = (fd: FormData, key: string) => {
  const v = Number(str(fd, key));
  return Number.isFinite(v) ? Math.round(v * 100) : NaN;
};
