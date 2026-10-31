//! Why the account service cannot be reached, asked only after the window's
//! own fetch() failed.
//!
//! WebView2 reports every network failure as the same bare "Failed to fetch",
//! so the sign-in screen could only say "check your internet connection" to a
//! customer whose internet was fine. The same request from the native side,
//! through the Windows certificate store and the system proxy (the updater's
//! reqwest), keeps the reason: a name that does not resolve, a connection that
//! is refused, a certificate replaced along the way or one the PC's clock
//! cannot accept, a timeout, or an answer that came back but not to the window.

use std::error::Error;
use std::time::Duration;

const PROBE_URL: &str = "https://api.pctweaker.app/health";

/// One word the frontend maps to a translated message: `reachable`,
/// `blocked`, `rate_limited`, `server`, `timeout`, `dns`, `clock`, `tls` or
/// `unknown`.
#[tauri::command]
pub async fn account_service_probe() -> String {
    probe().await.to_string()
}

async fn probe() -> &'static str {
    // Same provider the updater installs; whichever runs first wins.
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    let Ok(client) = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(12))
        .build()
    else {
        return "unknown";
    };
    match client.get(PROBE_URL).send().await {
        Ok(response) => match response.status().as_u16() {
            200..=299 => "reachable",
            429 => "rate_limited",
            500..=599 => "server",
            // A firewall, filter or challenge page answered instead of us.
            _ => "blocked",
        },
        Err(err) => classify(&err, err.is_timeout(), err.is_connect()),
    }
}

fn classify(err: &(dyn Error + 'static), timed_out: bool, connect: bool) -> &'static str {
    if timed_out {
        return "timeout";
    }
    let mut text = String::new();
    let mut current: Option<&(dyn Error + 'static)> = Some(err);
    while let Some(e) = current {
        if let Some(tls) = rustls_error(e) {
            return match tls {
                rustls::Error::InvalidCertificate(
                    rustls::CertificateError::Expired
                    | rustls::CertificateError::ExpiredContext { .. }
                    | rustls::CertificateError::NotValidYet
                    | rustls::CertificateError::NotValidYetContext { .. },
                ) => "clock",
                _ => "tls",
            };
        }
        text.push_str(&e.to_string());
        text.push('\n');
        current = e.source();
    }
    if text.contains("dns error") {
        "dns"
    } else if connect {
        "blocked"
    } else {
        "unknown"
    }
}

/// hyper-rustls hands the TLS failure up inside an io::Error, whose
/// `source()` skips the wrapped error itself, so look inside it too.
fn rustls_error<'a>(e: &'a (dyn Error + 'static)) -> Option<&'a rustls::Error> {
    e.downcast_ref::<rustls::Error>().or_else(|| {
        e.downcast_ref::<std::io::Error>()
            .and_then(|io| io.get_ref())
            .and_then(|inner| inner.downcast_ref::<rustls::Error>())
    })
}

#[cfg(test)]
mod tests {
    use super::classify;
    use std::io;

    fn tls(e: rustls::CertificateError) -> io::Error {
        io::Error::other(rustls::Error::InvalidCertificate(e))
    }

    #[test]
    fn names_the_reason() {
        assert_eq!(classify(&tls(rustls::CertificateError::Expired), false, true), "clock");
        assert_eq!(classify(&tls(rustls::CertificateError::NotValidYet), false, true), "clock");
        assert_eq!(classify(&tls(rustls::CertificateError::UnknownIssuer), false, true), "tls");
        let dns = io::Error::other("dns error: No such host is known.");
        assert_eq!(classify(&dns, false, true), "dns");
        let refused = io::Error::new(io::ErrorKind::ConnectionRefused, "refused");
        assert_eq!(classify(&refused, false, true), "blocked");
        assert_eq!(classify(&refused, true, true), "timeout");
        assert_eq!(classify(&refused, false, false), "unknown");
    }
}
