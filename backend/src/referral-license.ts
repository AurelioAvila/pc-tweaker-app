import { createPrivateKey, createPublicKey, sign } from "crypto";
import type { LicensePayload, SignedLicense } from "./license";

function issuerKey(environment: NodeJS.ProcessEnv) {
  const encoded = environment.REFERRALS_SIGNING_PRIVATE_KEY;
  if (!encoded) throw new Error("Referral signing is unavailable");
  const key = createPrivateKey({
    key: Buffer.from(encoded, "base64"),
    type: "pkcs8",
    format: "der",
  });
  if (key.asymmetricKeyType !== "ed25519") throw new Error("Invalid referral signing key");
  const publicKey = createPublicKey(key)
    .export({ type: "spki", format: "der" })
    .subarray(-32)
    .toString("base64");
  if (
    publicKey === "QisYr46g3mqEeiz1BDyEcPbRO1xO4z0lR3d5/ODppIU=" ||
    publicKey !== environment.REFERRALS_NATIVE_PUBLIC_KEY
  ) {
    throw new Error("Referral signer must be distinct and match the native bonus issuer");
  }
  return key;
}

export function referralSignerReady(environment: NodeJS.ProcessEnv): boolean {
  try {
    issuerKey(environment);
    return true;
  } catch {
    return false;
  }
}

/** A distinct key is essential: legacy clients ignore additional JSON fields. */
export function signReferralLicense(
  payload: LicensePayload,
  environment: NodeJS.ProcessEnv,
): SignedLicense {
  if (
    payload.plan !== "referral_bonus" ||
    payload.schemaVersion !== 2 ||
    !payload.deviceKeyHash ||
    !payload.sessionHash
  ) {
    throw new Error("Invalid referral licence");
  }
  const key = issuerKey(environment);
  const payloadJson = JSON.stringify(payload);
  return { payloadJson, signature: sign(null, Buffer.from(payloadJson), key).toString("base64") };
}
