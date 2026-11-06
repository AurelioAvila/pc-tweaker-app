/** What a ticked box records as terms_version: one value per wording of the box and the
 *  Terms it links, so each evidence row says exactly what was ticked.
 *  - pctweaker "2026-11-01", uninstaller "2026-11-03" (3 Nov 2026): the box with the
 *    immediate-access, withdrawal, refund and renewal sentences; the value was the date of
 *    the linked Terms.
 *  - "2026-11-04" (owner, 4 Nov 2026): one line, "I agree to the Terms and want access now,
 *    ending my 14-day right of withdrawal.", linking the PC Tweaker
 *    Terms of 2026-11-01 or the Uninstaller Terms of 2026-11-03.
 *  - pctweaker "2026-11-04.2" (4 Nov 2026): the same line, linking the PC Tweaker Terms of
 *    2026-11-04, which add the 7-day pass.
 *  - pctweaker "2026-11-06" (6 Nov 2026): the same line, linking the PC Tweaker Terms of
 *    2026-11-06, which add paying with PayPal.
 *  New wording or new linked Terms: a new value here and in the other file (a backend test compares them). */
export const PURCHASE_TERMS_VERSION = {
  pctweaker: "2026-11-06",
  uninstaller: "2026-11-04",
} as const;
