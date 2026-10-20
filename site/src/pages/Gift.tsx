import { useEffect, useState } from "react";
import { DOWNLOAD_EXE, MICROSOFT_STORE } from "../constants";
import "./invitation.css";

export const GIFT_SEO = {
  title: "Your PC Tweaker Pro Gift",
  description:
    "Redeem a private PC Tweaker Pro bonus with the verified email specified by its sender. One account, one PC, no payment required.",
  canonical: "https://pctweaker.app/gift/",
  ogType: "website" as const,
};

export function GiftPage() {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("claim") ?? "";
    if (/^[A-Za-z0-9_-]{43}$/.test(value)) setCode(value);
  }, []);
  return (
    <main id="main-content" className="invitation-page" lang="en">
      <div className="invitation-layout">
        <header>
          <p className="invitation-eyebrow">A PRIVATE GIFT · PC TWEAKER PRO</p>
          <h1>
            More time for your PC.
            <br />
            <span>A gift from someone you know.</span>
          </h1>
          <p className="invitation-intro">
            A separate Pro bonus for one PC. Your sender's Lifetime licence stays theirs; your bonus
            starts when you activate it.
          </p>
          <div className="invitation-status" role="status">
            {code
              ? "Gift code found · validity and your verified email are checked securely in the app"
              : "This link has no gift code. Ask the sender for their complete private link."}
          </div>
          <p>
            Opening this page does not redeem a gift. Keep the link private and use only the email
            your sender specified.
          </p>
        </header>
        <section className="invitation-card" aria-labelledby="gift-steps-title">
          <p className="invitation-eyebrow">NO PAYMENT REQUIRED</p>
          <h2 id="gift-steps-title">Make it yours in the app.</h2>
          <ol>
            <li>Copy your gift code and install or update PC Tweaker.</li>
            <li>Sign in and verify the email your sender chose.</li>
            <li>
              Open your account menu → Invitations → Received a Pro gift, then redeem the code.
            </li>
            <li>Activate the bonus on your chosen PC when you are ready.</li>
          </ol>
          {code && (
            <div className="invitation-code">
              <input readOnly aria-label="Private gift code" value={code} />
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(code)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }
              >
                {copied ? "Code copied" : "Copy gift code"}
              </button>
            </div>
          )}
          <div className="invitation-actions">
            <a className="btn-primary" href={DOWNLOAD_EXE}>
              Download PC Tweaker
            </a>
            <a href={MICROSOFT_STORE}>Microsoft Store</a>
          </div>
          <p>
            One verified recipient, one PC. The sender can cancel before redemption. Once redeemed,
            the gift cannot be transferred again. Refunds, disputes or verification failures can
            hold or revoke the bonus.
          </p>
          <p>
            Activation starts the stated 6- or 12-month duration. It does not extend an existing
            paid subscription; overlapping periods run together. Active bonuses require an internet
            check at least every 10 minutes.
          </p>
        </section>
      </div>
    </main>
  );
}
