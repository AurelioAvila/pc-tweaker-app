import express, { Request, Response } from "express";
import { lifetimeOffer } from "../lifetime-offer";

export function lifetimeOfferHandler(
  environment: NodeJS.ProcessEnv = process.env,
  now: () => number = Date.now,
) {
  return (_req: Request, res: Response): void => {
    const offer = lifetimeOffer(environment, now());
    res.setHeader("Cache-Control", "no-store");
    res.status(offer.status === "invalid" ? 503 : 200).json(offer);
  };
}

const router = express.Router();
router.get("/lifetime", lifetimeOfferHandler());
export default router;
