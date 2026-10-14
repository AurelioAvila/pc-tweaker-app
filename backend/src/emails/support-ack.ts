/**
 * The acknowledgement a visitor gets after the support form (kit 08), in the
 * language their browser asked for.
 *
 * The recipient address is whatever the visitor typed, so this message echoes
 * nothing they wrote except the first word of their name: no message body and
 * no subject line, or the form would deliver arbitrary text to any inbox with
 * our domain's reputation behind it.
 */
import { en } from "./copy/en";
import type { Copy } from "./copy";
import { details, emailShell, escapeHtml, link, paragraph, steps, textFooter } from "./layout";

const UNDO_GUIDE = "https://pctweaker.app/how-to-undo-windows-tweaks/";

export function supportAckEmail(name: string, email: string, c: Copy = en) {
  const x = c.supportAck;
  const headline = x.headline((name || "").trim().split(/\s+/)[0].slice(0, 40));
  return {
    subject: x.subject,
    html: emailShell({
      c,
      preheader: x.preheader,
      eyebrow: x.eyebrow,
      headline,
      intro: x.intro,
      blocks: [
        details([[x.replyTo, email]]),
        steps(x.stepsTitle, x.steps.map(escapeHtml)),
        paragraph(`${escapeHtml(x.wait)} ${x.guide(link(UNDO_GUIDE, x.guideLabel))}`),
      ],
      help: { title: x.notYouTitle, text: escapeHtml(x.notYou) },
      why: x.why,
    }),
    text:
      [
        headline,
        x.intro,
        `${x.replyTo}: ${email}`,
        `${x.stepsTitle}\n${x.steps.map((item, i) => `${i + 1}. ${item}`).join("\n")}`,
        `${x.wait} ${x.guide(x.guideLabel)}: ${UNDO_GUIDE}`,
        `${x.notYouTitle} ${x.notYou}`,
      ].join("\n\n") + textFooter(undefined, x.why, c),
  };
}
