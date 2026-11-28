import { Router, type Request, type Response } from "express";
import type { Sql } from "../db.js";

export function createPupilsRouter(sql: Sql): Router {
  const router = Router();

  // Pupil registration endpoint
  router.post("/pupils", async (req: Request, res: Response) => {
    try {
      // Check if request body exists
      if (!req.body) {
        return res.status(400).json({
          error: "Request body is required",
        });
      }

      const { name, class: className, guardianName, guardianPhone } = req.body;

      // Validate all fields are present and are strings
      if (!name || !className || !guardianName || !guardianPhone) {
        return res.status(400).json({
          error:
            "All fields are required: name, class, guardianName, guardianPhone",
        });
      }

      // Validate that all fields are strings
      if (
        typeof name !== "string" ||
        typeof className !== "string" ||
        typeof guardianName !== "string" ||
        typeof guardianPhone !== "string"
      ) {
        return res.status(400).json({
          error: "All fields must be strings",
        });
      }

      // Trim and validate non-empty strings
      const trimmedName = name.trim();
      const trimmedClassName = className.trim();
      const trimmedGuardianName = guardianName.trim();
      const trimmedGuardianPhone = guardianPhone.trim();

      if (
        !trimmedName ||
        !trimmedClassName ||
        !trimmedGuardianName ||
        !trimmedGuardianPhone
      ) {
        return res.status(400).json({
          error: "All fields must contain non-whitespace characters",
        });
      }

      // Atomic insertion using CTEs
      const result = await sql`
        WITH inserted_guardian AS (
          INSERT INTO guardians (name, phone)
          VALUES (${trimmedGuardianName}, ${trimmedGuardianPhone})
          RETURNING id, name, phone
        ),
        inserted_pupil AS (
          INSERT INTO pupils (name, class, guardian_id)
          SELECT ${trimmedName}, ${trimmedClassName}, id
          FROM inserted_guardian
          RETURNING id, name, class, guardian_id
        )
        SELECT
          pupil.id as pupil_id,
          pupil.name as pupil_name,
          pupil.class as pupil_class,
          guardian.id as guardian_id,
          guardian.name as guardian_name,
          guardian.phone as guardian_phone
        FROM inserted_pupil pupil
        JOIN inserted_guardian guardian ON pupil.guardian_id = guardian.id
      `;

      if (result.length === 0) {
        throw new Error("Insertion failed");
      }

      const createdRecord = result[0];

      return res.status(201).json({
        pupil: {
          id: createdRecord.pupil_id,
          name: createdRecord.pupil_name,
          class: createdRecord.pupil_class,
        },
        guardian: {
          id: createdRecord.guardian_id,
          name: createdRecord.guardian_name,
          phone: createdRecord.guardian_phone,
        },
      });
    } catch (error) {
      // Handle database errors without exposing internal details
      console.error("Database error:", error);
      return res.status(503).json({
        error: "Service unavailable. Please try again later.",
      });
    }
  });

  return router;
}
