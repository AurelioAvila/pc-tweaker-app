# Catalog feed maintenance

The publisher PAD feed is [docs/pad.xml](pad.xml). Its URL is stable; its contents are version-specific. Hosting is on the existing public GitHub repository, without a new subscription or scheduler.

Before updating the feed after a stable release:

1. Recheck the latest non-draft, non-prerelease release in this repository. Never substitute an older installer or relabel another version.
2. Verify the final artifact's SHA-256 against official release metadata, a valid Aurelio Avila Authenticode publisher signature and a trusted timestamp. Verify any updater-specific signature separately. Do not publish a download reference if these checks fail.
3. Update Program_Version, the release date, file sizes, change summary and Primary_Download_URL together. Keep the feed URL unchanged. Paid access, supported features and screenshot provenance must remain accurate.
4. Validate XML, description lengths, HTTPS URLs and the referenced icon/screenshot. Windows 10/11 x64 requirements are stated explicitly; WinOther is the legacy PAD 3.11 OS enumeration, not a Windows 7 compatibility claim.
5. Commit only verified publisher metadata. Download3K says it refreshes existing PAD feeds daily; acceptance and indexing remain editorial decisions. Do not create a duplicate application for every release.

This is self-hosted PAD 3.11 metadata with HTTPS support, not AppVisor certification. The feed does not regenerate automatically. Existing signing and release workflows are unchanged. Catalog submission, review and public publication are different states.
