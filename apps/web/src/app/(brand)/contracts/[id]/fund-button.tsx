"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPaymentAction, createFundingOrderAction } from "@/actions/brand";
import { Button } from "@/components/ui/button";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(s);
  });
}

/** Creates an order on the server, opens Razorpay Checkout (or a mock confirm), then confirms on the server. */
export function FundButton({
  contractId,
  amountLabel,
}: {
  contractId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(input: { orderId: string; paymentId: string; signature: string }) {
    const result = await confirmPaymentAction(input);
    if (result?.error) setError(result.error);
    router.refresh();
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const result = await createFundingOrderAction(contractId);
      if (!result || !("order" in result))
        throw new Error(result?.error ?? "Could not start payment");
      const { order } = result;

      if (order.provider === "mock") {
        if (window.confirm(`Test mode: simulate a successful payment of ${amountLabel}?`)) {
          await confirm({
            orderId: order.orderId,
            paymentId: `mock_pay_${Date.now()}`,
            signature: "mock",
          });
        }
        return;
      }

      await loadRazorpay();
      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay!({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: "BrandJodi",
          description: "Contract payment (held until you approve)",
          handler: async (r: RazorpayResponse) => {
            await confirm({
              orderId: r.razorpay_order_id,
              paymentId: r.razorpay_payment_id,
              signature: r.razorpay_signature,
            });
            resolve();
          },
          modal: { ondismiss: () => resolve() },
          theme: { color: "#be185d" },
        });
        rzp.open();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button onClick={pay} disabled={busy}>
        {busy ? "Opening payment…" : `Pay ${amountLabel}`}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
