import { DOWNLOAD_EXE } from "../constants";
import { useCampaignStoreLink } from "../campaign-store";
import { PRACTICAL_GUIDES } from "./practical-guides";
import { GUIDE_FAQS } from "./guide-faqs";
import { Link } from "../router";

interface Guide {
  readonly eyebrow: string;
  readonly title: string;
  /** Overrides for the <title>/<meta description>; see src/seo.ts. */
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  readonly intro: string;
  readonly image?: string;
  readonly caption?: string;
  readonly sections: readonly {
    readonly heading: string;
    readonly body: string;
    readonly points?: readonly string[];
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
}

export const GUIDES: Record<string, Guide> = {
  ...PRACTICAL_GUIDES,
  "/windows-11-optimizer": {
    eyebrow: "WINDOWS 11 OPTIMIZATION",
    title: "Optimize Windows 11 without losing control",
    intro:
      "PC Tweaker applies documented, reversible Windows adjustments while preserving a clear record of what changed and how to restore it.",
    sections: [
      {
        heading: "A safer alternative to one-click optimization",
        body:
          "Generic optimizers often combine unrelated changes behind a single button. PC Tweaker keeps adjustments visible, categorized and individually reversible so you can improve the system without treating Windows as a black box.",
        points: [
          "Review each optimization before applying it",
          "Restore supported changes through automatic rollback",
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
          "Open Scan before changing anything and write down what the machine does while idle: processor and memory use, free disk space, uptime and how many tweaks are already active. That number is the only thing you can compare against later. A disk sitting at 90 percent full is a storage problem no registry value will solve, and memory at half capacity has headroom that a RAM-clearing tool will not improve. Change one setting, repeat the same task, then compare against the reading you started from.",
      },
      // The next four sections answer what "windows 11 optimizer" searchers
      // actually want to know: what such a tool changes, which changes are
      // worth having, and in what order. Every control named here is read
      // from the app's own catalogue (src-tauri/src/tweaks.rs), including the
      // caveats; nothing is claimed that the catalogue does not.
      {
        heading: "What a Windows 11 optimizer can actually change",
        body:
          "Strip away the marketing and an optimizer is a list of Windows settings. PC Tweaker's list is grouped the way you will meet it in the app. Performance: the roughly ten-second delay Windows adds before launching startup programs, the delay before menus open, the 400 ms the interface waits before reacting to a resting pointer, the open-and-close window animations, and Store apps that keep running, refreshing and polling the network when you are not using them. Gaming: Xbox Game Bar background recording, the network throttle Windows applies while multimedia runs, the Sticky Keys shortcut that drops you out of a fullscreen game, mouse acceleration, fullscreen optimizations and hardware-accelerated GPU scheduling. Privacy: diagnostic data level, the advertising ID, Bing results in Start, tailored experiences, app-launch tracking, feedback prompts, suggested apps and the Recall screenshot policy. Interface: file extensions, Widgets, the Chat button, the taskbar search box and alignment, transparency, and Explorer's folder-type guessing. Maintenance: Delivery Optimization uploads, the long-path limit and the screen that lets a frozen app block shutdown.",
        points: [
          "Performance: startup, menu and hover delays, animations, background Store apps",
          "Gaming: Game Bar recording, network throttle, Sticky Keys, mouse acceleration",
          "Privacy: diagnostic data, advertising ID, Bing in Start, suggestions, Recall",
          "Interface and maintenance: extensions, Widgets, transparency, update uploads",
        ],
      },
      {
        heading: "The changes that are worth having, and why",
        body:
          "The ones you can feel are the delays. Windows deliberately waits about ten seconds after sign-in before starting your startup apps, holds menus for a moment before opening them, and waits 400 ms before reacting to the pointer resting on a taskbar button or a tooltip; removing those three makes the desktop respond when you click rather than shortly after. Window animations are pure waiting time with GPU work behind them, which matters most on integrated graphics. Store apps running in the background are real CPU, memory and battery spent on apps you did not open. Delivery Optimization uploads your downloaded updates to other people's PCs by default, which is the upstream bandwidth you notice mid-game; limiting it to your own machine stops that. Always showing file extensions is worth turning on for safety alone, because it exposes a file named invoice.pdf.exe for what it is. None of these adds speed to the hardware. They remove work the hardware was doing for nothing.",
        points: [
          "Startup, menu and hover delays: the difference you feel first",
          "Background Store apps: CPU, memory and battery you were not using",
          "Delivery Optimization: stop uploading updates to strangers",
          "File extensions: a safety setting, not a performance one",
        ],
      },
      {
        heading: "The changes the app refuses to oversell",
        body:
          "Several settings that other optimizers sell as performance gains are listed in PC Tweaker with their limits spelled out, because the limits are documented. The MMCSS background reserve is written as 0, which Windows treats as 20%; it does not hand every foreground app the whole CPU. The legacy Games GPU Priority value is one Microsoft documents as unused, and the app says so: no gain is expected from it. The global timer resolution flag does not itself request or verify a timer resolution, and its effect depends on the Windows version. Disabling Memory Integrity removes a layer of kernel protection in exchange for a performance change that varies by hardware, and a policy or UEFI lock may prevent it anyway. Hardware-accelerated GPU scheduling can improve, worsen or leave latency unchanged depending on the game. Reducing diagnostic data requests the lowest level Windows allows and is not an off switch. If you want those settings, apply them knowing what they are.",
        points: [
          "MMCSS reserve 0 means 20%, not zero",
          "Games GPU Priority: documented as unused, no gain expected",
          "Memory Integrity off: a protection removed, not a free gain",
          "HAGS: better, worse or unchanged, by game",
        ],
      },
      {
        heading: "The order that gets results on Windows 11",
        body:
          "Tweaks are the last few percent, so do the big things first. Install pending updates in Settings, Windows Update, and restart. Check Settings, System, Storage: a drive near full slows everything and no setting fixes it. Review Settings, Apps, Startup and switch off what you do not need at sign-in; that is where most slow boots live. On a laptop, check the power mode and whether clock speeds fall under load, which is cooling, not configuration. Then run the Scan to record the baseline, apply the delay and background-app controls first because they are the ones you will notice, and leave the gaming and privacy settings until you have a specific reason for each. Change one thing, repeat the same task, compare with the reading you started from.",
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
          "Windows Update still delivers your drivers, security updates still have to be installed, and thermal, storage and memory limits still cap what the hardware will do. Trimming avoidable background work can make a system feel more responsive; it cannot add processor cores, cool a laptop that is throttling, or repair a failing disk. Treat tweaks as the last few percent, applied after updates, drivers, free space and cooling are already in order.",
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
      checked: "5 October 2026",
      items: [
        { label: "Microsoft: Multimedia Class Scheduler Service (SystemResponsiveness, NetworkThrottlingIndex)", url: "https://learn.microsoft.com/en-us/windows/win32/procthread/multimedia-class-scheduler-service" },
        { label: "Microsoft: configure Windows diagnostic data (AllowTelemetry levels)", url: "https://learn.microsoft.com/en-us/windows/privacy/configure-windows-diagnostic-data-in-your-organization" },
        { label: "Microsoft: Delivery Optimization for Windows updates", url: "https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization" },
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
      "Reduce avoidable background overhead, inspect system conditions and apply gaming-focused changes without surrendering the ability to roll them back.",
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
      "Optimization should not mean guessing how to undo a registry, service or system-setting change weeks later.",
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
      "Adjust supported privacy-related Windows behavior while keeping each action separate, understandable and reversible.",
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
  const storeLink = useCampaignStoreLink("pct-guide-" + path.slice(1));
  if (!guide) return null;

  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12">
      <article className="mx-auto max-w-4xl">
        <p className="font-mono-t text-accent mb-5 text-[12px] tracking-[0.15em]">
          {guide.eyebrow}
        </p>
        <h1 className="font-display max-w-3xl text-4xl leading-[1.08] font-bold tracking-[-0.03em] text-[var(--fg)] md:text-6xl">
          {guide.title}
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--fg-dim)]">{guide.intro}</p>

        {guide.image && <figure className="mt-10"><img src={guide.image} alt={guide.caption} loading="lazy" width="732" height="430" className="h-auto w-full rounded-xl" /><figcaption className="mt-3 text-sm text-[var(--fg-dim)]">{guide.caption}</figcaption></figure>}
        <div className="mt-14 space-y-8">
          {guide.sections.map((section) => (
            <section key={section.heading} className="rounded-2xl bg-[var(--surface)] p-7 md:p-9">
              <h2 className="font-display text-2xl font-bold text-[var(--fg)]">{section.heading}</h2>
              <p className="mt-4 max-w-3xl leading-7 text-[var(--fg-dim)]">{section.body}</p>
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
        {path in PRACTICAL_GUIDES && (
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
