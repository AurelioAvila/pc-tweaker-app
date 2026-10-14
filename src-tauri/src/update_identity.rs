use base64::{engine::general_purpose::STANDARD, Engine as _};
use semver::Version;
use tauri_plugin_updater::{ReleaseManifestPlatform, RemoteRelease, RemoteReleaseInner};

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
// The URL must be exactly the versioned file: no other host, scheme, port,
// user info, query, product folder or version-less alias (those redirect to
// whatever is latest). The minisign signature still covers the bytes.
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

/// The updater's version comparator: offer only a newer version whose signed
/// file name and download address match it. Equal or older is never offered,
/// whichever endpoint answered first.
pub fn should_update(current: &Version, release: &RemoteRelease) -> bool {
    release.version > *current && release_matches(&release.version.to_string(), &release.data)
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

    fn at(url: &str, version: &str) -> ReleaseManifestPlatform {
        let mut p = platform(version, version);
        p.url = url.parse().unwrap();
        p
    }

    // The manifest exactly as the plugin parses it from either endpoint.
    fn manifest(version: &str, url: &str, signature: &str) -> RemoteRelease {
        serde_json::from_value(serde_json::json!({
            "version": version,
            "platforms": { "windows-x86_64": { "url": url, "signature": signature } }
        }))
        .unwrap()
    }

    // 1.18.3 as published (latest.json of the GitHub release): real updater
    // signature, file pc-tweaker-app_1.18.3_x64-setup.exe.
    const SIGNATURE_1_18_3: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUU01vWTBZbmRBR2xyc1cwZlUvWFBhWWdkYUk1ODhSU1h5QUY5MkNtME9GNjkwemVEbDlRRWY0d2gxbkVZRWo0WkNPYWRsc1Y2TnhoNHpTK3I2QXVYT2ZSMGxYVjJGQXdrPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkxOTk0MjY2CWZpbGU6cGMtdHdlYWtlci1hcHBfMS4xOC4zX3g2NC1zZXR1cC5leGUKOEU4Rlg1MkxxWElQMm1pemZCY1FYRFNEcllTMXBvci9pQ1cyOTQ1MnFuLzVPSWF0N21LSFFvbUNjZktmTWJna1ZVWHdnUmVYOEhjRTVpRnd2NkpiQ3c9PQo=";

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
        let ok = "https://dl.pctweaker.app/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe";
        assert!(matches(&at(ok, "2.0.0"), "2.0.0"));
        // URL normalisation (case, default port) still names the same file.
        assert!(matches(&at("https://DL.pctweaker.app:443/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe", "2.0.0"), "2.0.0"));
    }

    #[test]
    fn anything_but_the_exact_versioned_file_is_refused() {
        for url in [
            // Another version's folder, another product's folder, the bare host.
            "https://dl.pctweaker.app/pc-tweaker/v1.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://dl.pctweaker.app/uninstaller/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://dl.pctweaker.app/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            // External and look-alike hosts.
            "https://example.com/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://dl.pctweaker.app.example.com/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://evil.pctweaker.app/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://dl.pctweaker.app@example.com/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://user@dl.pctweaker.app/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://github.com/someone-else/pc-tweaker-app/releases/download/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            // Plain HTTP, another port.
            "http://dl.pctweaker.app/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://dl.pctweaker.app:8443/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            // Redirects: version-less aliases (302 to whatever is latest), a
            // redirect parameter, a fragment, a path that climbs out.
            "https://dl.pctweaker.app/pc-tweaker/PCTweaker-Setup.exe",
            "https://github.com/AurelioAvila/pc-tweaker-app/releases/latest/download/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://dl.pctweaker.app/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe?to=https://example.com/x.exe",
            "https://dl.pctweaker.app/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe#x",
            "https://dl.pctweaker.app/pc-tweaker/v2.0.0/../../redaxa/v2.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            "https://dl.pctweaker.app/pc-tweaker/v2.0.0/%2e%2e/v1.0.0/pc-tweaker-app_2.0.0_x64-setup.exe",
            // Another file name than the signed one.
            "https://dl.pctweaker.app/pc-tweaker/v2.0.0/pc-tweaker-app_2.0.0_x64_en-US.msi",
        ] {
            assert!(!matches(&at(url, "2.0.0"), "2.0.0"), "accepted {url}");
        }
    }

    #[test]
    fn the_published_release_is_accepted_from_either_host_and_never_as_a_downgrade() {
        let github = "https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v1.18.3/pc-tweaker-app_1.18.3_x64-setup.exe";
        let ours = "https://dl.pctweaker.app/pc-tweaker/v1.18.3/pc-tweaker-app_1.18.3_x64-setup.exe";
        let older = Version::parse("1.18.2").unwrap();
        for url in [github, ours] {
            assert!(should_update(&older, &manifest("1.18.3", url, SIGNATURE_1_18_3)), "{url}");
            // Same or newer installed: nothing to do, from either endpoint.
            assert!(!should_update(&Version::parse("1.18.3").unwrap(), &manifest("1.18.3", url, SIGNATURE_1_18_3)));
            assert!(!should_update(&Version::parse("1.18.4").unwrap(), &manifest("1.18.3", url, SIGNATURE_1_18_3)));
        }
        // The 1.18.3 file advertised as a newer version (replay), from either host.
        let replay = "https://dl.pctweaker.app/pc-tweaker/v1.19.0/pc-tweaker-app_1.18.3_x64-setup.exe";
        assert!(!should_update(&older, &manifest("1.19.0", replay, SIGNATURE_1_18_3)));
        assert!(!should_update(&older, &manifest("1.19.0", ours, SIGNATURE_1_18_3)));
        // An outside host with the real signature.
        let outside = "https://example.com/pc-tweaker/v1.18.3/pc-tweaker-app_1.18.3_x64-setup.exe";
        assert!(!should_update(&older, &manifest("1.18.3", outside, SIGNATURE_1_18_3)));
    }
}
