# TikTok/Reels video scripts — PC Tweaker

Format: 15-30s, vertical 9:16, screen recording of the app + optional webcam/voice.
Recording: Win+Alt+R (Xbox Game Bar) or OBS at 1080x1920/60fps on the app in a
window, then editing in CapCut (free, and it already has the animated-text
templates).

## What the 2026 research says (data, not theory)

- **The first 3 seconds decide everything**: 65% of users scroll away before the
  fourth second. The algorithm does not push a video that fails to hold the
  viewer inside that window. The hook needs 3 **simultaneous** elements: visual
  movement, a spoken hook (10-14 words), and the same hook written as an overlay
  (for people watching without audio). ([riffkit.ai](https://riffkit.ai/blog/viral-hook-formula), [go-viral.app](https://www.go-viral.app/blog/hook-first-3-seconds/))
- **The emotion you pick changes everything**: videos built on a fear/risk
  trigger ("you're doing this wrong", "this is damaging your PC") average
  **49 times** the views of videos built on a generic hope/benefit trigger. The
  best-performing hook formulas in 2026 are *Contrarian Claim*, *Mistake
  Warning* and *List Tease*. ([thecontentlabs.app](https://thecontentlabs.app/blog/what-goes-viral-in-2026-data-study))
- **Originality counts more than ever**: if the system detects that a video is a
  repost (including a TikTok watermark carried over to Instagram), reach is
  actively penalised — it is worth exporting two clean, separate files rather
  than recycling the same watermarked one. ([techwyse.com](https://www.techwyse.com/blog/infographic/best-short-video-platform-2026-instagram-reels-tiktok-youtube-shorts))
- **Who is already viral in this exact niche**: Chris Titus Tech Utility and
  Hellzerg's Optimizer (both on GitHub) are the reference tools already going
  viral on TikTok with the "optimise your PC in 90 seconds, look at the FPS/boot
  time before and after" angle. They are the direct competitors in the same
  comments and hashtags — worth knowing in order to differentiate (they have
  neither automatic rollback nor a UI, which is the real competitive advantage
  to underline). ([tiktok.com/@thesoaptech](https://www.tiktok.com/@thesoaptech/video/7390890131617549600))

---

## Video 1 — "Your mouse is sabotaging your aim" (Mistake Warning + Fear)

**Hook (0-3s) — everything has to be present TOGETHER: movement + voice + text:**
> (movement: jerk the mouse across the screen) + voice: *"Your mouse on Windows
> is ruining your aim and you don't know it"* + identical text overlay

**Shot list:**
1. (0-3s) Hook as above — visual pattern interrupt (jerky mouse) + audio + text
2. (3-7s) Text: "It's called 'Enhance Pointer Precision' — on by default on EVERY Windows"
3. (7-14s) Screen recording: open PC Tweaker -> Gaming category -> "Reduce input
   lag" toggle -> show the automatic rollback (hover over it, show that it saves
   the previous state before applying)
4. (14-20s) The same mouse movement as before, now linear and precise -
   before/after split screen in CapCut if possible
5. (20-24s) Text: "Free, one click, 100% reversible — unlike other tools, you don't touch anything you can't undo"
6. (24-28s) Spoken CTA + text: "Search for 'PC Tweaker' — link in bio"

**Caption:**
"Windows turns this setting on by default and nobody ever turns it off 🎯 #pcgaming #windowstips #pctweaks #gamingsetup #fps"

---

## Video 2 — "3 settings Windows turns on against you" (List Tease + Mistake Warning)

**Hook (0-3s):**
> voice+text: *"Windows has turned on 3 settings that slow your PC down on purpose"*
> (movement: quickly show Task Manager with high CPU/RAM)

**Shot list:**
1. (3-9s) **#1 Xbox Game Bar** — show Task Manager with the overlay running, then
   the toggle in PC Tweaker that disables it
2. (9-15s) **#2 Balanced power plan** — show Windows' powercfg, then the "High
   Performance" toggle in PC Tweaker
3. (15-21s) **#3 HAGS disabled** — explain in two words (GPU scheduling), show
   the toggle
4. (21-26s) Text: "All 3 in one click with the 'Turbo Gaming' preset"
5. (26-28s) CTA: link in bio / winget install

**Caption:**
"Windows won't tell you a single one of these on its own 👀 save it for later #windows11 #pcoptimization #techtips #gaming"

---

## Video 3 — "Don't download a PC optimizer before watching this" (Contrarian + trust)

This is the angle that catches people searching "is this optimizer safe" rather
than people only searching for gaming — colder traffic but higher conversion,
because they arrive already intending to install something.

**Hook (0-3s):**
> voice+text: *"Don't install ANY PC optimizer before you've seen this trick for spotting them"*

**Shot list:**
1. (3-9s) Show the "what each tweak changes" page (registry key, why — if it
   does not exist yet, it has to be built before shooting this video)
2. (9-15s) Show the rollback: apply a tweak, then undo it in one click, show
   that it returns to exactly the previous value
3. (15-21s) Show installation via `winget install AurelioAvila.PCTweaker` in the
   terminal — winget means published through Microsoft's official package
   manager, not an .exe downloaded from some random site
4. (21-25s) Text: "Rule: if a tool won't tell you EXACTLY what it changes, you don't install it"
5. (25-28s) CTA

**Caption:**
"The difference between a serious tool and one that's scamming you is: can you see what it does? #cybersecurity #windows #pctools #transparency"

---

## Video 4 — "Why I don't use [CTT/other optimizers]" (Contrarian, directly vs the competition)

New, based on the research: this niche already has established viral tools
(Chris Titus Tech Utility, Optimizer). A video that names them honestly (without
disparaging them, only differentiating) reaches their audience, which is already
interested in the topic — it is the riskiest video but also the one with the
highest reach potential, because it hooks into existing communities.

**Hook (0-3s):**
> voice+text: *"Do I still use the most famous PC optimization tools? No, and here's why"*

**Shot list:**
1. (3-10s) Honesty: "They're great tools, but almost none of them has a real
   rollback — if something goes wrong you have to reinstall Windows"
2. (10-18s) Show PC Tweaker's one-click rollback in action
3. (18-24s) Show the UI (a clear list of categories) against a terminal script
4. (24-28s) CTA

**Caption:**
"It's not better or worse, it's just built for people who want to be able to go back without worrying #windowstools #pcoptimization #techtok"

---

## Update 6 August 2026 — new topical angle: Windows 10 ESU

Extra research for this maintenance round. Before writing a script about the ESU
deadline (13 October 2026), the current state of the story was checked — and it
is no longer accurate:

- **Microsoft quietly extended the free consumer ESU programme**: the deadline is
  no longer 13 October 2026 but **12 October 2027** — an extra year of free
  security updates for anyone staying on Windows 10. The announcement was not a
  press release but a note added on 25 June 2026 to the official documentation
  and to an existing blog post — many users still do not know, and (wrongly)
  believe the deadline is October 2026.
  ([bleepingcomputer.com](https://www.bleepingcomputer.com/news/microsoft/microsoft-quietly-extends-free-windows-10-esu-support-to-october-2027/), [windowscentral.com](https://www.windowscentral.com/microsoft/windows-10/microsoft-quietly-extends-windows-10s-extra-security-updates-program-for-free-users-can-now-stay-on-windows-10-until-october-2027-securely), [learn.microsoft.com — official ESU page](https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates))
- **Why they extended it**: millions of PCs remain incompatible with Windows 11's
  hardware requirements (TPM 2.0, supported CPUs) and many users refuse the
  upgrade anyway over bugs, AI intrusiveness and a perception of worse
  performance — Microsoft has effectively admitted that a huge slice of users
  will stay on Windows 10 for a long time yet. ([windowslatest.com](https://www.windowslatest.com/2026/06/25/windows-10-support-quietly-extended-until-oct-2027-as-users-reject-windows-11/), [cybernews.com](https://cybernews.com/tech/microsoft-windows-10-update-program-extended/))
- **Why it is a useful angle for PC Tweaker**: it is not "buy a new PC", it is the
  opposite — a huge audience (still on Windows 10, often on older hardware that
  cannot be upgraded to Windows 11) needs more performance out of the hardware
  they already have, not a replacement for it. That is the perfect target for an
  optimization tool. A "news reactor" format (a little-known story), distinct
  from the Contrarian/Mistake/List Tease formats already used in Videos 1-4 —
  high reach potential because it intercepts people searching "Windows 10 end of
  support" right now.
- **Important note**: do NOT use a hook with a false deadline such as "you've only
  got a few days before your PC becomes vulnerable" — it would be factually
  wrong (the real deadline is October 2027) and would risk public corrections in
  the comments that damage the channel's credibility.

---

## Video 5 — "Windows 10 does NOT end in October 2026 (and almost nobody knows)" (News Reactor + Mistake Warning)

A topical angle (news from June-July 2026, still little known in August):
Microsoft quietly extended the free ESU programme to October 2027. Good
potential for catching people currently searching "Windows 10 end of support" /
"do I have to upgrade to Windows 11".

**Hook (0-3s) — everything has to be present TOGETHER: movement + voice + text:**
> (movement: quickly show the date "13 October 2026" struck through and replaced
> by "12 October 2027") + voice: *"You think Windows 10 stops working in October?
> Microsoft changed everything and didn't tell you"* + identical text overlay

**Shot list:**
1. (0-3s) Hook as above
2. (3-9s) Text: "In June 2026 Microsoft extended free ESU by a year — no press
   release, just one line added to a blog post that already existed"
3. (9-15s) Text: "Why? Millions of PCs can't upgrade to Windows 11 (it needs TPM
   2.0) and plenty of others don't want to"
4. (15-21s) Pivot to the product: "If your PC is staying on Windows 10 for a
   while, keep it fast anyway" -> screen recording: open PC Tweaker, show a
   performance preset (e.g. "Turbo Gaming" or a dedicated category)
5. (21-26s) Show the one-click rollback (consistent with the rest of the channel
   — the "safe, reversible" message)
6. (26-28s) Spoken CTA + text: "Search for 'PC Tweaker' — link in bio"

**Caption:**
"Windows 10 does NOT end in October 2026 like you think (Microsoft quietly extended it to October 2027) — but it's still worth keeping it fast 💻 #windows10 #windowsupdate #pctips #pcoptimization #tech"

---

## Update 10 August 2026 — new topical angle: Windows 11 26H2

Extra research for this maintenance round. Windows 11's next annual update
(26H2) is the next real search catalyst for this niche — historically every H2
version makes "should I update" / "what's changed" searches explode in the weeks
around release.

- **Release window**: late September – October 2026, in line with the history of
  previous H2 versions (23H2 = October 2023, 24H2 = October 2024, 25H2 = late
  September 2025). Microsoft had not confirmed an exact date at the time of this
  research. ([windowslatest.com](https://www.windowslatest.com/2026/08/05/windows-11-26h2-release-date-roll-out-time-line-and-whats-actually-new/), [pcworld.com](https://www.pcworld.com/article/3206876/windows-11-26h2-arrives-in-october-heres-why-you-shouldnt-skip-it.html))
- **It is not the big upgrade the name suggests**: for anyone already on Windows
  11 24H2 or 25H2, 26H2 arrives as an "enablement package" — a roughly 174 KB
  package that merely switches on features already present in the system, with a
  single reboot: not a reinstall, and not a multi-gigabyte download. Under the
  hood 25H2 and 26H2 share the same code base. ([windowscentral.com](https://www.windowscentral.com/microsoft/windows-11/windows-11-version-26h2-2026-update-10-things-to-know), [pcworld.com](https://www.pcworld.com/article/3063498/windows-11-26h2-is-coming-meet-all-the-new-features.html))
- **Why it is still a good angle**: even though the technical jump is small, search
  volume around the name "26H2" in the release weeks will be high (it happens
  with every H2) — the kind of traffic an honest "news reactor" video can catch
  without having to invent drama the facts do not carry.
- **Why it is NOT a "buy new hardware" angle**: unlike other cycles, Nvidia
  launched no new gaming GPUs in 2026 (the RTX 60 series slipped to 2028) — so
  the hardware trigger that usually accompanies a major OS update is missing.
  That confirms the right angle stays software/optimization, not "buy new
  hardware for 26H2" — exactly the positioning the channel already has.
  ([tomshardware.com](https://www.tomshardware.com/pc-components/gpus/report-claims-nvidia-will-not-be-releasing-any-new-rtx-gaming-gpus-in-2026-rtx-60-series-likely-debuting-in-2028))
- **Careful not to promise 26H2-specific tweaks that do not exist yet**: at the
  time of this research 26H2 is not public, so no new registry key tied to 26H2
  is verifiable. Video 6 below uses only app features that are already verified
  (the same ones as Videos 1-5); it invents no "26H2 tweak" — the promise is
  "whatever version you're on, your PC stays fast", not a specific new tweak.

---

## Video 6 — "Windows 11 is about to update (26H2) — what actually changes" (News Reactor + Contrarian)

A topical angle ahead of the release (expected late September–October 2026): many
videos will sell 26H2 as "the big annual update" — this video corrects the
expectation (for anyone already on 24H2/25H2 it is a tiny package) and moves
attention to what actually matters regardless of version: the PC's real
performance.

**Hook (0-3s) — everything has to be present TOGETHER: movement + voice + text:**
> (movement: quickly show a "Windows Update" window downloading) + voice:
> *"Windows 11 26H2 is coming and the videos selling it as revolutionary are
> lying to you"* + identical text overlay

**Shot list:**
1. (0-3s) Hook as above
2. (3-9s) Text: "For anyone already on 24H2 or 25H2 it's a package of about
   174 KB — one reboot, not a reinstall"
3. (9-15s) Text: "No new GPUs this year to go with it (RTX 60 pushed to 2028) —
   so no excuse to buy new hardware"
4. (15-21s) Pivot to the product: "Whatever version you're on, your PC can be
   faster today" -> screen recording: open PC Tweaker, show the categories
   (Performance/Gaming/Privacy/UI)
5. (21-26s) Show the one-click rollback (consistent with the rest of the channel)
6. (26-28s) Spoken CTA + text: "Search for 'PC Tweaker' — link in bio"

**Caption:**
"Windows 11 26H2 lands late September/October — it's not the revolution you're seeing everywhere, but it's still worth keeping your PC fast 🖥️ #windows11 #windowsupdate #pctips #pcoptimization #tech"

---

## Update 12 August 2026 — new topical angle: Low Latency Profile

Extra research for this maintenance round. Microsoft has just extended the "Low
Latency Profile" feature (part of the Windows K2 initiative) to all apps: an
excellent search trigger, because it is TODAY's news, not weeks old.

- **What it is**: the scheduler pushes the CPU to maximum frequency for 1-3
  seconds at the exact moment you open an app or a menu ("race to sleep"), then
  drops straight back to idle — Microsoft claims up to **40% faster app
  launches** and up to 70% faster Start menu/flyouts (internal Microsoft figures,
  to be treated as a best case). ([wccftech.com](https://wccftech.com/windows-11s-new-low-latency-profile-pushes-your-cpu-into-short-overclocking-bursts-to-kill-start-menu-stutter/), [windowslatest.com — independent test](https://www.windowslatest.com/2026/05/08/i-tested-windows-11s-hidden-low-latency-profile-and-budget-pcs-are-about-to-feel-premium/))
- **Timeline**: it had been active since June 2026 for shell elements only (Start,
  search, notification centre). With the **August 2026 security update
  (KB5121003)** Microsoft quietly extended it to normal app launches as well, on
  Windows 11 24H2 and 25H2. ([windowslatest.com](https://www.windowslatest.com/2026/08/12/windows-11s-faster-app-launches-released-today-enable-it-using-these-steps/))
- **The key point for the hook**: it is **automatic and on by default**, with no
  toggle to hunt for in Settings — most users do not even know it exists, which
  makes it an excellent "Windows just did something and didn't tell you" story,
  the same framing already used for Video 5 (ESU). ([windowscentral.com](https://www.windowscentral.com/microsoft/windows-11/confused-about-low-latency-profile-on-windows-11-heres-what-we-know-so-far))
- **Why it does NOT become a tweak in the app**: before August the feature could
  only be enabled early via ViVeTool using experimental, officially undocumented
  feature IDs (e.g. `vivetool /enable /id:58989092,60716524,...`). Those are
  internal flags Microsoft can remove or rename from one build to the next
  without warning — the opposite of the "reversible and verified" guarantee the
  app's tweak pool is built on (see `tweaks.rs`) — and in any case, now that the
  rollout is general via Windows Update there is nothing left to enable by hand.
  So no tweak or registry key tied to Low Latency Profile is added: it stays a
  script angle only (no risky technical action proposed to users).
- **The natural pivot to the product**: "Windows just made itself faster at opening
  apps — but everything else that slows your PC down (startup programs, Game
  DVR, the balanced power plan) Windows doesn't touch on its own" -> stays
  consistent with the channel's positioning, without inventing a tweak that does
  not exist.

---

## Video 7 — "Windows just got faster and didn't tell you" (News Reactor + Mistake Warning)

A topical angle (August 2026 news, published in the very days the video is shot
and posted): Microsoft extended the "Low Latency Profile" boost to all apps. Good
potential for catching people searching "why is Windows 11 faster" / "Low Latency
Profile" right now.

**Hook (0-3s) — everything has to be present TOGETHER: movement + voice + text:**
> (movement: a quick double click on an app, which opens almost instantly) +
> voice: *"Windows just made itself faster and most people don't even know"* +
> identical text overlay

**Shot list:**
1. (0-3s) Hook as above
2. (3-9s) Text: "It's called Low Latency Profile — it pushes the CPU to maximum
   for 1-3 seconds only when you open an app, then drops back to idle. Up to 40%
   faster app launches according to Microsoft"
3. (9-14s) Text: "It's automatic, on by default with the August 2026 update on
   Windows 11 24H2/25H2 — there's no switch to look for"
4. (14-21s) Pivot to the product: "But everything else that slows the PC down —
   a startup list full of programs, Game DVR, the balanced power plan — Windows
   doesn't touch on its own" -> screen recording: open PC Tweaker, show the
   startup program list or the "Turbo Gaming" preset
5. (21-26s) Show the one-click rollback (consistent with the rest of the channel)
6. (26-28s) Spoken CTA + text: "Search for 'PC Tweaker' — link in bio"

**Caption:**
"Windows 11 just got faster on its own (Low Latency Profile, August 2026) — but the rest is still on you 🚀 #windows11 #windowsupdate #pcoptimization #pctips #tech"

---

## Update 13 August 2026 — new topical angle: Copilot Actions / Agent Workspace

Extra research for this maintenance round (gap found: the current angles cover
"classic" performance/privacy but not the "AI & Technology" niche, which in
mid-2026 is among the most searched on Shorts alongside micro-learning — and
which still needs a verifiable fact here, not just the trend).

- **What it is**: Microsoft is bringing an agentic AI to Windows 11 — "Copilot
  Actions" — running inside an "Agent Workspace": a separate Windows account with
  reduced privileges, isolated from the user's session, in which the agent can
  open apps, click, type, edit files and compose emails on your behalf.
  Officially announced by Microsoft in a post on the Windows Experience blog.
  ([blogs.windows.com](https://blogs.windows.com/windowsexperience/2025/10/16/securing-ai-agents-on-windows/), [bleepingcomputer.com](https://www.bleepingcomputer.com/news/microsoft/microsoft-debuts-copilot-actions-for-agentic-ai-driven-windows-tasks/))
- **Status as of August 2026**: still in preview, available only to Windows Insider
  members — not yet an active feature for the average user. The full "agentic OS"
  vision Microsoft presented is not expected in general release before 2027.
  Important, so the video does not promise something the viewer cannot yet see on
  their own PC. ([bleepingcomputer.com](https://www.bleepingcomputer.com/news/microsoft/microsoft-debuts-copilot-actions-for-agentic-ai-driven-windows-tasks/))
- **Off by default**: it sits behind a single toggle in Settings > System > AI
  components > Agent tools > "Experimental agentic features", requires
  administrator permissions and applies device-wide — it has to be turned on
  deliberately, it does not start on its own. ([learn.microsoft.com — Windows 11 security book](https://learn.microsoft.com/en-us/windows/security/book/operating-system-agentic-security))
- **Why it is a useful angle**: it catches people searching "AI that controls your
  PC" / "Copilot Actions" while the story is still fresh (mid-2026), and the
  natural position for a channel selling "control and reversibility" is to
  explain what the feature actually does before an alarmist clickbait headline
  does — consistent with Video 4 (honesty about Microsoft features, not
  contempt). ([techradar.com](https://www.techradar.com/computing/windows/hate-copilot-in-windows-11-free-privacy-tools-can-now-get-rid-of-the-ai))
- **Careful**: PC Tweaker does NOT have (and this script must not promise) a tweak
  to disable Copilot Actions — the feature is already disabled by a single native
  Windows toggle, so a dedicated tweak in the app is unnecessary. The honest
  pivot is towards the **Privacy** category the app already has today (see
  `tweaks.rs`): diagnostic data, advertising ID, location — verified, reversible
  levers, not the agentic feature itself.

---

## Video 8 — "Windows is testing an AI that clicks on your PC by itself" (News Reactor + honest Contrarian)

A topical angle in the AI & Technology niche (among the most searched on Shorts in
mid-2026): Microsoft is letting a limited group of users test an artificial
intelligence that can use the PC for them. A true story, but it has to be told
with its real status (preview, opt-in, not yet for everyone) — no alarmist
headlines like "your AI already controls everything".

**Hook (0-3s) — everything has to be present TOGETHER: movement + voice + text:**
> (movement: show a cursor moving and clicking on an app by itself, as if nobody
> were touching the mouse) + voice: *"Microsoft is testing an AI that opens your
> apps and clicks for you — here's what we actually know"* + identical text
> overlay

**Shot list:**
1. (0-3s) Hook as above
2. (3-9s) Text: "It's called Copilot Actions, and it runs in an 'Agent Workspace'
   — a separate, isolated Windows account, not yours. For now only for Windows
   Insider members"
3. (9-15s) Text: "It's off by default — you turn it on by hand in Settings, one
   switch, and it needs administrator permissions"
4. (15-21s) Pivot to the product: "If instead you want to cut down what Windows
   collects about you TODAY (not in a year)" -> screen recording: open PC Tweaker
   -> Privacy category -> show the real toggles (diagnostic data, advertising ID,
   location)
5. (21-26s) Show the one-click rollback (consistent with the rest of the channel)
6. (26-28s) Spoken CTA + text: "Search for 'PC Tweaker' — link in bio"

**Caption:**
"Microsoft is testing an AI that uses your PC for you (preview only for now, off by default) — meanwhile, you stay in control of what Windows collects 🤖 #windows11 #ai #copilot #privacy #pctips"

---

## Update 23 August 2026 — closing a gap: KB5121003 in the automatic pool

Extra research for this maintenance round (gap found: Video 7 covers only the
Low Latency Profile for apps from this same update, but three other concrete and
verifiable changes in KB5121003 were in neither this file nor — more importantly
— the automatic pool `content.py`, the only thing that actually generates the
published videos without a manual shoot).

Release: **KB5121003**, Patch Tuesday 11 August 2026, build 26100.9168
(Windows 11 24H2) / 26200.9168 (25H2). General sources:
([pureinfotech.com](https://pureinfotech.com/kb5121003-windows-11-august-2026-update/), [windowscentral.com](https://www.windowscentral.com/microsoft/windows-11/biggest-changes-microsoft-is-rolling-out-in-august-for-windows-11), [windowslatest.com](https://www.windowslatest.com/2026/08/11/i-tested-windows-11-august-2026-update-heres-everything-new-improved-and-fixed/))

- **Windows Hello Enhanced Sign-in Security (ESS) on external fingerprint
  readers**: previously limited to built-in sensors, ESS now also works with
  compatible external USB readers (dedicated secure processor, fingerprint
  template stored on the device, Microsoft certified), useful for desktops and
  PCs with no built-in sensor. It still requires TPM 2.0 and VBS enabled.
  ([windowsforum.com](https://windowsforum.com/windows-news.4/windows-hello-ess-now-supports-external-peripherals-in-feb-2026-update.402581/), [windowsnews.ai](https://windowsnews.ai/article/windows-11-brings-enhanced-sign-in-security-to-usb-fingerprint-readers-in-august-update.441238))
- **Uninstalling AI models on Copilot+ PCs**: Copilot+ PCs ship with preinstalled
  on-device AI components (e.g. Image Generation); with KB5121003 they become
  uninstallable instead of staying installed and active even for people who never
  use them. It does not remove the Copilot app itself, only these specific
  components. ([windowsforum.com](https://windowsforum.com/windows-news.4/kb5121003-lets-copilot-pcs-remove-image-generation-ai.442742/), [notebookcheck.net](https://www.notebookcheck.net/Windows-11-ships-nine-AI-components-you-can-delete-one.1364313.0.html))
- **File Explorer, file sizes in the right unit**: it used to list everything in KB
  regardless of the real size; now it shows KB/MB/GB readably.
  ([pureinfotech.com](https://pureinfotech.com/kb5121003-windows-11-august-2026-update/))
- **Middle click to open a folder in a new tab**: from the address bar or File
  Explorer's Home, a middle click now opens the folder in a tab instead of
  replacing the current one.
  ([pureinfotech.com](https://pureinfotech.com/kb5121003-windows-11-august-2026-update/))

Added to `content.py` (the automatic pool): a new list-tease topic
`windows_2026_update` with all four points above plus Video 7's Low Latency
Profile, and two single items (mistakewarning: uninstalling Copilot+ AI;
beforeafter: Low Latency Profile on app launches) — the same shape already used
for Copilot/Recall on 2026-08-20.

---

## Video 9 — "Windows 11's August update changed more than you think" (List Tease + News Reactor)

A topical angle (KB5121003, news from the days immediately before the shoot) —
covers the four points above in list format, consistent with Video 2 (List Tease
is among the best-performing formulas in 2026).

**Hook (0-3s) — everything has to be present TOGETHER: movement + voice + text:**
> (movement: scroll quickly through the new Windows 11 Settings) + voice:
> *"Windows 11's latest update changed more than you think"* + identical text
> overlay

**Shot list:**
1. (0-3s) Hook as above
2. (3-9s) "Number one: you can now use an external USB fingerprint reader for
   secure sign-in, not just the one built into your laptop"
3. (9-14s) "Number two: on Copilot+ PCs you can finally uninstall the AI models
   you don't use, they no longer just sit there taking up space"
4. (14-19s) "Number three: File Explorer finally shows sizes in KB, MB or GB
   instead of everything in KB"
5. (19-24s) Pivot to the product: "But the settings that really slow the PC down
   — startup programs, power plan, Game DVR — are still yours to fix"
   -> screen recording: open PC Tweaker
6. (24-27s) Spoken CTA + text: "Search for 'PC Tweaker' — link in bio"

**Caption:**
"Windows 11's August 2026 update (KB5121003) changed more than it looks — external fingerprint readers, uninstallable AI on Copilot+, File Explorer finally readable 📋 #windows11 #windowsupdate #pctips #techtok #windows11tips"

---

## Publishing notes

- Post Video 1 first (strongest hook according to the data, low shooting barrier).
- Export **two separate files** for TikTok and Instagram (no recycled watermark,
  it penalises reach on IG) — same content, different hashtags (IG: 5-8 targeted).
- Duration: stay at 15-30s despite the 2026 tendency to reward longer sessions —
  for a "quick tip" niche, completion rate counts more than absolute length.
- Suggested time: 19:00-21:00 (gamer/PC enthusiast audience, after dinner and
  after school or work).
- If a video gains traction, reply to comments within the first 2 hours — the
  algorithm rewards fast engagement more than late engagement.
- Video 4 is the most delicate: name the competition only if you are comfortable
  doing so, it is not compulsory — it works if you skip it too.
- Video 5 is tied to a news story (the ESU extension) — shoot and publish it
  within a few weeks of reading this, before the story gets too old or too
  well known to work as a hook.
- Video 6 is tied to the release of Windows 11 26H2 (late September–October
  2026) — publish it in the 1-2 weeks before the estimated release date, when
  search volume on the version name starts rising but before it is saturated
  with similar content.
- Video 7 is tied to very fresh news (KB5121003, August 2026) — shoot and publish
  it within the next few days, before it stops being recent and becomes common
  knowledge.
- Video 8 is about the AI & Technology niche (Copilot Actions/Agent Workspace):
  the feature is still in Insider preview as of August 2026, so the video stays
  valid longer than Videos 5 and 7 (it is not tied to a window of a few weeks) —
  but if Microsoft takes it to general release, its status has to be rechecked
  before republishing or reusing it.

## Sources

- [The Viral Hook Formula: Win a TikTok's First 3 Seconds](https://riffkit.ai/blog/viral-hook-formula)
- [The First 3 Seconds: How to Hook Viewers on TikTok & Reels](https://www.go-viral.app/blog/hook-first-3-seconds/)
- [We Analyzed 4,000 TikTok & Instagram Videos — what goes viral in 2026](https://thecontentlabs.app/blog/what-goes-viral-in-2026-data-study)
- [Instagram Reels vs TikTok vs YouTube Shorts 2026](https://www.techwyse.com/blog/infographic/best-short-video-platform-2026-instagram-reels-tiktok-youtube-shorts)
- [An example of existing viral content in the same niche](https://www.tiktok.com/@thesoaptech/video/7390890131617549600)
- [Microsoft quietly extends free Windows 10 ESU support to October 2027 — BleepingComputer](https://www.bleepingcomputer.com/news/microsoft/microsoft-quietly-extends-free-windows-10-esu-support-to-october-2027/)
- [Microsoft quietly extends Windows 10's extra security updates program for free until Oct 2027 — Windows Central](https://www.windowscentral.com/microsoft/windows-10/microsoft-quietly-extends-windows-10s-extra-security-updates-program-for-free-users-can-now-stay-on-windows-10-until-october-2027-securely)
- [Extended Security Updates (ESU) program for Windows 10 — official Microsoft Learn page](https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates)
- [Windows 10 support quietly extended until Oct 2027, as users reject Windows 11 — Windows Latest](https://www.windowslatest.com/2026/06/25/windows-10-support-quietly-extended-until-oct-2027-as-users-reject-windows-11/)
- [Microsoft extends Windows 10 update program as users refuse to upgrade — Cybernews](https://cybernews.com/tech/microsoft-windows-10-update-program-extended/)
- [Here's when Windows 11 26H2 will roll out, and what's actually new on existing PCs — Windows Latest](https://www.windowslatest.com/2026/08/05/windows-11-26h2-release-date-roll-out-time-line-and-whats-actually-new/)
- [Windows 11 26H2 arrives in October. Here's why you shouldn't skip it — PCWorld](https://www.pcworld.com/article/3206876/windows-11-26h2-arrives-in-october-heres-why-you-shouldnt-skip-it.html)
- [Windows 11 26H2 is coming: Meet all the new features — PCWorld](https://www.pcworld.com/article/3063498/windows-11-26h2-is-coming-meet-all-the-new-features.html)
- [Windows 11's annual 2026 update is almost here — 10 things you need to know before upgrading — Windows Central](https://www.windowscentral.com/microsoft/windows-11/windows-11-version-26h2-2026-update-10-things-to-know)
- [Report claims Nvidia will not be releasing any new RTX gaming GPUs in 2026, RTX 60 series likely debuting in 2028 — Tom's Hardware](https://www.tomshardware.com/pc-components/gpus/report-claims-nvidia-will-not-be-releasing-any-new-rtx-gaming-gpus-in-2026-rtx-60-series-likely-debuting-in-2028)
- [Windows 11's New Low Latency Profile Pushes Your CPU Into Short Overclocking Bursts To Kill Start Menu Stutter — Wccftech](https://wccftech.com/windows-11s-new-low-latency-profile-pushes-your-cpu-into-short-overclocking-bursts-to-kill-start-menu-stutter/)
- [I tested Windows 11's hidden Low Latency Profile, and budget PCs are about to feel premium — Windows Latest](https://www.windowslatest.com/2026/05/08/i-tested-windows-11s-hidden-low-latency-profile-and-budget-pcs-are-about-to-feel-premium/)
- [Windows 11's faster app launches released today, enable it using these steps — Windows Latest](https://www.windowslatest.com/2026/08/12/windows-11s-faster-app-launches-released-today-enable-it-using-these-steps/)
- [Confused about Windows 11's Low Latency Profile? Here is what it actually does — Windows Central](https://www.windowscentral.com/microsoft/windows-11/confused-about-low-latency-profile-on-windows-11-heres-what-we-know-so-far)
- [Securing AI agents on Windows — Windows Experience Blog (Microsoft, official)](https://blogs.windows.com/windowsexperience/2025/10/16/securing-ai-agents-on-windows/)
- [Microsoft debuts Copilot Actions for agentic AI-driven Windows tasks — BleepingComputer](https://www.bleepingcomputer.com/news/microsoft/microsoft-debuts-copilot-actions-for-agentic-ai-driven-windows-tasks/)
- [Windows 11 security book — Operating system agentic security — Microsoft Learn](https://learn.microsoft.com/en-us/windows/security/book/operating-system-agentic-security)
- [Hate Copilot in Windows 11? Free privacy tools can now get rid of the AI — TechRadar](https://www.techradar.com/computing/windows/hate-copilot-in-windows-11-free-privacy-tools-can-now-get-rid-of-the-ai)
- [Windows 11 August 2026 update KB5121003 is packed with useful improvements, and here's everything new — Pureinfotech](https://pureinfotech.com/kb5121003-windows-11-august-2026-update/)
- [Windows 11's August Patch Tuesday update is rolling out today — Windows Central](https://www.windowscentral.com/microsoft/windows-11/biggest-changes-microsoft-is-rolling-out-in-august-for-windows-11)
- [I tested Windows 11 August 2026 update, here's everything new, improved, and fixed — Windows Latest](https://www.windowslatest.com/2026/08/11/i-tested-windows-11-august-2026-update-heres-everything-new-improved-and-fixed/)
- [Windows Hello ESS Now Supports External Peripherals in Feb 2026 Update — Windows Forum](https://windowsforum.com/windows-news.4/windows-hello-ess-now-supports-external-peripherals-in-feb-2026-update.402581/)
- [Windows 11 Brings Enhanced Sign-in Security to USB Fingerprint Readers in August Update — Windows News](https://windowsnews.ai/article/windows-11-brings-enhanced-sign-in-security-to-usb-fingerprint-readers-in-august-update.441238)
- [KB5121003 Lets Copilot+ PCs Remove Image Generation AI — Windows Forum](https://windowsforum.com/windows-news.4/kb5121003-lets-copilot-pcs-remove-image-generation-ai.442742/)
- [Windows 11 ships nine AI components, you can delete one — Notebookcheck](https://www.notebookcheck.net/Windows-11-ships-nine-AI-components-you-can-delete-one.1364313.0.html)
