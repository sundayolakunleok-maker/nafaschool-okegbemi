import express, { type ErrorRequestHandler } from "express";
import type { Pool } from "@neondatabase/serverless";
import type { Sql } from "./db.js";
import { createPaymentsRouter } from "./routes/payments.js";
import { createPupilsRouter } from "./routes/pupils.js";

export interface AppDependencies {
  pool: Pool;
  sql: Sql;
}

export function createApp({ pool, sql }: AppDependencies) {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "16kb" }));

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "NafaSchool API",
    });
  });

  app.use(createPupilsRouter(sql));
  app.use(createPaymentsRouter(pool));

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({
        error: "Invalid JSON body",
        code: "INVALID_JSON",
      });
      return;
    }

    console.error(
      "Unhandled error:",
      error instanceof Error ? error.message : "unknown error"
    );
    res.status(500).json({
      error: "An unexpected error occurred.",
      code: "INTERNAL_ERROR",
    });
  };

  app.use(errorHandler);

  return app;
}
