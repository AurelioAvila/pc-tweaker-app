import { DOWNLOAD_EXE } from "../constants";
import { useCampaignStoreLink } from "../campaign-store";
import { PRACTICAL_GUIDES } from "./practical-guides";
import { FIX_GUIDES } from "./fix-guides";
import { ProBox, Steps, TechSummary, type Step } from "../components/ReferenceBlocks";
import { GUIDE_FAQS } from "./guide-faqs";
import { Link } from "../router";
import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs";

interface GuideFigure {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly caption: string;
}

interface Guide {
  readonly eyebrow: string;
  readonly title: string;
  /** Overrides for the <title>/<meta description>; see src/seo.ts. */
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  readonly intro: string;
  readonly format?: "technical";
  readonly updated?: string;
  readonly published?: string;
  readonly image?: string;
  readonly caption?: string;
  readonly sections: readonly {
    readonly heading: string;
    readonly body: string;
    readonly code?: string;
    readonly points?: readonly string[];
    readonly figure?: GuideFigure;
    readonly table?: {
      readonly caption: string;
      readonly rows: readonly { readonly module: string; readonly subsystem: string; readonly check: string }[];
      readonly note: string;
    };
  }[];
  /**
   * Curated in-content links to the other topic pages. The footer already
   * lists every page, but a footer link is the same on all 14 of them and says
   * nothing about why this page leads to that one. These are per-page, carry
   * descriptive anchor text and a reason to follow them — which is the signal
   * that was missing for the pages Search Console had discovered but never
   * judged worth crawling. Every `to` must keep its trailing slash: the host
   * 301s the bare form, and a link through a redirect passes less than a link
   * straight to the URL that answers.
   */
  readonly related?: readonly { readonly to: string; readonly label: string; readonly note: string }[];
  /** External pages the guide's factual claims were checked against, with the date. */
  readonly sources?: {
    readonly checked: string;
    readonly items: readonly { readonly label: string; readonly url: string }[];
  };
  /** Fix pages: the facts in a table before the prose. */
  readonly summary?: readonly { readonly label: string; readonly value: string }[];
  /** Fix pages: the by-hand route, with paste-ready commands. */
  readonly steps?: readonly Step[];
  /** Fix pages: the same job in PC Tweaker, with links to the controls. */
  readonly pctweaker?: {
    readonly title: string;
    readonly body: string;
    readonly links: readonly { readonly to: string; readonly label: string }[];
  };
}

