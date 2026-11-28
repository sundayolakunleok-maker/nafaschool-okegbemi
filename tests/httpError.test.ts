import { describe, expect, it } from "vitest";
import {
  HttpError,
  isDatabaseBusyError,
  isDatabaseConnectionError,
} from "../src/lib/httpError";

function codedError(code: string, message = "boom") {
  return Object.assign(new Error(message), { code });
}

describe("isDatabaseConnectionError", () => {
  it.each([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "UND_ERR_CONNECT_TIMEOUT",
    "08000",
    "08001",
    "08003",
    "08004",
    "08006",
    "08007",
    "08P01",
    "57P01",
    "57P02",
    "57P03",
    "53300",
  ])("recognises connection error code %s", (code) => {
    expect(isDatabaseConnectionError(codedError(code))).toBe(true);
  });

  it("recognises pg-pool connection timeout messages", () => {
    expect(
      isDatabaseConnectionError(
        new Error("timeout exceeded when trying to connect")
      )
    ).toBe(true);
  });

  it("does not classify business errors as connection failures", () => {
    expect(
      isDatabaseConnectionError(
        new HttpError(422, "OVERPAYMENT", "Payment exceeds the outstanding balance")
      )
    ).toBe(false);

    expect(isDatabaseConnectionError(new Error("validation failed"))).toBe(
      false
    );
  });

  it("does not classify non-errors", () => {
    expect(isDatabaseConnectionError("ECONNREFUSED")).toBe(false);
    expect(isDatabaseConnectionError(null)).toBe(false);
    expect(isDatabaseConnectionError(undefined)).toBe(false);
  });
});

describe("isDatabaseBusyError", () => {
  it("recognises a PostgreSQL lock timeout", () => {
    expect(isDatabaseBusyError(codedError("55P03"))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isDatabaseBusyError(codedError("ECONNREFUSED"))).toBe(false);
    expect(isDatabaseBusyError(new Error("busy"))).toBe(false);
  });
});
