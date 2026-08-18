import { createPrivateKey, sign } from "crypto";

/**
 * Signs the desktop app's local Pro entitlement check.
 *
 * `apply_tweak` in the Rust binary used to trust `requires_pro` — a flag
 * baked into the compiled tweak list — with no server-side check at all.
 * That made "is this user allowed to run this tweak" a question the client
 * answered entirely on its own, which is exactly the situation the desktop
 * app cannot be trusted to answer honestly: it's the user's own machine,
 * running code the user's own machine executes.
 *
 * The fix is a small, offline-tolerant license the server signs and the
 * client can verify without calling home for every tweak. `apply_tweak`
 * checks the signature and a short freshness window before running anything
 * `requires_pro`, so the enforcement point moves to code the client cannot
 * edit without also breaking the signature check itself.
 *
 * This key pair is dedicated to license signing — deliberately separate
 * from the Tauri updater's signing key, so a compromise of one never
 * implicates the other.
 */

const PRIVATE_KEY_B64 = process.env.LICENSE_SIGNING_PRIVATE_KEY;

export const isConfigured = Boolean(PRIVATE_KEY_B64);

function loadPrivateKey() {
  if (!PRIVATE_KEY_B64) {
    throw new Error("LICENSE_SIGNING_PRIVATE_KEY is not configured on the server");
  }
  return createPrivateKey({
    key: Buffer.from(PRIVATE_KEY_B64, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

export type LicensePayload = {
  userId: string;
  isPro: boolean;
  plan: string | null;
  /** Unix seconds. The client measures freshness from this, not from when
   *  it happened to fetch — a cached-and-replayed response can't be made to
   *  look newer than it is. */
  issuedAt: number;
};

export type SignedLicense = {
  /**
   * The exact JSON string that was signed, verbatim. Deliberately not a
   * nested object: if the client had to re-serialize a `payload` field
   * itself to check the signature, any difference in key order or
   * whitespace between Node's and Rust's JSON writers — even one that never
   * shows up in testing — would make every signature fail verification, or
   * worse, only fail it intermittently. Shipping the signed bytes as a
   * single opaque string means there is never a second serialization to
   * disagree with the first: the client verifies these exact bytes, then
   * parses them, in that order.
   */
  payloadJson: string;
  /** Base64 Ed25519 signature over `payloadJson`'s UTF-8 bytes, verbatim. */
  signature: string;
};

export function signLicense(payload: LicensePayload): SignedLicense {
  const key = loadPrivateKey();
  const payloadJson = JSON.stringify(payload);
  const bytes = Buffer.from(payloadJson, "utf8");
  // `null` as the algorithm parameter is Ed25519's own calling convention in
  // Node's crypto module — the curve doesn't take a separate digest
  // algorithm the way RSA/ECDSA do, it hashes internally.
  const signature = sign(null, bytes, key);
  return { payloadJson, signature: signature.toString("base64") };
}
