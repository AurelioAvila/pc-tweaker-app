import express, { Request, Response } from "express";

/** Switches the desktop app reads at start and hourly. Every flag is off
 *  unless the environment turns it on, and an unreachable server leaves the
 *  app with its last answer.
 *
 *  `processGuardHold`: when on, installed apps hold every runtime adjustment
 *  they make to other running programs (core steering, EcoQoS, priority rules,
 *  the X3D aligner, RAM cleanup) until it is turned off again. */
export function flagsHandler(environment: NodeJS.ProcessEnv = process.env) {
  return (_req: Request, res: Response): void => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ processGuardHold: environment.PCT_PROCESS_GUARD_HOLD === "1" });
  };
}

const router = express.Router();
router.get("/", flagsHandler());
export default router;