export const GUIDES: Record<string, Guide> = {
  ...PRACTICAL_GUIDES,
  ...FIX_GUIDES,
  "/windows-11-optimizer": {
    eyebrow: "WINDOWS 11 OPTIMIZATION",
    title: "Optimize Windows 11 without losing control",
    intro:
      "Find what is slowing your Windows 11 PC, review the relevant settings and compare one change at a time. PC Tweaker shows what supported tweaks change and records their previous values for restoration.",
    sections: [
      {
        heading: "Review the change and its recovery path",
        body:
          "Read the setting, permission requirement and trade-off before applying a tweak. PC Tweaker groups controls by task and saves the previous state of supported settings. That record helps you restore a change; it does not make every setting suitable for every PC or replace a backup.",
        points: [
          "Review each optimization before applying it",
          "Restore supported changes from their saved previous state",
          "Use live hardware information to make informed decisions",
          "Keep privacy, maintenance and performance controls separate",
        ],
      },
      {
        heading: "Built for modern Windows systems",
        body:
          "The application supports Windows 10 and Windows 11 and is designed around current system behavior, permissions and recovery expectations. It does not promise impossible performance gains or replace proper hardware, driver and security maintenance.",
      },
      {
        heading: "Start from a reading, not from a preset",
        body:
          "Start with the task that feels slow: signing in, opening an app or a repeatable game scene. Record Windows and driver versions, power mode, free storage and CPU, memory and disk activity during that task. An idle reading or a count of active tweaks cannot measure workload performance. For a game, repeat the same scene and record frame times as well as average FPS. Keep the test conditions consistent, change one relevant setting and repeat the measurement.",
      },
      {
        heading: "What a Windows 11 optimizer can actually change",
        body:
          "PC Tweaker includes controls for startup, menu and hover timing, visual effects and supported background-app settings. Its gaming controls include background recording, mouse acceleration, accessibility shortcuts, fullscreen behavior and hardware-accelerated GPU scheduling. Privacy controls cover supported diagnostic, advertising and Recall policies. Interface and maintenance controls include file extensions, taskbar options and Delivery Optimization peer sharing. Availability and effect depend on the Windows build, edition, app and device policy. A registry value being written is not proof that every Windows component uses it.",
        points: [
          "Performance: startup, menu and hover delays, animations, background Store apps",
          "Gaming: Game Bar recording, network throttle, Sticky Keys, mouse acceleration",
          "Privacy: diagnostic data, advertising ID, Bing in Start, suggestions, Recall",
          "Interface and maintenance: extensions, Widgets, transparency, update uploads",
        ],
      },
      {
        heading: "Match the setting to a symptom",
        body:
          "For slow sign-in, first review which apps launch automatically. Menu and hover controls change particular interface timings; they do not reduce every click delay or make a game render faster. Reducing visual effects can change responsiveness, while restricting supported background apps can affect notifications and syncing. Check actual CPU, disk or network activity before deciding those apps are the cause. Delivery Optimization can share update files with peers when configured to do so; peer sharing is optional and does not always include internet PCs. PC Tweaker requests DODownloadMode=0, which disables peer-to-peer downloads while updates still use HTTP sources. Check Windows settings and your device policy before changing it. Showing file extensions helps you inspect a filename; it is not a performance improvement or proof that a file is safe.",
        points: [
          "Slow sign-in: review startup apps before changing timing values",
          "Background activity: identify the process and check notification needs",
          "Update traffic: inspect peer-sharing settings and network activity",
          "File extensions: inspect the full name before opening a file",
        ],
      },
      {
        heading: "The changes the app refuses to oversell",
        body:
          "Read the limits alongside each control. The MMCSS background reserve is written as 0, which Windows treats as 20%; it does not hand every foreground app the whole CPU. The legacy Games GPU Priority value is one Microsoft documents as unused, and the app says so: no gain is expected from it. The global timer resolution flag does not itself request or verify a timer resolution, and its effect depends on the Windows version. Disabling Memory Integrity removes a layer of kernel protection in exchange for a performance change that varies by hardware, and a policy or UEFI lock may prevent it anyway. Hardware-accelerated GPU scheduling can improve, worsen or leave latency unchanged depending on the game. Reducing diagnostic data requests the lowest level Windows allows and is not an off switch. Leave a setting unchanged when you have no specific reason to test it.",
        points: [
          "MMCSS reserve 0 means 20%, not zero",
          "Games GPU Priority: documented as unused, no gain expected",
          "Memory Integrity off: a protection removed, not a free gain",
          "HAGS: better, worse or unchanged, by game",
        ],
      },
      {
        heading: "A practical order for troubleshooting Windows 11",
        body:
          "Check pending Windows updates and restart when required. Review Settings, System, Storage for low free space, and Settings, Apps, Startup for apps you do not need at sign-in. Use Task Manager during the slow task to find sustained CPU, memory or disk load. On a laptop, record whether it is plugged in and which power mode is active; lower clocks can reflect power limits, load or temperature, so clock speed alone does not diagnose overheating. Then choose a control relevant to the symptom, read its limits and test it against your baseline. Restore supported settings if results worsen or the change causes unwanted behavior.",
        points: [
          "Updates and restart before anything else",
          "Free disk space and startup apps in Settings",
          "Power mode and thermals on laptops",
          "Then baseline, then one tweak at a time",
        ],
      },
      {
        heading: "Per-user, machine-wide and power settings behave differently",
        body:
          "Some controls write per-user values under HKEY_CURRENT_USER and take effect as soon as Explorer picks them up. Others target HKEY_LOCAL_MACHINE or a Windows system tool and need administrator approval, which Windows asks for each time. The power controls edit values in the currently active power scheme, and plugged-in and battery values are separate. Which of them exist at all depends on your hardware, your drivers and any policy the device is managed under.",
        points: [
          "Per-user settings apply without elevation",
          "Machine-wide settings are labelled Admin and prompt each time",
          "Power values are read from the scheme that is active now",
          "A control missing on your PC is a hardware or policy limit",
        ],
      },
      {
        heading: "What tuning cannot do for you",
        body:
          "Windows Update and the device manufacturer's guidance still matter for drivers and security maintenance. Configuration changes cannot add processor cores, repair a failing disk or guarantee a cooler laptop. Some systems benefit from reducing unnecessary background activity; others need a driver fix, more storage or hardware repair. There is no fixed percentage of performance that a tweak will recover. Keep a change only when it helps your workload without unacceptable trade-offs.",
      },
    ],
    related: [
      {
        to: "/what-pc-tweaker-changes/",
        label: "the full list of what PC Tweaker changes on your system",
        note: "The exact registry locations, permission levels and recovery path behind each category.",
      },
      {
        to: "/reversible-windows-tweaks/",
        label: "how a change records its previous value",
        note: "Worth reading before you apply anything, so you know what can be undone and what cannot.",
      },
      {
        to: "/windows-gaming-work-study-profiles/",
        label: "the Gaming, Work and Study starter profiles",
        note: "If you would rather begin from a reviewed selection than from individual toggles.",
      },
    ],
    sources: {
      checked: "17 October 2026",
      items: [
        { label: "Microsoft: Multimedia Class Scheduler Service (SystemResponsiveness and GPU Priority)", url: "https://learn.microsoft.com/en-us/windows/win32/procthread/multimedia-class-scheduler-service" },
        { label: "Microsoft: configure Windows diagnostic data (AllowTelemetry levels)", url: "https://learn.microsoft.com/en-us/windows/privacy/configure-windows-diagnostic-data-in-your-organization" },
        { label: "Microsoft: Delivery Optimization for Windows updates", url: "https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization" },
        { label: "Microsoft: Delivery Optimization download modes", url: "https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization-reference" },
        { label: "Microsoft: troubleshoot Windows performance", url: "https://support.microsoft.com/en-us/windows/experience/performance-optimization/tips-to-improve-pc-performance-in-windows" },
        { label: "Microsoft: menu and mouse-hover system parameters", url: "https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-systemparametersinfoa" },
        { label: "Microsoft: manage Recall", url: "https://learn.microsoft.com/en-us/windows/client-management/manage-recall" },
        { label: "Microsoft: startup apps in Windows", url: "https://support.microsoft.com/en-us/windows/add-an-app-to-run-automatically-at-startup-in-windows-10-150da165-dcd9-7230-517b-cf3c295d89dd" },
        { label: "PC Tweaker: the tweak catalogue in the source", url: "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/tweaks.rs" },
      ],
    },
  },
  "/gaming-performance": {
    eyebrow: "GAMING PERFORMANCE",
    title: "Tune Windows for more consistent gaming performance",
    intro:
      "Start with a repeatable stutter or uneven frame-time pattern. Check temperatures and background work, then review Game DVR or GPU scheduling one setting at a time. Keep a change only when repeated runs support it, and restore supported tweaks from their saved state.",
    sections: [
      {
        heading: "Consistency matters more than a synthetic promise",
        body:
          "PC Tweaker focuses on transparent system configuration rather than guaranteed FPS claims. The goal is to remove avoidable friction while keeping thermals, drivers, hardware limits and game-specific settings in perspective.",
        points: [
          "Gaming-oriented Windows adjustments",
          "Live CPU, memory and system monitoring",
          "Driver update visibility",
          "Independent rollback for supported changes",
        ],
      },
      {
        heading: "Know what changed",
        body:
          "Every supported optimization is presented as an explicit action. That makes it easier to test a configuration, measure the result and reverse the change if it does not help your specific PC or workload.",
      },
      {
        heading: "Uneven frame times usually have a cause worth finding",
        body:
          "A stutter that happens once when a new area loads is usually shader compilation, and it stops on the second run. A stutter that grows worse the longer you play points at heat: check whether clock speeds fall as temperatures climb. Regular hitching every few seconds is more often a background task, a storage stall or a driver problem. Identify which pattern you actually have before changing settings, because the three have different fixes and only one of them is Windows configuration.",
        points: [
          "First-run hitching: shader compilation, expected once",
          "Worsening over time: thermal limits, check clocks and cooling",
          "Rhythmic hitching: background work, storage or drivers",
          "Uniformly low frame rate: hardware or in-game settings",
        ],
      },
      {
        heading: "What the gaming tweaks actually touch",
        body:
          "Disabling Game DVR sets GameDVR_Enabled to 0 under HKEY_CURRENT_USER\\System\\GameConfigStore, which stops Xbox Game Bar's background recording and the processor and graphics time it was consuming. It needs no administrator rights, and if you save clips with Windows capture you should leave it alone: this is a trade, not a free upgrade. Disabling mouse acceleration sets MouseSpeed, with MouseThreshold1 and MouseThreshold2, under HKEY_CURRENT_USER\\Control Panel\\Mouse, so the same physical flick always covers the same distance on screen. That one affects the Windows desktop too, and games reading raw input directly will ignore it either way.",
      },
      {
        heading: "Hardware-accelerated GPU scheduling is genuinely uncertain",
        body:
          "HAGS sets HwSchMode to 2 under HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers, needs administrator rights and only takes effect after a restart. It is worth calling out separately because, unlike most settings here, its effect is not predictable: depending on the game, the graphics driver and the Windows build, latency can improve, get worse, or not change at all. Confirm it is actually available in Windows Graphics settings after restarting, then test it the same way you would test any other change, and reverse it without hesitation if your results get worse.",
      },
      {
        heading: "Compare frame times, not an average",
        body:
          "An average frame rate hides exactly the problem most people are trying to fix. Two runs can both report sixty frames per second while one is smooth and the other stutters several times a second, because the average says nothing about the spacing between frames. Use a frame-time graph or the one percent low figure, run the same scene twice before and twice after a change, and keep every other condition the same. A single run either side proves nothing.",
      },
    ],
    related: [
      {"to": "/guides/fix-dpc-isr-latency-windows-11/", "label": "diagnose DPC and ISR spikes before changing settings", "note": "Reproduce a crackle or frame-time problem and inspect the driver trace."},
      {"to": "/guides/amd-ryzen-x3d-core-parking-windows-11/", "label": "check Ryzen X3D parking and process placement", "note": "Topology, power policy and process CPU sets are different controls."},
      {
        to: "/windows-gaming-work-study-profiles/",
        label: "what the Gaming starter profile selects",
        note: "The specific settings that come pre-ticked, and when you should uncheck one of them.",
      },
      {
        to: "/reversible-windows-tweaks/",
        label: "how to reverse a change that did not help",
        note: "Most gaming tweaks are trades, so plan the way back before you take one.",
      },
      {
        to: "/windows-11-optimizer/",
        label: "the wider Windows 11 tuning picture",
        note: "Where gaming settings sit relative to updates, drivers, storage and cooling.",
      },
    ],
  },
  "/reversible-windows-tweaks": {
    eyebrow: "REVERSIBLE TWEAKS",
    title: "Windows tweaks with a recovery path",
    intro:
      "A reversible tweak needs the value that existed before the change. PC Tweaker records previous states for supported registry, service and system settings. Check that record and any restart requirement before applying a tweak; a generic Windows default is not your original configuration.",
    sections: [
      {
        heading: "Rollback is part of the feature",
        body:
          "PC Tweaker treats recovery as a core requirement. Supported changes preserve the information needed to restore their previous state instead of relying on generic reset instructions after something goes wrong.",
        points: [
          "Apply supported tweaks individually",
          "Keep changes understandable and auditable",
          "Reverse a change without searching for the original value",
          "Avoid scripts that bundle unrelated modifications",
        ],
      },
      {
        heading: "Transparent by design",
        body:
          "The project is publicly inspectable, and the interface explains what each available action targets. This makes PC Tweaker suitable for users who want convenience without giving up visibility into their system.",
      },
      {
        heading: "What a recorded previous value actually is",
        body:
          "When a supported tweak is applied, the value that was there beforehand is saved first. Restoring writes that saved value back. This matters because a generic Windows default is not the same thing as your previous configuration: if you had already changed a setting by hand years ago, resetting to the documented default moves you somewhere you have never been. Restoring a recorded value returns the setting to what your machine had, which is the question people are usually asking.",
      },
      {
        heading: "Change history tells you what to undo",
        body:
          "When something starts behaving differently, the hard part is rarely the undo itself; it is remembering which of a dozen changes caused it. Change history lists what was applied and when, so you can line the symptom up against the timeline instead of guessing. If several changes went in together, restore them one at a time and retest between each. Restore All exists for the case where you want the whole set reversed at once.",
        points: [
          "Applied changes are listed with the time they were made",
          "Restore a single change without touching the others",
          "Restore All reverses the supported set together",
          "Retest between restores so you learn which one mattered",
        ],
      },
      {
        heading: "Where reversibility stops",
        body:
          "Not every action in a maintenance tool is a setting, and the ones that are not have their own limits. Files removed by a cleanup may not be recoverable. Uninstalling an application is not undone by restoring a registry value. Driver updates and Windows repair operations have their own separate recovery mechanisms, and a tweak backup is not a backup of your files or of the system as a whole. Read what an operation does before running it, and keep real backups for the cases rollback was never going to cover.",
      },
    ],
    related: [
      {
        to: "/how-to-undo-windows-tweaks/",
        label: "the step-by-step guide to undoing a tweak",
        note: "Including what to do when you changed the setting yourself rather than through the app.",
      },
      {
        to: "/what-pc-tweaker-changes/",
        label: "which categories are reversible and which are not",
        note: "Cleanup, uninstall and update actions sit outside setting rollback entirely.",
      },
      {
        to: "/windows-privacy-tool/",
        label: "why reversibility matters most for privacy settings",
        note: "Debloat scripts are the common case where there is no way back.",
      },
    ],
  },
  "/windows-privacy-tool": {
    eyebrow: "WINDOWS PRIVACY",
    title: "Review Windows privacy settings without blind debloating",
    intro:
      "Review diagnostic data, advertising ID and Recall separately instead of running a broad debloat script. PC Tweaker identifies supported privacy controls and their permissions, and records previous values for restoration. A policy can have effects that restoring its value cannot undo, including deleted Recall snapshots.",
    sections: [
      {
        heading: "Privacy controls without destructive presets",
        body:
          "Aggressive debloat scripts can disable dependencies or remove components a user still needs. PC Tweaker favors explicit settings and recovery over irreversible package removal and blanket service disabling.",
        points: [
          "Separate privacy choices from performance changes",
          "Review the purpose of each supported action",
          "Restore supported settings when requirements change",
          "Avoid advertising trackers on the PC Tweaker website",
        ],
      },
      {
        heading: "Privacy is more than a toggle",
        body:
          "No optimizer can replace account security, operating-system updates or informed application permissions. PC Tweaker provides focused controls while keeping those wider security responsibilities clear.",
      },
      {
        heading: "Is it safe to turn Windows diagnostic data down?",
        body:
          "Reducing diagnostic data sets AllowTelemetry to 0 under HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection, which needs administrator rights. Be precise about what that does: it requests the lowest level Windows allows, and it is not an off switch. Windows keeps sending the security and reliability data it considers required, and on Home editions the policy is treated as a floor rather than an instruction. It is safe in the sense that Windows Update, activation and support all keep working — but anyone promising you a complete telemetry blackout from one registry value is overselling it.",
      },
      {
        heading: "The per-user settings need no administrator rights at all",
        body:
          "Most of the interface prompts people want gone are per-user values that apply without elevation. Hiding the taskbar Widgets button sets TaskbarDa to 0 under HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced, which also stops it loading weather and news in the background for a panel you never open. The advertising ID, Start suggestions, tailored experiences built from your usage and feedback requests sit in the same category: ordinary per-user Windows settings, each listed separately, so you can remove the prompts you find intrusive and keep the ones you do not mind.",
      },
      {
        heading: "Why blanket debloat scripts cause support tickets",
        body:
          "A script that strips packages and disables services in bulk cannot know which of them something else on your machine depends on. The usual outcome is not immediate: the Microsoft Store stops updating weeks later, a printer will not install, search returns nothing, or a Windows feature update fails because a component it expected is gone. By then the script has been forgotten and there is no record of what it removed. Explicit, individually reversible settings avoid that entire class of problem, at the cost of being less dramatic.",
        points: [
          "Removed packages can break features that arrive later",
          "Disabled services often have non-obvious dependents",
          "Bulk scripts rarely record what they changed",
          "A failed feature update is hard to trace back months later",
        ],
      },
      {
        heading: "What these settings do not give you",
        body:
          "Turning off Windows suggestions and tailored experiences reduces what the operating system's own interface does with your usage. It is not network privacy and it is not anonymity. Your browser, your extensions, the applications you install and the accounts you sign into all collect independently of anything here, and no Windows setting reaches them. Keep the operating system updated, review application permissions, and treat these controls as one narrow part of a much larger picture.",
      },
    ],
    related: [
      {"to": "/guides/windows-11-privacy-telemetry-rollback/", "label": "inspect privacy registry values and plan the rollback", "note": "Read the actual key, record its previous state and understand edition limits."},
      {
        to: "/tools/debloat-windows-11/",
        label: "the debloat list builder, one app at a time",
        note: "The preinstalled apps PC Tweaker can remove, what each removal costs and the Store link that brings it back.",
      },
      {
        to: "/turn-off-windows-recall/",
        label: "how to turn off Windows Recall, and keep it off",
        note: "The Settings switch, the machine policy PC Tweaker writes and removing the component, with what each one deletes.",
      },
      {
        to: "/what-pc-tweaker-changes/",
        label: "the registry keys and permissions behind each setting",
        note: "Useful if you want to verify a privacy change rather than take it on trust.",
      },
      {
        to: "/reversible-windows-tweaks/",
        label: "how a privacy setting is restored later",
        note: "The difference between a recorded previous value and a generic Windows default.",
      },
      {
        to: "/windows-gaming-work-study-profiles/",
        label: "the Study profile's prompt-reducing selection",
        note: "Several of these privacy settings appear pre-selected there, with their limits spelled out.",
      },
    ],
  },
};

