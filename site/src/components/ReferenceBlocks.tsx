import { useState } from "react";
import { DOWNLOAD_EXE } from "../constants";
import { useCampaignStoreLink } from "../campaign-store";
import { euro } from "../promo";
import { usePriceList } from "../trial";

/** The facts of a page, as a table, before the prose. */
export function TechSummary({ rows, title = "Technical summary" }: { rows: readonly { label: string; value: string }[]; title?: string }) {
  return (
    <aside aria-label={title} className="mt-10 rounded-2xl border border-white/10 bg-[var(--bg-2)] p-6 md:p-7">
      <h2 className="font-mono-t text-accent text-[12px] tracking-[0.15em]">{title.toUpperCase()}</h2>
      <table className="mt-4 w-full border-collapse text-left text-[14px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-white/5 align-top">
              <th scope="row" className="w-[38%] py-2.5 pr-4 font-medium text-[var(--fg-dim)]">{r.label}</th>
              <td className="py-2.5 break-words text-[var(--fg)] [overflow-wrap:anywhere]">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}

export interface Step {
  readonly title: string;
  readonly note?: string;
  readonly code?: string;
  readonly shell?: "cmd" | "PowerShell";
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }, () => undefined)}
      className="font-mono-t absolute top-2 right-2 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--fg-dim)] hover:text-[var(--fg)]"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Numbered steps with paste-ready commands. */
export function Steps({ steps, start = 1 }: { steps: readonly Step[]; start?: number }) {
  return (
    <ol className="mt-5 space-y-5" start={start}>
      {steps.map((s, i) => (
        <li key={s.title + i} className="grid grid-cols-[2rem_1fr] gap-3">
          <span className="font-mono-t text-accent pt-0.5 text-[13px]" aria-hidden="true">{String(start + i).padStart(2, "0")}</span>
          <div className="min-w-0">
            <h3 className="text-[15.5px] font-semibold text-[var(--fg)]">{s.title}</h3>
            {s.note && <p className="mt-1.5 text-[14.5px] leading-7 text-[var(--fg-dim)]">{s.note}</p>}
            {s.code && (
              <div className="relative mt-3">
                <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 pr-16 text-[13px] leading-6 text-[var(--fg)]"><code>{s.code}</code></pre>
                {s.shell && <span className="font-mono-t absolute bottom-2 right-3 text-[10.5px] text-[var(--fg-dim)]">{s.shell}</span>}
                <CopyButton text={s.code} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The quiet product box on technical pages. Prices and the trial come from
 * the billing API after hydration (GET /api/billing/prices); the prerendered
 * page names no price and promises no trial, and a failed read leaves it so.
 */
export function ProBox({ campaign }: { campaign: string }) {
  const prices = usePriceList();
  const storeLink = useCampaignStoreLink(campaign);
  const monthly = prices?.prices.find((p) => p.product === "pctweaker" && p.plan === "monthly");
  const annual = prices?.prices.find((p) => p.product === "pctweaker" && p.plan === "annual");
  const plans = monthly ? `${euro(monthly.amount)} a month${annual ? ` or ${euro(annual.amount)} a year` : ""}` : "";
  const trial = prices?.trialEnabled && prices.trialDays > 0 ? prices.trialDays : 0;
  return (
    <aside aria-label="PC Tweaker" className="mt-8 rounded-2xl border p-6 md:p-7" style={{ borderColor: "var(--accent-glow)", background: "linear-gradient(160deg, var(--bg-2) 70%, var(--accent-soft))" }}>
      <h2 className="font-display text-xl font-bold text-[var(--fg)]">Rather not edit the registry by hand?</h2>
      <p className="mt-3 text-[15px] leading-7 text-[var(--fg-dim)]">
        PC Tweaker shows the exact change before it runs, records the value it replaces and puts it back with Restore.
        The Free plan needs no account.
        {trial > 0 && plans && (
          <>
            {" "}Pro has a {trial}-day free trial on the monthly and annual plans. It needs a card or another payment method,
            and the first charge comes after {trial} days unless you cancel from the billing portal first. Then Pro costs{" "}
            {plans}; VAT, where it applies, is shown at checkout.
          </>
        )}
        {trial === 0 && plans && <> Pro costs {plans}; VAT, where it applies, is shown at checkout.</>}
        {" "}If a payment fails or a plan ends, Pro tools lock; changes already applied stay as they are and Restore still undoes them.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={DOWNLOAD_EXE} className="bg-accent rounded-lg px-5 py-3 text-sm font-semibold text-[var(--on-accent)]">Download PC Tweaker Free</a>
        <a href={storeLink} className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-[var(--fg)]">Get it from Microsoft Store</a>
      </div>
    </aside>
  );
}

export function SourceList({ checked, items }: { checked: string; items: readonly { label: string; url: string }[] }) {
  return (
    <nav aria-label="Sources" className="mt-10 text-sm text-[var(--fg-dim)]">
      <p>Facts on this page were checked against these sources on {checked}:</p>
      <ul className="mt-3 space-y-1.5">
        {items.map((s) => (
          <li key={s.url}><a href={s.url} className="text-accent" rel="noopener">{s.label}</a></li>
        ))}
      </ul>
    </nav>
  );
}
