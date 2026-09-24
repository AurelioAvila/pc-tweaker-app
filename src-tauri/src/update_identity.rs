use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri_plugin_updater::{ReleaseManifestPlatform, RemoteReleaseInner};

// The plugin verifies both artifact bytes and this minisign trusted comment
// before installation. Bind the offered version to that authenticated filename;
// checking only the unsigned manifest version permits replay of old installers.
fn matches(platform: &ReleaseManifestPlatform, version: &str) -> bool {
    let Ok(decoded) = STANDARD.decode(&platform.signature) else { return false };
    let Ok(text) = std::str::from_utf8(&decoded) else { return false };
    let Some(comment) = text.lines().nth(2).and_then(|line| line.strip_prefix("trusted comment: timestamp:")) else {
        return false;
    };
    let Some((timestamp, filename)) = comment.split_once("\tfile:") else { return false };
    if timestamp.is_empty() || !timestamp.bytes().all(|byte| byte.is_ascii_digit()) {
        return false;
    }
    let expected = [
        format!("pc-tweaker-app_{version}_x64-setup.exe"),
        format!("pc-tweaker-app_{version}_x64_en-US.msi"),
    ];
    expected.contains(&filename.to_string())
        && platform.url.as_str()
            == format!("https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v{version}/{filename}")
}

pub fn release_matches(version: &str, data: &RemoteReleaseInner) -> bool {
    match data {
        RemoteReleaseInner::Dynamic(platform) => matches(platform, version),
        RemoteReleaseInner::Static { platforms } => {
            !platforms.is_empty() && platforms.values().all(|platform| matches(platform, version))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn platform(signed_version: &str, offered_version: &str) -> ReleaseManifestPlatform {
        let name = format!("pc-tweaker-app_{signed_version}_x64-setup.exe");
        ReleaseManifestPlatform {
            url: format!("https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v{offered_version}/pc-tweaker-app_{offered_version}_x64-setup.exe").parse().unwrap(),
            // Identity-gate fixture only; the updater must independently reject
            // this non-cryptographic signature before installing any artifact.
            signature: STANDARD.encode(format!("untrusted comment: fixture\nfixture\ntrusted comment: timestamp:123\tfile:{name}\nfixture\n")),
        }
    }

    #[test]
    fn old_signature_cannot_advertise_a_new_version() {
        assert!(matches(&platform("2.0.0", "2.0.0"), "2.0.0"));
        assert!(!matches(&platform("1.0.0", "2.0.0"), "2.0.0"));
        let mut malformed = platform("2.0.0", "2.0.0");
        malformed.signature = "invalid".into();
        assert!(!matches(&malformed, "2.0.0"));
        let mut wrong_host = platform("2.0.0", "2.0.0");
        wrong_host.url = "https://example.com/installer.exe".parse().unwrap();
        assert!(!matches(&wrong_host, "2.0.0"));
    }
}
