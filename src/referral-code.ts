/** Short invitation codes ignore case; existing long links preserve it. */
export function normalizeInvitationCode(value: string): string | null {
  const code = value.trim();
  if (code.length === 10) {
    if (!/^[A-Za-z2-9]{10}$/.test(code)) return null;
    const upper = code.toUpperCase();
    return /^[A-HJ-NP-Z2-9]{10}$/.test(upper) && /[A-Z]/.test(upper) && /[2-9]/.test(upper)
      ? upper
      : null;
  }
  return /^[A-Za-z0-9_-]{22}$/.test(code) ? code : null;
}
