/** Shapes returned by the Next.js API routes under /api/v1 (used by the mobile app). */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; issues?: unknown };

export const API_ROUTES = {
  applications: "/api/v1/applications",
  withdrawApplication: (id: string) => `/api/v1/applications/${id}/withdraw`,
  offerRespond: "/api/v1/offers/respond",
  offerCounter: "/api/v1/offers/counter",
  submissions: "/api/v1/submissions",
  reviews: "/api/v1/reviews",
  payoutAccount: "/api/v1/payout-account",
} as const;
