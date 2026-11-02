import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { riseChild, staggerParent, viewportOnce } from "../motion";
import { ApiError, postBusinessInquiry } from "../api";
import { Field, FormError, SubmitButton, TextArea, TextInput } from "../components/Form";
import { Link } from "../router";
import { DOWNLOAD_EXE } from "../constants";

/* Every claim here is checked against the repo: the silent install switch is
 * the NSIS /S used by the Chocolatey and Scoop packages, the winget id is the
 * published manifest, the PC list is the account menu (1.18.27), and the
 * download count is the figure the site already states. Pricing is a quote,
 * so no price, discount or SLA is promised on this page. */

const AUDIENCES = [
  ["IT teams", "One tuned, documented baseline for every workstation, with a restore path for each change."],
  ["Small offices", "Slow PCs and no sysadmin: scan, review, apply, undo. No scripts to write."],
  ["Internet cafés and esports venues", "Gaming rigs that stay consistent from the first seat to the last, and recover after a bad update."],
  ["MSPs", "A repeatable service you can run for clients, under a licence that covers it."],
] as const;

const GETS = [
  ["Commercial licence", "A written licence for business use, agreed with you before you pay."],
  ["Volume pricing", "A price built around your fleet size, quoted case by case. Tell us how many PCs."],
  ["Invoice", "Invoiced to your company, not a consumer checkout."],
  ["Priority support", "Your requests go to the front of the queue, answered by the people who build it."],
] as const;

function BusinessForm() {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pcs, setPcs] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  // Honeypot — see backend/src/routes/business-inquiry.ts.
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const count = Number(pcs);
    if (!company.trim()) return setError("Please enter your company name.");
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your work email address.");
    if (!Number.isInteger(count) || count < 1) return setError("Please enter how many PCs you manage.");
    if (!consent) return setError("Please confirm that we may use these details to reply to you.");
    setPending(true);
    try {
      await postBusinessInquiry({ company: company.trim(), name: name.trim(), email: email.trim(), pcs: count, message: message.trim(), consent, website });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your request. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div id="quote" role="status" className="glow-accent rounded-2xl border p-10 text-center" style={{ borderColor: "var(--accent-glow)", background: "var(--accent-soft)" }}>
        <div className="text-accent mb-3 text-[34px] leading-none" aria-hidden="true">✓</div>
        <h3 className="font-display mb-2 text-[22px] font-bold text-[var(--fg)]">Request received</h3>
        <p className="mx-auto max-w-md text-[14.5px] leading-relaxed text-[var(--fg-dim)]">
          Thanks. We read every request personally and will reply to your work email with a quote or a few questions about your fleet.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} id="quote" className="grid scroll-mt-28 gap-6 rounded-2xl border border-white/5 bg-[var(--bg-2)] p-6 sm:p-8">
      <div>
        <h2 className="font-display text-[22px] font-bold text-[var(--fg)]">Custom pricing — tell us about your fleet</h2>
        <p className="mt-1.5 text-[13.5px] text-[var(--fg-dim)]">A few details are enough. We reply by email.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Company" htmlFor="bz-company">
          <TextInput id="bz-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} autoComplete="organization" required />
        </Field>
        <Field label="Your name" htmlFor="bz-name">
          <TextInput id="bz-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required />
        </Field>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Work email" htmlFor="bz-email">
          <TextInput id="bz-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <Field label="Number of PCs" htmlFor="bz-pcs">
          <TextInput id="bz-pcs" type="number" inputMode="numeric" min={1} max={1000000} step={1} value={pcs} onChange={(e) => setPcs(e.target.value)} placeholder="25" required />
        </Field>
      </div>
      <Field label="Message (optional)" hint="What the PCs are used for, and anything you need from a licence." htmlFor="bz-message">
        <TextArea id="bz-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} />
      </Field>

      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />

      <label htmlFor="bz-consent" className="flex min-h-11 cursor-pointer items-start gap-3 text-[13.5px] leading-relaxed text-[var(--fg-dim)]">
        <input id="bz-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
        <span>
          I agree that PC Tweaker may use these details to reply to my request, as described in the{" "}
          <a href="/privacy/" className="text-accent underline underline-offset-4">Privacy Policy</a>.
        </span>
      </label>

      <FormError>{error}</FormError>
      <div>
        <SubmitButton pending={pending} pendingLabel="Sending…">Request a quote</SubmitButton>
      </div>
    </form>
  );
}

