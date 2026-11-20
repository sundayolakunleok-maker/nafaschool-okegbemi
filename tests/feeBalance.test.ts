import { describe, it, expect } from "vitest";
import { calculateOutstandingBalance } from "../src/lib/feeBalance";

describe("calculateOutstandingBalance", () => {
  it("returns full fee when no payment is made", () => {
    expect(calculateOutstandingBalance(100, 0)).toBe(100);
  });

  it("calculates partial payment balance", () => {
    expect(calculateOutstandingBalance(100, 50)).toBe(50);
  });

  it("returns 0 when payment equals the total fee", () => {
    expect(calculateOutstandingBalance(100, 100)).toBe(0);
  });

  it("returns 0 when payment exceeds fee (overpayment)", () => {
    expect(calculateOutstandingBalance(100, 150)).toBe(0);
  });

  it("returns 0 when payment is exactly zero (edge case)", () => {
    expect(calculateOutstandingBalance(0, 0)).toBe(0);
  });

  it("rejects negative totalFee", () => {
    expect(() => calculateOutstandingBalance(-100, 50)).toThrow("totalFee and totalPaid must not be negative");
  });

  it("rejects negative totalPaid", () => {
    expect(() => calculateOutstandingBalance(100, -50)).toThrow("totalFee and totalPaid must not be negative");
  });

  it("rejects non-finite totalFee", () => {
    expect(() => calculateOutstandingBalance(NaN, 50)).toThrow("totalFee and totalPaid must be finite numbers");
  });

  it("rejects non-finite totalPaid", () => {
    expect(() => calculateOutstandingBalance(100, Infinity)).toThrow("totalFee and totalPaid must be finite numbers");
  });

  it("rejects non-number input types", () => {
    expect(() => calculateOutstandingBalance("100", 50)).toThrow("totalFee and totalPaid must be numbers");
  });

  it("rejects non-number input types for totalPaid", () => {
    expect(() => calculateOutstandingBalance(100, "50")).toThrow("totalFee and totalPaid must be numbers");
  });
});