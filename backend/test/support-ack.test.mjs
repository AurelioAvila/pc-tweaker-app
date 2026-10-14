import test from "node:test";
import assert from "node:assert/strict";

const { supportAckEmail } = await import("../dist/emails/support-ack.js");

test("the support acknowledgement echoes only a first name, escaped, and stays in the kit", () => {
  const ack = supportAckEmail("<b>Eve</b> Smith", "eve@example.com");
  assert.equal(ack.subject, "We received your PC Tweaker support request");
  assert.match(ack.html, /Got it, &lt;b&gt;Eve&lt;\/b&gt;\. It is in the queue\./);
  assert.doesNotMatch(ack.html, /<b>Eve/);
  assert.doesNotMatch(ack.html + ack.text, /Smith/, "nothing past the first word of the name");
  assert.match(ack.html, /#ff6a3d/);
  assert.match(ack.html, /Did not contact us\?/);
  assert.match(ack.text, /https:\/\/pctweaker\.app\/how-to-undo-windows-tweaks\//);
  assert.doesNotMatch(ack.html + ack.text, /illustrat/i);
  assert.doesNotMatch(ack.text, /!/, "no exclamation marks");
  assert.match(supportAckEmail("", "a@example.com").text, /^Got it\. It is in the queue\./);
});

test("plain text drops tags, never keeps a '<' and unescapes only once", async () => {
  const { plainText } = await import("../dist/emails/layout.js");
  assert.equal(plainText('<strong>Plans &amp; pricing</strong> <a href="x">guide</a>'), "Plans & pricing guide");
  assert.equal(plainText("a &amp;lt; b &quot;c&quot;"), 'a &lt; b "c"');
  assert.ok(!plainText("<<script>script>alert(1)</script> x <").includes("<"));
});
