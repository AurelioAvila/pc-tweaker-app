import type { Variants } from "framer-motion";

/* Industrial easing — fast attack, long precise settle. */
export const EASE: readonly [number, number, number, number] = [0.16, 1, 0.3, 1];

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export const riseChild: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

export const viewportOnce = { once: true, amount: 0.25 } as const;
