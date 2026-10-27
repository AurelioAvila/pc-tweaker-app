import type { RequestHandler } from "express";

/** Cutover gate. Enable on every instance and verify the deployment before
 * inspecting outstanding provider sessions; never disable it on legacy code. */
export const checkoutMaintenance: RequestHandler = (_req, res, next) => {
  if (process.env.CHECKOUT_MAINTENANCE === "1") {
    res.status(503).json({ code: "checkout_temporarily_unavailable", error: "Checkout is temporarily unavailable. Please try again later." });
    return;
  }
  next();
};