export function GuidePage({ path, navigate }: { path: string; navigate: (to: string) => void }) {
  const guide = GUIDES[path];
  const storeLink = useCampaignStoreLink("pct-guide-" + path.replace(/^\/guides\//, "").replace(/^\//, "").replace(/\//g, "-"));
  if (!guide) return null;
  const technical = guide.format === "technical";

  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12 [overflow-wrap:anywhere]">
      <article className="mx-auto max-w-4xl">
        <GuideBreadcrumbs path={path} navigate={navigate} />
        {!technical && <p className="font-mono-t text-accent mb-5 text-[12px] tracking-[0.15em]">
          {guide.eyebrow}
        </p>}
        <h1 className="font-display max-w-3xl text-4xl leading-[1.08] font-bold tracking-[-0.03em] text-[var(--fg)] md:text-6xl">
          {guide.title}
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--fg-dim)]">{guide.intro}</p>
        {guide.updated && (!technical || guide.updated !== guide.published) && <p className="mt-3 text-sm text-[var(--fg-dim)]">Updated <time dateTime={guide.updated}>{new Date(`${guide.updated}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>.</p>}

        {guide.summary && <TechSummary rows={guide.summary} />}
        {technical && (
          <>
            <p className="mt-5 text-sm leading-6 text-[var(--fg-dim)]">Maintained by <a href="https://github.com/AurelioAvila" className="text-accent underline underline-offset-4">Aurelio Avila</a> · Sources checked {guide.sources?.checked}.</p>
            {guide.published && <p className="mt-1 text-sm leading-6 text-[var(--fg-dim)]">Published <time dateTime={guide.published}>{new Date(`${guide.published}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>.</p>}
            <nav aria-label="On this page" className="mt-9 border-y border-[var(--line)] py-6">
              <h2 className="font-display text-lg font-semibold text-[var(--fg)]">On this page</h2>
              <ol className="mt-3 grid gap-x-8 md:grid-cols-2">
                {guide.sections.map((section, index) => <li key={section.heading}><a href={`#guide-section-${index + 1}`} className="inline-flex min-h-11 items-center py-2 text-sm leading-6 text-accent underline underline-offset-4 decoration-[var(--line-2)] hover:decoration-[var(--accent)]">{section.heading}</a></li>)}
              </ol>
            </nav>
          </>
        )}
        {guide.image && <figure className="mt-10"><img src={guide.image} alt={guide.caption} loading="lazy" width="732" height="430" className="h-auto w-full rounded-xl" /><figcaption className="mt-3 text-sm text-[var(--fg-dim)]">{guide.caption}</figcaption></figure>}
        <div className="mt-14 space-y-8">
          {guide.sections.map((section, index) => (
            <section key={section.heading} id={`guide-section-${index + 1}`} className={technical ? "min-w-0 scroll-mt-32 border-b border-[var(--line)] pb-9" : "rounded-2xl bg-[var(--surface)] p-7 md:p-9"}>
              <h2 className="font-display text-2xl font-bold text-[var(--fg)]">{section.heading}</h2>
              <p className={`mt-4 leading-7 text-[var(--fg-dim)] ${technical ? "max-w-[70ch]" : "max-w-3xl"}`}>{section.body}</p>
              {section.figure && (
                <figure className="mt-7">
                  <a href={section.figure.src} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]" aria-label={`Open original screenshot: ${section.figure.alt}`}>
                    <img src={section.figure.src} width={section.figure.width} height={section.figure.height} alt={section.figure.alt} loading="lazy" decoding="async" className="h-auto w-full rounded-xl" />
                  </a>
                  <figcaption className="mt-4 text-sm leading-7 text-[var(--fg-dim)]">
                    {section.figure.caption}{" "}
                    <a href={section.figure.src} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">Open original screenshot</a>.
                  </figcaption>
                </figure>
              )}
              {section.table && (
                <>
                  <table id={`guide-table-${index + 1}`} className="mt-7 w-full scroll-mt-32 table-fixed border-collapse text-left text-sm leading-6">
                    <caption className="pb-4 text-left font-semibold text-[var(--fg)]">{section.table.caption}</caption>
                    <thead>
                      <tr className="border-b border-[var(--line-2)] text-[var(--fg)]">
                        <th scope="col" className="w-[40%] py-3 pr-4 font-semibold sm:w-[28%]">Module</th>
                        <th scope="col" className="py-3 font-semibold">What to check first</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row) => <tr key={row.module} className="border-b border-[var(--line)] align-top">
                        <th scope="row" className="py-5 pr-4 font-normal text-[var(--fg)]"><code className="text-xs [overflow-wrap:anywhere] sm:text-sm">{row.module}</code></th>
                        <td className="py-5 text-[var(--fg-dim)]"><p className="font-semibold text-[var(--fg)]">{row.subsystem}</p><p className="mt-2">{row.check}</p></td>
                      </tr>)}
                    </tbody>
                  </table>
                  <p className="mt-4 max-w-[70ch] text-sm leading-7 text-[var(--fg-dim)]">{section.table.note}</p>
                </>
              )}
              {section.code && <pre tabIndex={0} aria-label={`${section.heading}: read-only commands`} className="mt-5 max-w-full overflow-x-auto rounded-xl bg-[var(--surface)] p-5 text-[13px] leading-6 text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"><code>{section.code}</code></pre>}
              {section.points && (
                <ul className="mt-6 grid gap-3 text-[15px] text-[var(--fg)] md:grid-cols-2">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span className="text-accent" aria-hidden="true">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {guide.steps && (
          <section className="mt-14 rounded-2xl bg-[var(--surface)] p-7 md:p-9" aria-labelledby="by-hand">
            <h2 id="by-hand" className="font-display text-2xl font-bold text-[var(--fg)]">Do it by hand</h2>
            <Steps steps={guide.steps} />
          </section>
        )}
        {guide.pctweaker && (
          <section className="mt-8 rounded-2xl bg-[var(--surface)] p-7 md:p-9" aria-labelledby="with-pct">
            <h2 id="with-pct" className="font-display text-2xl font-bold text-[var(--fg)]">{guide.pctweaker.title}</h2>
            <p className="mt-4 max-w-3xl leading-7 text-[var(--fg-dim)]">{guide.pctweaker.body}</p>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {guide.pctweaker.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} onNavigate={navigate} className="inline-block rounded-lg border border-white/10 px-3.5 py-2 text-[13.5px] text-[var(--fg)] hover:border-white/25">{l.label}</Link>
                </li>
              ))}
            </ul>
            <ProBox campaign={"pct-fix-" + path.split("/").pop()} />
          </section>
        )}
        {guide.related && (
          <nav aria-label="Related guides" className="mt-14 border-t border-white/10 pt-9">
            <h2 className="font-display text-xl font-bold text-[var(--fg)]">Keep reading</h2>
            <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[var(--fg-dim)]">
              {guide.related.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} onNavigate={navigate} className="text-accent font-medium">
                    {item.label}
                  </Link>
                  {" — "}
                  {item.note}
                </li>
              ))}
            </ul>
          </nav>
        )}
        {GUIDE_FAQS[path] && (
          <section className="mt-14 border-t border-white/10 pt-9" aria-labelledby="guide-faq">
            <h2 id="guide-faq" className="font-display text-xl font-bold text-[var(--fg)]">Common questions</h2>
            <div className="mt-5 space-y-6">
              {GUIDE_FAQS[path].map((item) => (
                <div key={item.q}>
                  <h3 className="text-[16px] font-semibold text-[var(--fg)]">{item.q}</h3>
                  <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[var(--fg-dim)]">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {guide.sources && (
          <nav aria-label="Sources" className="mt-10 text-sm text-[var(--fg-dim)]">
            <p>Claims on this page were checked against these pages on {guide.sources.checked}:</p>
            <ul className="mt-3 space-y-1.5">
              {guide.sources.items.map((item) => (
                <li key={item.url}><a href={item.url} className="text-accent" rel="noopener">{item.label}</a></li>
              ))}
            </ul>
          </nav>
        )}
        {path in PRACTICAL_GUIDES && !technical && (
          <nav aria-label="References" className="mt-8 flex flex-wrap gap-5 text-sm text-accent">
            <a href="https://support.microsoft.com/en-us/windows/experience/storage-filemanagement/common-file-name-extensions-in-windows">
              Microsoft: file extensions
            </a>
            <a href="https://github.com/AurelioAvila/pc-tweaker-app/tree/master/src-tauri/src">
              Inspect the tweak source on GitHub
            </a>
          </nav>
        )}
        <section className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-9">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--fg)]">Try PC Tweaker</h2>
            <p className="mt-2 text-[14px] text-[var(--fg-dim)]">
              Free download for Windows 10 and Windows 11.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/" onNavigate={navigate} className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-[var(--fg)]">
              Explore all features
            </Link>
            <a href={storeLink} className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-[var(--fg)]">Get it from Microsoft Store</a>
            <a href={DOWNLOAD_EXE} className="bg-accent rounded-lg px-5 py-3 text-sm font-semibold text-[var(--bg)]">
              Download PC Tweaker
            </a>
          </div>
        </section>
      </article>
    </main>
  );
}