export function BusinessPage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12">
      <motion.div className="mx-auto max-w-7xl" variants={staggerParent} initial="hidden" whileInView="show" viewport={viewportOnce}>
        <motion.p variants={riseChild} className="font-mono-t mb-4 text-[11.5px] tracking-[0.18em] text-[var(--fg-dim)]">
          <span className="text-accent">PC TWEAKER</span> / FOR BUSINESS
        </motion.p>
        <motion.h1 variants={riseChild} className="font-display max-w-4xl text-[clamp(2.1rem,5vw,3.8rem)] leading-[1.04] font-bold tracking-tight text-[var(--fg)]">
          Tune a hundred PCs the way you tune one.
        </motion.h1>
        <motion.p variants={riseChild} className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--fg-dim)]">
          PC Tweaker has more than 130,000 downloads. Every setting it changes is shown first and can be restored,
          which is exactly what a fleet needs. Get a commercial licence, a price built around your PCs, and support that answers first.
        </motion.p>
        <motion.div variants={riseChild} className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#quote" className="bg-accent glow-accent-sm inline-flex min-h-11 items-center rounded-xl px-7 py-3 text-[14.5px] font-bold text-[var(--on-accent)] transition-transform hover:-translate-y-0.5">
            Get a custom quote
          </a>
          <a href={DOWNLOAD_EXE} className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-6 py-3 text-[14.5px] font-semibold text-[var(--fg)] transition-colors hover:border-white/40">
            Try it on one PC first
          </a>
        </motion.div>

        <motion.h2 variants={riseChild} className="font-display mt-20 text-[24px] font-bold text-[var(--fg)]">Built for the people who keep PCs running</motion.h2>
        <motion.ul variants={riseChild} className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map(([title, body]) => (
            <li key={title} className="card-glow rounded-2xl border border-white/5 bg-[var(--bg-2)] p-6">
              <h3 className="mb-2.5 text-[15px] font-semibold text-[var(--fg)]">{title}</h3>
              <p className="text-[14px] leading-relaxed text-[var(--fg-dim)]">{body}</p>
            </li>
          ))}
        </motion.ul>

        <div className="mt-20 grid gap-12 lg:grid-cols-12">
          <motion.div variants={riseChild} className="min-w-0 lg:col-span-5">
            <h2 className="font-display text-[24px] font-bold text-[var(--fg)]">What you get</h2>
            <ul className="mt-6 grid gap-5">
              {GETS.map(([title, body]) => (
                <li key={title} className="relative pl-6">
                  <span className="text-accent absolute left-0" aria-hidden="true">—</span>
                  <h3 className="text-[15px] font-semibold text-[var(--fg)]">{title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--fg-dim)]">{body}</p>
                </li>
              ))}
            </ul>

            <h2 className="font-display mt-12 text-[20px] font-bold text-[var(--fg)]">Roll it out your way</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--fg-dim)]">
              The installer runs unattended, so it fits the tools you already use. With winget:
            </p>
            <pre tabIndex={0} className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[var(--bg)] p-4 text-[12.5px] leading-relaxed text-[var(--fg)]"><code>winget install --id AurelioAvila.PCTweaker --exact --silent</code></pre>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--fg-dim)]">
              Or run the setup file with <code className="font-mono-t text-[var(--fg)]">/S</code>. Pro is tied to one account, and the account menu lists every PC signed in with it.
            </p>
            <Link to="/" onNavigate={navigate} className="mt-8 inline-flex min-h-11 items-center text-[13.5px] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]">← Back to PC Tweaker</Link>
          </motion.div>
          <motion.div variants={riseChild} className="min-w-0 lg:col-span-7">
            <BusinessForm />
          </motion.div>
        </div>
      </motion.div>
    </main>
  );
}
