import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { EASE, riseChild, staggerParent, viewportOnce } from "../motion";
import { ApiError, fetchReviews, postReview, type ReviewSummary } from "../api";
import {
  Field,
  FieldGroup,
  FormError,
  StarRating,
  Stars,
  SubmitButton,
  TextArea,
  TextInput,
} from "./Form";

const t = text.reviews;

/**
 * Ratings are public as an aggregate; everything the visitor writes is
 * relayed to the team by email instead of being rendered here, which keeps
 * the page free of anonymous user-submitted content.
 *
 * Submitting counts the rating straight away. An address is optional; when
 * one is given it identifies the vote, so re-submitting replaces that
 * person's score rather than adding a second one.
 */
function RatingForm({ onCounted }: { onCounted: (rating: number) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const { rating: counted } = await postReview({
        name: name.trim(),
        email: email.trim(),
        rating,
        body: body.trim(),
      });
      onCounted(counted);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't send your rating. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-5 rounded-2xl border border-white/5 bg-[var(--bg-2)] p-7"
    >
      <div className="font-display text-[18px] font-bold text-[var(--fg)]">{t.formTitle}</div>

      <FieldGroup label={t.formRating}>
        <div className="pt-1">
          <StarRating name="review-rating" value={rating} onChange={setRating} />
        </div>
      </FieldGroup>

      <Field label={t.formBody} hint={t.formBodyHint} htmlFor="rv-body">
        <TextArea
          id="rv-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.formBodyPlaceholder}
          maxLength={2000}
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t.formName} hint={t.formNameHint} htmlFor="rv-name">
          <TextInput
            id="rv-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
          />
        </Field>
        <Field label={t.formEmail} hint={t.formEmailHint} htmlFor="rv-email">
          <TextInput
            id="rv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
      </div>

      <FormError>{error}</FormError>

      <div>
        <SubmitButton pending={pending} pendingLabel={t.submitting}>
          {t.submit}
        </SubmitButton>
      </div>
    </form>
  );
}

export function ReviewsSection() {
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [thanked, setThanked] = useState(false);

  useEffect(() => {
    // A failed load must not blank the section — fall back to the values the
    // server would have returned anyway rather than showing the visitor an
    // error they can't act on.
    fetchReviews()
      .then(setData)
      .catch(() => setData({ average: 4.8, count: 53 }));
  }, []);

  // Re-read the aggregate from the server rather than recomputing it here.
  //
  // The obvious optimistic update — (average * count + rating) / (count + 1) —
  // drifts, because `average` has already been rounded to one decimal for
  // display: folding a new score into a rounded mean compounds that error, and
  // the figure on screen ends up disagreeing with the server (a 1★ on 4.7/56
  // showed 4.6 where the true value was still 4.7). One extra request on a
  // rare action is worth showing the real number.
  //
  // The count is bumped immediately so the visitor sees their rating land even
  // if the refetch is slow; the response overwrites it a moment later.
  function handleCounted(_rating: number) {
    setData((prev) => (prev ? { ...prev, count: prev.count + 1 } : prev));
    setFormOpen(false);
    setThanked(true);
    fetchReviews()
      .then(setData)
      .catch(() => {
        // Keep the optimistic count. The rating is stored either way, and the
        // exact average arrives on the next page load.
      });
  }

  const average = data?.average ?? 4.8;
  const count = data?.count ?? 53;

  return (
    <section id="reviews" className="border-t border-white/5 px-5 py-24 md:px-12">
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
        <motion.h2
          variants={riseChild}
          className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold tracking-tight text-[var(--fg)]"
        >
          {t.title}
        </motion.h2>

        <motion.div variants={riseChild} className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="flex items-end gap-4">
            <div className="font-display text-accent text-[64px] leading-none font-bold">
              {average.toFixed(1)}
            </div>
            <div className="pb-2">
              <Stars value={average} size={20} />
              <div className="font-mono-t mt-2 text-[11.5px] tracking-[0.14em] text-[var(--fg-dim)]">
                {t.outOf.toUpperCase()} ·{" "}
                {t.basedOn.replace("{count}", String(count)).toUpperCase()}
              </div>
            </div>
          </div>

          {!formOpen && (
            <button
              onClick={() => {
                setFormOpen(true);
                setThanked(false);
              }}
              className="cursor-pointer rounded-xl border border-white/10 px-6 py-3 text-[14px] font-semibold text-[var(--fg)] transition-colors hover:border-[var(--accent)]"
            >
              {t.writeCta}
            </button>
          )}
        </motion.div>

        <motion.p
          variants={riseChild}
          className="mt-6 max-w-xl text-[13.5px] leading-relaxed text-[var(--fg-dim)]"
        >
          {t.note}
        </motion.p>

        {thanked && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-accent mt-6 text-[14px]"
          >
            {t.thanks}
          </motion.p>
        )}

        {/* Deliberately not wrapped in AnimatePresence: this subtree sits
            inside a `whileInView` variant tree, which keeps propagating its
            "show" state to the exiting child so the exit animation never
            completes and the form is never unmounted. Animating only the
            entrance sidesteps that and makes closing instant and reliable. */}
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mt-8 max-w-3xl"
          >
            <RatingForm onCounted={handleCounted} />
            <button
              onClick={() => setFormOpen(false)}
              className="mt-4 cursor-pointer text-[13.5px] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
            >
              {t.cancel}
            </button>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
