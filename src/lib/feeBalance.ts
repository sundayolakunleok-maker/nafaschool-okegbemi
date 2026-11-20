export function calculateOutstandingBalance(totalFee: number, totalPaid: number): number {
  // Validate inputs
  if (typeof totalFee !== "number" || typeof totalPaid !== "number") {
    throw new Error("totalFee and totalPaid must be numbers");
  }

  if (!Number.isFinite(totalFee) || !Number.isFinite(totalPaid)) {
    throw new Error("totalFee and totalPaid must be finite numbers");
  }

  if (totalFee < 0 || totalPaid < 0) {
    throw new Error("totalFee and totalPaid must not be negative");
  }

  const balance = totalFee - totalPaid;

  // Return 0 if balance is negative (overpayment)
  return Math.max(0, balance);
}