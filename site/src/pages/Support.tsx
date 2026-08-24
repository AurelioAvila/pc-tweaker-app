import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { riseChild, staggerParent, viewportOnce } from "../motion";
import { ApiError, postSupportRequest } from "../api";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "../components/Form";
import { Link } from "../router";

const t = text.support;

function SelfServeCard({ q, a }: { q: string; a: string }) {
  return (
    <div className="card-glow rounded-2xl border border-white/5 bg-[var(--bg-2)] p-6">
      <h3 className="mb-2.5 text-[15px] font-semibold text-[var(--fg)]">{q}</h3>
      <p className="text-[14px] leading-relaxed text-[var(--fg-dim)]">{a}</p>
    </div>
  );
}

function SupportForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState(t.categories[0].value);
  const [subject, setSubject] = useState("");
  const [systemInfo, setSystemInfo] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot. Hidden from users, irresistible to bots — see routes/support.ts.
  const [company, setCompany] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your email address.");
    if (!subject.trim()) return setError("Please enter a subject.");
    if (message.trim().length < 20)
      return setError("Please describe the problem in at least 20 characters.");

    setPending(true);
    try {
      await postSupportRequest({
        name: name.trim(),
        email: email.trim(),
        category,
        subject: subject.trim(),
        systemInfo: systemInfo.trim(),
        message: message.trim(),
        company,
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't send your message. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div
        className="glow-accent rounded-2xl border p-10 text-center"
        style={{ borderColor: "var(--accent-glow)", background: "var(--accent-soft)" }}
      >
        <div className="text-accent mb-3 text-[34px] leading-none">✓</div>
        <h3 className="font-display mb-2 text-[22px] font-bold text-[var(--fg)]">{t.successTitle}</h3>
        <p className="mx-auto max-w-md text-[14.5px] leading-relaxed text-[var(--fg-dim)]">
          {t.successBody}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-2xl border border-white/5 bg-[var(--bg-2)] p-8">
      <div>
        <div className="font-display text-[20px] font-bold text-[var(--fg)]">{t.formTitle}</div>
        <p className="mt-1.5 text-[13.5px] text-[var(--fg-dim)]">{t.formIntro}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t.name} htmlFor="sp-name">
          <TextInput
            id="sp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            required
          />
        </Field>
        <Field label={t.email} hint={t.emailHint} htmlFor="sp-email">
          <TextInput
            id="sp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t.category} htmlFor="sp-category">
          <Select id="sp-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {t.categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.subject} htmlFor="sp-subject">
          <TextInput
            id="sp-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t.subjectPlaceholder}
            maxLength={140}
            required
          />
        </Field>
      </div>

      <Field label={t.systemInfo} hint={t.systemInfoHint} htmlFor="sp-system">
        <TextInput
          id="sp-system"
          value={systemInfo}
          onChange={(e) => setSystemInfo(e.target.value)}
          placeholder="Windows 11 23H2 · RTX 4060 · PC Tweaker 1.2.4"
          maxLength={500}
        />
      </Field>

      <Field label={t.message} htmlFor="sp-message">
        <TextArea
          id="sp-message"
          rows={8}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.messagePlaceholder}
          maxLength={5000}
          required
        />
      </Field>

      {/* Honeypot — hidden from people, not from bots. aria-hidden + tabIndex
          keep it out of the keyboard order and off screen readers. */}
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <FormError>{error}</FormError>

      <div className="flex flex-wrap items-center gap-5">
        <SubmitButton pending={pending} pendingLabel={t.submitting}>
          {t.submit}
        </SubmitButton>
        <span className="font-mono-t text-[11px] tracking-[0.12em] text-[var(--fg-dim)]">
          {t.responseTime.toUpperCase()}
        </span>
      </div>
    </form>
  );
}

export function SupportPage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.div
          variants={riseChild}
          className="font-mono-t mb-4 text-[11.5px] tracking-[0.18em] text-[var(--fg-dim)]"
        >
          <span className="text-accent">{t.tag.split(" / ")[0]}</span> / {t.tag.split(" / ")[1]}
        </motion.div>
        <motion.h1
          variants={riseChild}
          className="font-display max-w-3xl text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-bold tracking-tight text-[var(--fg)]"
        >
          {t.title}
        </motion.h1>
        <motion.p
          variants={riseChild}
          className="mt-6 max-w-2xl text-[15.5px] leading-relaxed text-[var(--fg-dim)]"
        >
          {t.intro}
        </motion.p>

        <motion.h2
          variants={riseChild}
          className="font-display mt-16 text-[22px] font-bold text-[var(--fg)]"
        >
          {t.selfServeTitle}
        </motion.h2>
        <motion.div variants={riseChild} className="mt-6 grid gap-5 md:grid-cols-2">
          {t.selfServe.map((item) => (
            <SelfServeCard key={item.q} q={item.q} a={item.a} />
          ))}
        </motion.div>

        <div className="mt-20 grid gap-12 lg:grid-cols-12">
          <motion.aside variants={riseChild} className="lg:col-span-4">
            <h2 className="font-display text-[20px] leading-snug font-bold text-[var(--fg)]">
              {t.beforeTitle}
            </h2>
            <ul className="mt-6 grid gap-3">
              {t.beforeItems.map((item) => (
                <li key={item} className="relative pl-5 text-[14px] leading-relaxed text-[var(--fg-dim)]">
                  <span className="text-accent absolute left-0">—</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/"
              onNavigate={navigate}
              className="mt-8 inline-block text-[13.5px] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
            >
              ← {t.backHome}
            </Link>
          </motion.aside>

          <motion.div variants={riseChild} className="lg:col-span-8">
            <SupportForm />
          </motion.div>
        </div>
      </motion.div>
    </main>
  );
}
