import { Router, type Request, type Response } from "express";
import type { Pool } from "@neondatabase/serverless";
import {
  HttpError,
  isDatabaseBusyError,
  isDatabaseConnectionError,
} from "../lib/httpError.js";
import { validatePaymentInput } from "../lib/paymentRules.js";
import { recordPayment } from "../services/paymentService.js";

export function createPaymentsRouter(pool: Pool): Router {
  const router = Router();

  router.post("/payments", async (req: Request, res: Response) => {
    try {
      const input = validatePaymentInput(req.body);
      const result = await recordPayment(pool, input);

      if (!result.created) {
        res.setHeader("Idempotent-Replay", "true");
      }

      return res.status(result.created ? 201 : 200).json({
        payment: result.payment,
        balance: result.balance,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({
          error: error.message,
          code: error.code,
          ...(error.details ? { details: error.details } : {}),
        });
      }

      if (isDatabaseConnectionError(error) || isDatabaseBusyError(error)) {
        console.error(
          "Payment database unavailable:",
          error instanceof Error ? error.message : "unknown error"
        );
        return res.status(503).json({
          error: "Service unavailable. Please try again later.",
          code: "SERVICE_UNAVAILABLE",
        });
      }

      console.error(
        "Unexpected payment error:",
        error instanceof Error ? error.message : "unknown error"
      );
      return res.status(500).json({
        error: "An unexpected error occurred.",
        code: "INTERNAL_ERROR",
      });
    }
  });

  return router;
}
