# PC Tweaker desktop UI

Use the frontend-design MCP and refactor-ui principles: a restrained desktop workspace with clear hierarchy, practical density and evidence before actions. Preserve the original logo.

- Default theme: original released Violet, raised `#1b1230`, canvas `#10091f`, accent `#ff5c8a`. Preserve stored choices. All 14 themes must apply independently without a later root rule overriding them.
- Full-width header: page title left; search and account anchored to the right content gutter. Center bounded page content below it, independently of the header. Main views max 1120px; Scan max 1240px.
- Scan is the first navigation entry and default landing page. Its dedicated workspace leads with a 180px circular primary action, large heading, real check progress and a compact scope list. No decorative radar or invented health score. Native progress stays factual; the user requested a minimum eight-second presentation with a separately labelled result-preparation phase and one determinate progress ring with a centered percentage.
- Scan reads Windows settings, supported recommendations, hardware profile, storage, startup, memory, pending reboot, security signals and driver dates. Completed reads are distinct from healthy results. Unavailable readings remain unknown. Driver age is not proof of obsolescence; enabled startup apps are not automatically faults.
- Results distinguish supported recommended settings from manual review items. Fix all opens an exact review, revalidates eligibility, applies only approved supported settings, then verifies actual state. Never silently delete files, change security, disable startup apps or install drivers. Preserve results while visiting another section in the same session.
- RAM cleanup, its existing schedule and live system readings belong in Maintenance; scheduling remains owned by the app, independent of navigation.
- Account menu: compact closed rows for account, language, theme, error reporting and about. Native disclosure controls show options only on click. Theme choices include their names, not unexplained color dots. Keep login, verification, account photos, support and subscription actions functional.
- Main typography: Inter Variable; page 28px, Scan hero 26–36px, section 18–20px, item 14px, body 12–14px. Off-white text and readable muted labels. Card radii 12–18px, controls 7px, badges pill-shaped.
- Use a single accent for primary actions. Hover 150ms, active scale .98, keyboard-visible focus, native dialog review, reduced-motion support, skeletons during reads and inline applying state.
- Keep Plans & pricing and Buy me a coffee outside the scrolling sidebar. Alternative themes, license enforcement, signed-release requirements and the original icon remain intact.

Implementation: shell in `desktop-refresh.css`; shared tools in `tool-surfaces.css`; Scan in `scan.tsx`, `scan-runner.ts`, `scan-copy.ts`, `scan-workspace.css`; menu in `account.tsx` and `account-menu.css`. Reuse existing native commands and technical-change disclosure. No new dependencies.

This work is a local development preview pending the user's review. It does not authorize a release or website/pricing changes.

- Pro feature prompts use a native modal dialog, the selected theme, the actual feature name and a restrained plans action. Escape, keyboard focus and return focus are supported. No generic gold star or future-feature entitlement claims in this prompt.
- Performance/Gaming order follows broad applicability and scoped controls, mixing Free/Pro without sorting by price. Hardware-specific or security-reducing changes follow general controls. Order is presentation, not a recommendation to apply everything.
- Maintenance leads with RAM, then a shared drive workspace: selected drive, free health reading, Pro optimization and expandable detailed optimization. Unavailable health stays visible with retry; never present a failed read as healthy.
- Drive selection uses a fieldset with a separate legend and individual drive tiles. Keep at least 10px between label and options; no padded container with a label sitting on its border. Tool actions use tinted primary surfaces, quiet secondary actions and shared sizing across advanced controls. Tweak icons use semantic colored duotone SVGs (mouse/keyboard, CPU, GPU, memory, network); app and sidebar icons stay unchanged.

- Scan action: 180px circular control (216px during the scan) with a single visual ring, a plain magnifying glass at rest and a centered percentage during reads and labelled result presentation; displayed progress eases toward completed native reads without exceeding them. Fast native actions use a 500ms visual feedback window without delaying execution. Toggle progress stays inside the switch thumb; confirmed outcomes use the existing toast without an additional green rectangle or check beside the switch.
- Tweak icons use larger frameless duotone hardware symbols with a subtle halo. Finite hover/focus details animate GPU fans, mouse wheels and keyboard/CPU highlights, with no continuous idle motion. Respect reduced motion; keep the app icon, sidebar and original Violet palette.
- Debloat: real installed-package icons, 13 verified optional-app identities, category filters, explicit selection and per-app removal consequences. Never preselect apps or weaken publisher/dependency/removability checks. Missing icons use text initials. Desktop rows form a two-column library; narrow windows use one column.


- CPU Load always shows measured utilization, including during activation; no redline band or invented minimum. Debloat adds localized sorting, selected-only filtering and verified Store links.

- Palette explicitly confirmed by screenshot on 28 September 2026: original 1.15.0 Violet, dark purple surfaces with pink accents. Do not replace it with Royal Gold or Indigo Night. Preserve other users’ explicit theme choices.


- Scan progress uses the existing native driver-scan-progress events: driver categories contribute 60% of weighted checks; other probes contribute 40%. The numeric display advances at most 12.5 points/second and never exceeds completed weighted work. 100% requires the final report. Show current device class, real done/total count and elapsed time. Single ring, no duplicate visible progress bar. Inspiration: IObit Advanced SystemCare official scan-screen and manual (https://www.iobit.com/product-manuals/asc-help/); retain PC Tweaker identity and explicit review before changes.


- Completed Scan collapses its launch/scope area and focuses the result section. When no automatic fixes are eligible, manual findings and neutral, scan-allowlisted optional choices lead. Neutral options require review in their existing category, never Fix all. Pro-only recommended settings remain visible with an account explanation. Zero fixes is not proof of zero review items.
