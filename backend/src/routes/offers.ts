import express, { Request, Response } from "express";
import { lifetimeOffer } from "../lifetime-offer";
import { promoState } from "../promo";

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

/** A separate route on purpose: installed apps up to 1.16.x read /lifetime
 *  and would draw their hardcoded €119 "was" price for any campaign there. */
export function promoHandler(environment: NodeJS.ProcessEnv = process.env, now: () => number = Date.now) {
  return (_req: Request, res: Response): void => {
    res.setHeader("Cache-Control", "no-store");
    res.json(promoState(environment, now()));
  };
}

const router = express.Router();
router.get("/lifetime", lifetimeOfferHandler());
router.get("/promo", promoHandler());
export default router;
