/** How this PC is named in the account's PC list: the Windows edition and
 *  the processor, as Windows reports them ("Windows 11 Pro · AMD Ryzen 7
 *  5800X3D 8-Core Processor"). Never the computer or user name. */
export function pcLabel(
  os: string | null | undefined,
  cpu: string | null | undefined,
): string | null {
  const tidyCpu = (cpu ?? "")
    .replace(/\((?:R|TM)\)/gi, "")
    .replace(/\s+CPU\s+@.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = [(os ?? "").replace(/\s+/g, " ").trim(), tidyCpu === "CPU" ? "" : tidyCpu];
  const label = parts.filter(Boolean).join(" · ").slice(0, 80);
  return label || null;
}
