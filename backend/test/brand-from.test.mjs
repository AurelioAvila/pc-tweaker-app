import test from "node:test";
import assert from "node:assert/strict";

test("a mail branded for an app is sent under that app's name on the verified address", async () => {
  process.env.MAIL_FROM = "PC Tweaker <noreply@pctweaker.app>";
  const { brandFrom } = await import("../dist/mailer.js");
  assert.equal(brandFrom("PC Tweaker Uninstaller"), "PC Tweaker Uninstaller <noreply@pctweaker.app>");
});
