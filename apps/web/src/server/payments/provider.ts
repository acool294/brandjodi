import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { serverEnv } from "../env";

/**
 * Payment provider abstraction. `mock` lets the whole loop run with no keys; `razorpay` uses
 * Razorpay test mode (Standard Checkout). Swapping to Razorpay Route (split + hold) later only
 * changes this file and settle_payout() in SQL.
 */
export interface CreatedOrder {
  provider: "mock" | "razorpay";
  orderId: string;
  amount: number;
  currency: "INR";
  /** Public key for Razorpay Checkout (null for mock). */
  keyId: string | null;
}

export interface PaymentProvider {
  name: "mock" | "razorpay";
  createOrder(input: {
    amount: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<CreatedOrder>;
  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
}

function timingSafeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const mockProvider: PaymentProvider = {
  name: "mock",
  async createOrder({ amount }) {
    return {
      provider: "mock",
      orderId: `mock_order_${crypto.randomUUID()}`,
      amount,
      currency: "INR",
      keyId: null,
    };
  },
  verifyCheckoutSignature({ orderId }) {
    return orderId.startsWith("mock_order_");
  },
};

function razorpayProvider(): PaymentProvider {
  const env = serverEnv();
  const rzp = new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! });
  return {
    name: "razorpay",
    async createOrder({ amount, receipt, notes }) {
      const order = await rzp.orders.create({ amount, currency: "INR", receipt, notes });
      return {
        provider: "razorpay",
        orderId: order.id,
        amount,
        currency: "INR",
        keyId: env.RAZORPAY_KEY_ID!,
      };
    },
    verifyCheckoutSignature({ orderId, paymentId, signature }) {
      const expected = crypto
        .createHmac("sha256", env.RAZORPAY_KEY_SECRET!)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
      return timingSafeEqualHex(expected, signature);
    },
  };
}

export function paymentProvider(): PaymentProvider {
  return serverEnv().PAYMENTS_PROVIDER === "razorpay" ? razorpayProvider() : mockProvider;
}

/** Verifies the X-Razorpay-Signature header of a webhook against the raw body. */
export function verifyRazorpayWebhook(rawBody: string, signature: string | null): boolean {
  const secret = serverEnv().RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}
