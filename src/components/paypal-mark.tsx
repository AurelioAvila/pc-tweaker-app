import paypalWhite from "../assets/paypal-white.svg";

/** `text` with its word "PayPal" drawn as PayPal's official white logo, for
 *  dark backgrounds (the logo PayPal's own black and blue buttons use:
 *  https://www.paypalobjects.com/js-sdk-logos/2.3.7/paypal-white.svg, kept
 *  byte for byte, sha256 3f8c62b3…222f2). The image's alt keeps the text whole
 *  for screen readers. `height` is a CSS length; the logo sits on the text's
 *  baseline (the wordmark's baseline is 24% above the bottom of its box).
 *  Shared with the site. */
export function PaypalText({ text, height }: { text: string; height: string }) {
  const [before, after = ""] = text.split("PayPal");
  return (
    <>
      {before}
      <img
        src={paypalWhite}
        alt="PayPal"
        draggable={false}
        style={{
          display: "inline",
          height,
          width: "auto",
          maxWidth: "none",
          margin: "0 0.1em",
          verticalAlign: `calc(${height} * -0.24)`,
        }}
      />
      {after}
    </>
  );
}
