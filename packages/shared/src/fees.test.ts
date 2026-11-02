import { describe, expect, it } from "vitest";
import { computeFees } from "./fees";

describe("computeFees", () => {
  it("matches the plan example: ₹10,000 with a 10% brand fee", () => {
    const fees = computeFees(10_000_00);
    expect(fees.brandFee).toBe(1_000_00);
    expect(fees.gstOnFee).toBe(180_00);
    expect(fees.brandTotal).toBe(11_180_00);
    expect(fees.creatorPayout).toBe(10_000_00);
  });

  it("supports a creator-side fee", () => {
    const fees = computeFees(10_000_00, {
      brandFeeBps: 1000,
      creatorFeeBps: 500,
      gstOnFeeBps: 1800,
    });
    expect(fees.creatorFee).toBe(500_00);
    expect(fees.platformFee).toBe(1_500_00);
    expect(fees.gstOnFee).toBe(270_00);
    expect(fees.brandTotal).toBe(11_270_00);
    expect(fees.creatorPayout).toBe(9_500_00);
  });

  it("rejects fractional paise", () => {
    expect(() => computeFees(10.5)).toThrow();
  });
});
