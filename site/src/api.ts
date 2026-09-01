import { API_BASE } from "./constants";

/**
 * The public rating carries no visitor-submitted text — written feedback is
 * relayed to the team by email and never returned by the API.
 */
export interface ReviewSummary {
  readonly average: number;
  readonly count: number;
}

/**
 * Thrown with a message safe to show the user. The backend sends a
 * human-readable `error` string for every 4xx/5xx it produces; anything else
 * (a proxy error page, a dropped connection) falls back to a generic line
 * rather than surfacing raw HTML or a stack trace.
 */
export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data.error === "string"
        ? data.error
        : "Something went wrong on our side. Please try again in a moment.";
    throw new ApiError(message);
  }
  return data as T;
}

export function fetchReviews(): Promise<ReviewSummary> {
  return request<ReviewSummary>("/api/reviews");
}

/** Opens a Stripe Checkout for a one-off tip. No login, nothing unlocked.
 *  The count is clamped server-side, so this argument is convenience only. */
export function buyCoffee(quantity: number): Promise<{ url: string }> {
  return request("/api/tip", { method: "POST", body: JSON.stringify({ quantity }) });
}

/** Only `rating` is required; the rest are optional and stay private. */
export function postReview(input: {
  name: string;
  email: string;
  rating: number;
  body: string;
}): Promise<{ rating: number }> {
  return request("/api/reviews", { method: "POST", body: JSON.stringify(input) });
}

/** `company` is the honeypot field — always sent empty by real visitors. */
export function postNewsletterSignup(input: {
  email: string;
  source: string;
  company: string;
}): Promise<{ ok: true }> {
  return request("/api/newsletter", { method: "POST", body: JSON.stringify(input) });
}

export function postSupportRequest(input: {
  name: string;
  email: string;
  category: string;
  subject: string;
  systemInfo: string;
  message: string;
  company: string;
}): Promise<{ ok: true }> {
  return request("/api/support", { method: "POST", body: JSON.stringify(input) });
}
