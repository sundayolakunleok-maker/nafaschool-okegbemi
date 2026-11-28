import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "@neondatabase/serverless";
import { createApp } from "../src/app";
import type { Sql } from "../src/db";

const unusedSql = (() => {
  throw new Error("SQL client should not be used in this test");
}) as unknown as Sql;

function failingPool(code = "ECONNREFUSED"): Pool {
  return {
    connect: async () => {
      throw Object.assign(new Error(`connect ${code} 127.0.0.1:5432`), {
        code,
      });
    },
  } as unknown as Pool;
}

async function withServer(
  pool: Pool,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = createApp({ pool, sql: unusedSql });
  const server = app.listen(0);

  await new Promise<void>((resolve) => server.once("listening", resolve));

  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 0;

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    const closed = new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    server.closeAllConnections();
    await closed;
  }
}

const validPayment = {
  pupilId: 1,
  feeScheduleId: 1,
  amount: 30_000,
  method: "cash",
  requestId: "req-12345678",
};

async function postPayment(
  baseUrl: string,
  body: unknown,
  rawBody = false
): Promise<Response> {
  return fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody ? (body as string) : JSON.stringify(body),
  });
}

describe("POST /payments route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 503 with a generic message when the database connection fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await withServer(failingPool("ECONNREFUSED"), async (baseUrl) => {
      const response = await postPayment(baseUrl, validPayment);
      expect(response.status).toBe(503);

      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toEqual({
        error: "Service unavailable. Please try again later.",
        code: "SERVICE_UNAVAILABLE",
      });

      const serialized = JSON.stringify(body);
      expect(serialized).not.toMatch(
        /ECONNREFUSED|postgres|DATABASE_URL|password/i
      );
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  it("returns 400 before touching the database for invalid input", async () => {
    const pool = failingPool();
    const connectSpy = vi.spyOn(pool, "connect");

    await withServer(pool, async (baseUrl) => {
      const response = await postPayment(baseUrl, {
        ...validPayment,
        amount: 1.5,
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(connectSpy).not.toHaveBeenCalled();
    });
  });

  it("returns 400 for malformed JSON", async () => {
    await withServer(failingPool(), async (baseUrl) => {
      const response = await postPayment(baseUrl, "{not valid json", true);

      expect(response.status).toBe(400);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe("INVALID_JSON");
    });
  });

  it("keeps GET /health working", async () => {
    await withServer(failingPool(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status: "ok",
        service: "NafaSchool API",
      });
    });
  });
});
