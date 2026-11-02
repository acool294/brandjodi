import { NextResponse } from "next/server";
import { DomainError } from "@/server/errors";
import { handleRazorpayWebhook } from "@/server/services";

/** Razorpay Dashboard -> Webhooks: URL <APP_URL>/api/webhooks/razorpay, events payment.captured and order.paid. */
export async function POST(request: Request) {
  const raw = await request.text();
  try {
    const result = await handleRazorpayWebhook(
      raw,
      request.headers.get("x-razorpay-signature"),
      request.headers.get("x-razorpay-event-id"),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const status = e instanceof DomainError ? e.status : 500;
    // Non-2xx makes Razorpay retry, which is safe because processing is idempotent.
    return NextResponse.json({ ok: false }, { status });
  }
}
