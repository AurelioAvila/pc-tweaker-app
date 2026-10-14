import trust from "../generated/release-trust.json";

export type TrustProduct = "pc-tweaker" | "uninstaller" | "tweaky-driver";

/**
 * "Verify this download": the SHA-256 and Authenticode status of the published
 * installer. Nothing here is typed by hand: scripts/release-trust.mjs reads the
 * release asset, re-downloads it, and refuses to write the record unless the
 * hash matches GitHub's digest and Windows reports the signature as Valid. The
 * release checklist reruns it, so the page cannot describe an older build.
 * `saveAs` is the file name the visitor ends up with after the download link.
 */
export function ReleaseTrust({ product, saveAs }: { product: TrustProduct; saveAs: string }) {
  const r = trust[product];
  return (
    <details className="mt-3 max-w-md text-[12.5px] leading-relaxed text-[var(--fg-dim)]" data-release-trust={product}>
      <summary className="cursor-pointer font-medium text-[var(--fg)]">Verify this download (v{r.version})</summary>
      <p className="mt-2">
        {saveAs} is the installer of release v{r.version}. Its SHA-256 is{" "}
        <code className="font-mono-t break-all text-[var(--fg)]">{r.sha256}</code>.
      </p>
      <p className="mt-2">
        Authenticode signature: {r.signature.status}, publisher {r.signature.signer}
        {r.signature.timestamped ? ", with a trusted timestamp" : ""}. Certificate thumbprint{" "}
        <code className="font-mono-t break-all">{r.signature.thumbprint}</code>.
      </p>
      <p className="mt-2">Check it yourself in PowerShell, from the folder you saved it to:</p>
      <pre className="font-mono-t mt-1 overflow-x-auto rounded-md bg-black/20 p-2 text-[11.5px] text-[var(--fg)]">{`Get-FileHash .\${saveAs} -Algorithm SHA256\nGet-AuthenticodeSignature .\${saveAs} | Format-List Status, SignerCertificate`}</pre>
    </details>
  );
}
