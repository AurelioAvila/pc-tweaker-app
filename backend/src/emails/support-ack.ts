/**
 * The acknowledgement a visitor gets after the support form (kit 08).
 *
 * The recipient address is whatever the visitor typed, so this message echoes
 * nothing they wrote except the first word of their name: no message body and
 * no subject line, or the form would deliver arbitrary text to any inbox with
 * our domain's reputation behind it.
 */
import { details, emailShell, escapeHtml, link, paragraph, steps, textFooter } from "./layout";

const UNDO_GUIDE = "https://pctweaker.app/how-to-undo-windows-tweaks/";

const INTRO =
  "Your message reached the PC Tweaker support inbox. A person reads it, not a bot, and the answer comes back to this address. Most replies go out within one working day; something that needs a reproduction on our side can take a little longer, and we will say so.";
const SPEED_UP = [
  "Reply to this email with anything you forgot: the app version, your Windows version, and the exact control or scan you used. One thread keeps everything together.",
  "If a setting is misbehaving, open Change history and tell us what the entry says. Every applied control is listed there with the value it set and the one it replaced, which is usually the whole diagnosis.",
  "Screenshots help; blur anything personal first. Never include a password, a licence token or card details, and if we ever seem to ask for them, the message is not from us.",
];
const WAIT =
  "While you wait: if a change needs undoing right now, Restore All in Change history puts every recorded setting back without waiting for us.";
const NOT_YOU =
  "Someone typed this address into the support form. You can ignore this email; nothing on an account changes through the form. If it keeps happening, tell us and we will block the source.";
const WHY = "You received this email because a support request was sent to PC Tweaker from this address.";

export function supportAckEmail(name: string, email: string) {
  const firstName = (name || "").trim().split(/\s+/)[0].slice(0, 40);
  const headline = firstName ? `Got it, ${firstName}. It is in the queue.` : "Got it. It is in the queue.";
  return {
    subject: "We received your PC Tweaker support request",
    html: emailShell({
      preheader: "Your message is in the queue. Reply to this email to add a detail or a screenshot.",
      eyebrow: "Support request received",
      headline,
      intro: INTRO,
      blocks: [
        details([["We reply to", email]]),
        steps("What speeds up the answer", SPEED_UP.map(escapeHtml)),
        paragraph(`${escapeHtml(WAIT)} The ${link(UNDO_GUIDE, "undo guide")} covers the cases it does not reach.`),
      ],
      help: { title: "Did not contact us?", text: escapeHtml(NOT_YOU) },
      why: WHY,
    }),
    text:
      [
        headline,
        INTRO,
        `We reply to: ${email}`,
        `What speeds up the answer\n${SPEED_UP.map((item, i) => `${i + 1}. ${item}`).join("\n")}`,
        `${WAIT} The undo guide covers the cases it does not reach: ${UNDO_GUIDE}`,
        `Did not contact us? ${NOT_YOU}`,
      ].join("\n\n") + textFooter(undefined, WHY),
  };
}
