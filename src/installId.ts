/**
 * A random identifier for this installation, sent with licence refreshes so
 * the server can count on how many installations an account is used (see
 * PRIVACY.md). Generated here, never derived from the hardware, and only
 * counted: no licence decision depends on it.
 */
export const INSTALL_ID_KEY = "pc-tweaker-install-id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function installId(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): string | null {
  try {
    const stored = storage.getItem(INSTALL_ID_KEY);
    if (stored && UUID_V4.test(stored)) return stored;
    const fresh = crypto.randomUUID();
    storage.setItem(INSTALL_ID_KEY, fresh);
    return fresh;
  } catch {
    // Storage unavailable: send nothing rather than a new id every time.
    return null;
  }
}
