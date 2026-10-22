import { useEffect, useState } from "react";
import { API_BASE, DOWNLOAD_EXE, MICROSOFT_STORE } from "../constants";
import "./invitation.css";
import { normalizeInvitationCode } from "../../../src/referral-code";

export const INVITATION_SEO = {
  title: "Your PC Tweaker Invitation",
  description:
    "Got a PC Tweaker invitation? Confirm the code in the app before your first Pro purchase to save an extra 10%, and see the bonus, limits and verification rules.",
  canonical: "https://pctweaker.app/invite/",
  ogType: "website" as const,
};

export function InvitationPage() {
  const [invitation, setInvitation] = useState<{
    state: "checking" | "closed" | "invalid" | "valid" | "unavailable";
    code: string;
  }>({ state: "checking", code: "" });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), 10000);
    async function check() {
      const code = normalizeInvitationCode(
        new URLSearchParams(window.location.search).get("ref") ?? "",
      );
      try {
        const config = await fetch(`${API_BASE}/api/referrals/config`, {
          cache: "no-store",
          signal: abort.signal,
        });
        if (!config.ok) throw new Error("Unavailable");
        const policy = (await config.json()) as { enabled?: boolean };
        if (policy.enabled !== true) {
          setInvitation({ state: "closed", code: "" });
          return;
        }
        if (!code) {
          setInvitation({ state: "invalid", code: "" });
          return;
        }
        const response = await fetch(
          `${API_BASE}/api/referrals/codes/${encodeURIComponent(code)}`,
          { cache: "no-store", signal: abort.signal },
        );
        if (response.status === 404) {
          setInvitation({ state: "invalid", code: "" });
          return;
        }
        if (!response.ok) throw new Error("Unavailable");
        const data = (await response.json()) as { valid?: boolean };
        setInvitation({
          state: data.valid === true ? "valid" : "invalid",
          code: data.valid === true ? code : "",
        });
      } catch {
        if (alive) setInvitation({ state: "unavailable", code: "" });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void check();
    return () => {
      alive = false;
      window.clearTimeout(timeout);
      abort.abort();
    };
  }, []);
  const valid = invitation.state === "valid";
  return (
    <main id="main-content" className="invitation-page" lang="en">
      <div className="invitation-layout">
        <header>
          <p className="invitation-eyebrow">AN INVITATION TO PC TWEAKER</p>
          <h1>
            A useful recommendation.
            <br />
            <span>A little more in return.</span>
          </h1>
          <p className="invitation-intro">
            Understand your Windows settings, choose what to change, and keep a way back.
          </p>
          <div className="invitation-status" role="status">
            {invitation.state === "checking"
              ? "Checking this invitation…"
              : valid
                ? "Invitation found · account eligibility is checked in the app"
                : invitation.state === "closed"
                  ? "The invitation programme is not open yet. PC Tweaker Free is still available."
                  : invitation.state === "invalid"
                    ? "This invitation is missing or unavailable. Ask your friend to check their link."
                    : "We could not check this invitation. Please reload before relying on a discount."}
          </div>
          <div className="invitation-actions">
            <a href={DOWNLOAD_EXE}>
              Download PC Tweaker Free <span aria-hidden="true">↗</span>
            </a>
            <a href={MICROSOFT_STORE}>Get it from Microsoft Store</a>
          </div>
          <p className="invitation-note">
            Windows 10/11. Invitations need PC Tweaker 1.18.11 or later. Downloading does not activate an
            invitation or start a paid subscription.
          </p>
        </header>
        <aside className="invitation-card">
          <span className="invitation-card-label">HOW THE PROGRAMME WORKS</span>
          <strong className="invitation-saving">
            10% <small>extra</small>
          </strong>
          <p>
            For an eligible invited account, on its first supported positive payment after any
            compatible offer. Ordinary renewal terms apply.
          </p>
          <div className="invitation-friend">
            <span>YOUR FRIEND EARNS</span>
            <strong>6 or 12 months of Pro</strong>
            <p>
              6 months after a monthly purchase; 12 after an annual or Lifetime purchase. A
              personal, non-transferable bonus for one PC, after verification, up to 6 every 12
              months. If your friend already owns Lifetime, you still save 10%, but they earn no
              bonus.
            </p>
          </div>
          {valid ? (
            <div className="invitation-code">
              <label htmlFor="invitation-code">Your invitation code</label>
              <input id="invitation-code" readOnly value={invitation.code} />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(invitation.code)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? "Code copied" : "Copy invitation code"}
              </button>
              <p>In the app: sign in → Account → Invite a friend → Use a code.</p>
            </div>
          ) : (
            <p className="invitation-note">
              These are the programme rules. A discount is available only after a valid invitation
              and your account eligibility have been confirmed.
            </p>
          )}
        </aside>
      </div>
      <section className="invitation-steps" aria-label="How to use an invitation">
        <article>
          <span>01</span>
          <h2>Start with the free app.</h2>
          <p>Use the official download. Create your account and verify its email address.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Confirm your invitation.</h2>
          <p>
            Copy the code from this page and confirm it in the app before opening a paid checkout. A
            Store download does not transfer the code automatically.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Check before you pay.</h2>
          <p>
            Choose a supported paid plan and read its final price and renewal terms on Stripe.
            Downloads, registrations and free trials do not earn a reward.
          </p>
        </article>
      </section>
      <details className="invitation-conditions">
        <summary>Eligibility, verification and bonus conditions</summary>
        <p>
          The programme is for an invited account’s first eligible PC Tweaker purchase. One
          invitation is bound to one account and expires 30 days after you confirm it; it cannot be
          combined with the free trial. Repeated payer details, self-referrals (including a second
          account used on your friend’s PC or on the same private email domain), refunds or disputes
          make a purchase ineligible.
        </p>
        <p>
          Your friend’s reward becomes available as soon as your first payment succeeds. If that
          payment is refunded or disputed, the reward is withdrawn, even while it is in use;
          payments that cannot be checked automatically stay under review. Your friend sees only
          whether a reward is available, being checked or not eligible, never your payment details.
          A bonus lasts 6 or 12 calendar months from activation on one PC, cannot be transferred or
          given away, has no automatic renewal and is checked online about every 10 minutes while
          the app is open.
        </p>
        <p>
          The discount applies once. A Lifetime purchase does not earn a Lifetime bonus. Existing
          paid subscriptions remain separate. Read the checkout and <a href="/terms/">terms</a>{" "}
          before purchasing; contact <a href="/support/">support</a> if something does not match.
        </p>
      </details>
    </main>
  );
}
