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
    let mut fields = comment.split('\t');
    let timestamp = fields.next().unwrap_or_default();
    let Some(filename) = fields.next().and_then(|field| field.strip_prefix("file:")) else { return false };
    if timestamp.is_empty() || !timestamp.bytes().all(|byte| byte.is_ascii_digit()) {
        return false;
    }
    // `tauri build` from CLI 2.12 also signs `version:<v>`. Clients up to
    // 1.15.0 read that field as part of the filename and never see the update,
    // so releases are still re-signed without it; when present it must agree.
    if fields.any(|field| field.strip_prefix("version:").is_some_and(|signed| signed != version)) {
        return false;
    }
    let expected = [
        format!("pc-tweaker-app_{version}_x64-setup.exe"),
        format!("pc-tweaker-app_{version}_x64_en-US.msi"),
    ];
    expected.contains(&filename.to_string())
        && RELEASE_HOSTS
            .iter()
            .any(|base| platform.url.as_str() == format!("{base}/v{version}/{filename}"))
}

// Where a signed installer may be downloaded from: the GitHub release, or the
// same bytes on our own download domain (my-apps/tools/github-indipendenza).
// The minisign signature covers the bytes, so the host only has to be ours.
const RELEASE_HOSTS: [&str; 2] = [
    "https://github.com/AurelioAvila/pc-tweaker-app/releases/download",
    "https://dl.pctweaker.app/pc-tweaker",
];

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
        signed(&format!("timestamp:123\tfile:pc-tweaker-app_{signed_version}_x64-setup.exe"), offered_version)
    }

    fn signed(trusted_comment: &str, offered_version: &str) -> ReleaseManifestPlatform {
        ReleaseManifestPlatform {
            url: format!("https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v{offered_version}/pc-tweaker-app_{offered_version}_x64-setup.exe").parse().unwrap(),
            // Identity-gate fixture only; the updater must independently reject
            // this non-cryptographic signature before installing any artifact.
            signature: STANDARD.encode(format!("untrusted comment: fixture\nfixture\ntrusted comment: {trusted_comment}\nfixture\n")),
        }
    }

    #[test]
    fn a_signed_version_field_is_accepted_only_when_it_agrees() {
        let file = "file:pc-tweaker-app_1.15.0_x64-setup.exe";
        assert!(matches(&signed(&format!("timestamp:1790508346\t{file}\tversion:1.15.0"), "1.15.0"), "1.15.0"));
        assert!(!matches(&signed(&format!("timestamp:1790508346\t{file}\tversion:1.14.10"), "1.15.0"), "1.15.0"));
        assert!(!matches(&signed("timestamp:1790508346\tversion:1.15.0", "1.15.0"), "1.15.0"));
        assert!(!matches(&signed(&format!("timestamp:\t{file}"), "1.15.0"), "1.15.0"));
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

    #[test]
    fn our_download_domain_serves_the_same_signed_file() {
        let mut ours = platform("2.0.0", "2.0.0");
        ours.url = "https://dl.pctweaker.app/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe".parse().unwrap();
        assert!(matches(&ours, "2.0.0"));
        // Same domain, but another version's folder or a look-alike host.
        ours.url = "https://dl.pctweaker.app/pc-tweaker/v1.0.0/pc-tweaker-app_2.0.0_x64-setup.exe".parse().unwrap();
        assert!(!matches(&ours, "2.0.0"));
        ours.url = "https://dl.pctweaker.app.example.com/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe".parse().unwrap();
        assert!(!matches(&ours, "2.0.0"));
    }
}
