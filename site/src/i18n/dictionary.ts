/* ============================================================
   I18N ARCHITECTURE
   ------------------------------------------------------------
   Every user-visible string on the page lives here, strongly
   typed. Components never hardcode copy — they read keys from
   the active dictionary.

   To add a language: clone `engDictionary`, translate values
   (the `Dictionary` type guarantees no key is missed), register
   it in `dictionaries`, and swap the active export. The layout
   never changes.

     export const dictionaries = { en: engDictionary, it: itDictionary, ... }
   ============================================================ */

export interface Dictionary {
  readonly nav: {
    readonly results: string;
    readonly arsenal: string;
    readonly protocol: string;
    readonly access: string;
    readonly faq: string;
    readonly download: string;
  };
  readonly hero: {
    readonly eyebrow: string;
    readonly title1: string;
    readonly title2: string;
    readonly title3: string;
    readonly subBold: string;
    readonly sub: string;
    readonly cta: string;
    readonly terminalTitle: string;
    readonly terminalCmd: string;
    readonly terminalHint: string;
    readonly copy: string;
    readonly copied: string;
    readonly badges: readonly { readonly label: string; readonly href: string }[];
    readonly themeLabel: string;
  };
  readonly metrics: {
    readonly tag: string;
    readonly title: string;
    readonly sub: string;
    readonly stats: readonly {
      readonly value: number;
      readonly unit: string;
      readonly label: string;
    }[];
    readonly graphTitle: string;
    readonly graphStock: string;
    readonly graphTweaked: string;
    readonly graphNote: string;
    readonly fpsStock: number;
    readonly fpsTweaked: number;
  };
  readonly arsenal: {
    readonly tag: string;
    readonly title: string;
    readonly cards: readonly {
      readonly tag: string;
      readonly title: string;
      readonly body: string;
      readonly pro: boolean;
      readonly span: "wide" | "tall" | "std";
    }[];
  };
  readonly philosophy: {
    readonly tag: string;
    readonly lines: readonly {
      readonly text: string;
      readonly kind: "comment" | "plain" | "strong" | "accent";
    }[];
  };
  readonly protocol: {
    readonly tag: string;
    readonly title: string;
    readonly steps: readonly {
      readonly mono: string;
      readonly title: string;
      readonly body: string;
    }[];
  };
  readonly pricing: {
    readonly tag: string;
    readonly title: string;
    readonly free: {
      readonly plan: string;
      readonly price: string;
      readonly per: string;
      readonly features: readonly string[];
      readonly cta: string;
    };
    readonly pro: {
      readonly plan: string;
      readonly price: string;
      readonly per: string;
      readonly save: string;
      readonly features: readonly string[];
      readonly cta: string;
    };
  };
  readonly faq: {
    readonly tag: string;
    readonly title: string;
    readonly items: readonly { readonly q: string; readonly a: string }[];
  };
  readonly reviews: {
    readonly tag: string;
    readonly title: string;
    readonly outOf: string;
    readonly basedOn: string;
    readonly note: string;
    readonly writeCta: string;
    readonly formTitle: string;
    readonly formName: string;
    readonly formNameHint: string;
    readonly formEmail: string;
    readonly formEmailHint: string;
    readonly formRating: string;
    readonly formBody: string;
    readonly formBodyHint: string;
    readonly formBodyPlaceholder: string;
    readonly submit: string;
    readonly submitting: string;
    readonly thanks: string;
    readonly cancel: string;
  };
  readonly support: {
    readonly navLabel: string;
    readonly tag: string;
    readonly title: string;
    readonly intro: string;
    readonly selfServeTitle: string;
    readonly selfServe: readonly { readonly q: string; readonly a: string }[];
    readonly beforeTitle: string;
    readonly beforeItems: readonly string[];
    readonly formTitle: string;
    readonly formIntro: string;
    readonly name: string;
    readonly email: string;
    readonly emailHint: string;
    readonly category: string;
    readonly categories: readonly { readonly value: string; readonly label: string }[];
    readonly subject: string;
    readonly subjectPlaceholder: string;
    readonly systemInfo: string;
    readonly systemInfoHint: string;
    readonly message: string;
    readonly messagePlaceholder: string;
    readonly submit: string;
    readonly submitting: string;
    readonly successTitle: string;
    readonly successBody: string;
    readonly responseTime: string;
    readonly backHome: string;
  };
  readonly newsletter: {
    readonly pitch: string;
    readonly placeholder: string;
    readonly button: string;
    readonly thanks: string;
    readonly genericError: string;
  };
  readonly footer: {
    readonly tagline: string;
    readonly product: string;
    readonly download: string;
    readonly changelog: string;
    readonly source: string;
    readonly reviews: string;
    readonly legal: string;
    readonly privacy: string;
    readonly terms: string;
    readonly cookies: string;
    readonly accessibility: string;
    readonly contact: string;
    readonly license: string;
    readonly copyright: string;
    readonly motto: string;
  };
}

export const engDictionary: Dictionary = {
  nav: {
    results: "Results",
    arsenal: "Arsenal",
    protocol: "Protocol",
    access: "Access",
    faq: "FAQ",
    download: "Download",
  },
  hero: {
    eyebrow: "WINDOWS OPTIMIZATION — ENGINEERED, NOT GUESSED",
    title1: "EVERY",
    title2: "MILLISECOND",
    title3: "IS EARNED.",
    subBold: "50 real Windows tweaks",
    sub: " — registry, power plan, services, scheduler priorities. Every single one snapshotted before it touches your system. One click to apply. One click to undo.",
    cta: "Download for Windows — Free",
    terminalTitle: "powershell — pctweaker",
    terminalCmd: "winget install AurelioAvila.PCTweaker",
    terminalHint: "# zero SmartScreen prompts via winget",
    copy: "COPY",
    copied: "COPIED ✓",
    badges: [
      { label: "MajorGeeks 4.0/5.0", href: "https://www.majorgeeks.com/files/details/pc_tweaker.html" },
      { label: "Softpedia Listed", href: "https://www.softpedia.com/get/Tweak/System-Tweak/Avila-PC-Tweaker.shtml" },
      { label: "Source Available", href: "https://github.com/AurelioAvila/pc-tweaker-app" },
    ],
    themeLabel: "THEMES",
  },
  metrics: {
    tag: "01 / MEASURED, NOT PROMISED",
    title: "Stock Windows leaves frames on the table.",
    sub: "Numbers from our own recorded, published benchmark — same machine, same match type, before and after PC Tweaker's gaming preset. No synthetic scores. No cherry-picked peaks.",
    stats: [
      { value: 67, unit: "%", label: "AVG FPS GAIN — VALORANT" },
      { value: 50, unit: "", label: "REAL SYSTEM TWEAKS" },
      { value: 100, unit: "%", label: "REVERSIBLE — SNAPSHOT FIRST" },
      { value: 1, unit: "CLICK", label: "FULL SYSTEM RESTORE" },
    ],
    graphTitle: "FRAME-TIME STABILITY — 60s SAMPLE",
    graphStock: "STOCK",
    graphTweaked: "TWEAKED",
    graphNote: "// avg match FPS · Valorant · same hardware · full session recorded & published",
    fpsStock: 330,
    fpsTweaked: 551,
  },
  arsenal: {
    tag: "02 / THE ARSENAL",
    title: "Six domains. Zero placebo.",
    cards: [
      {
        tag: "PC HEALTH SCORE",
        title: "A score that can prove itself",
        body: "Nine categories, one speedometer — and every point traces to a shown fact: your startup apps, your power plan, your Defender state. Press Show more and the factor list IS the calculation. Computed only when you ask, entirely on your PC.",
        pro: false,
        span: "wide",
      },
      {
        tag: "ROLLBACK ENGINE",
        title: "Snapshot first. Always.",
        body: "Before any tweak writes a single registry value, its previous state is captured. Revert one tweak, or all 36 at once with Restore All. Optimization you can walk back from — that is the entire premise.",
        pro: false,
        span: "wide",
      },
      {
        tag: "SCAN",
        title: "One-click diagnosis",
        body: "Live CPU / RAM / disk telemetry, plus a list of everything not yet optimized. Fix all of it behind a single UAC prompt.",
        pro: false,
        span: "std",
      },
      {
        tag: "PERFORMANCE",
        title: "CPU & power tuning",
        body: "Scheduler priority, High Performance plan, startup-app delay removal, CPU power throttling off.",
        pro: false,
        span: "std",
      },
      {
        tag: "GAMING",
        title: "Game Sessions",
        body: "HAGS, GPU priority, input-lag reduction — and a Turbo preset that auto-applies when your game launches, auto-reverts when it closes.",
        pro: true,
        span: "std",
      },
      {
        tag: "PRIVACY",
        title: "Telemetry, silenced",
        body: "Advertising ID, tracking, Cortana, diagnostic data — off. Plus a k-anonymity password breach check.",
        pro: true,
        span: "std",
      },
      {
        tag: "MAINTENANCE",
        title: "Disk intelligence",
        body: "Duplicate finder by content hash, large-file hunter, S.M.A.R.T. drive health, SSD-safe TRIM. Deletions go to the Recycle Bin — never permanent.",
        pro: false,
        span: "wide",
      },
      {
        tag: "INTERFACE",
        title: "Your desktop, your rules",
        body: "Dark mode, file extensions, taskbar cleanup, transparency off. 5 languages, 12 themes.",
        pro: false,
        span: "std",
      },
    ],
  },
  philosophy: {
    tag: "03 / ENGINEERING PHILOSOPHY",
    lines: [
      { text: '// most "PC optimizers" are theater.', kind: "comment" },
      { text: "// fake progress bars over fake work.", kind: "comment" },
      { text: "", kind: "plain" },
      { text: "We don't sell placebo.", kind: "strong" },
      { text: "Every tweak reads and writes the real registry,", kind: "plain" },
      { text: "the real power plan, the real services —", kind: "accent" },
      { text: "and snapshots the previous value first. Full stop.", kind: "plain" },
      { text: "", kind: "plain" },
      { text: "// if it can't be undone, it doesn't ship.", kind: "comment" },
    ],
  },
  protocol: {
    tag: "04 / PROTOCOL",
    title: "From stock to tuned in four moves.",
    steps: [
      {
        mono: "INITIAL TELEMETRY",
        title: "Scan the machine",
        body: "Live system readout — CPU, memory, disk — and a precise list of every optimization not yet active. You see exactly what will change before anything does.",
      },
      {
        mono: "BOTTLENECK REMOVAL",
        title: "Apply, once",
        body: "Every selected tweak batches behind a single UAC prompt — not one popup per toggle. Each previous value is snapshotted before it's written.",
      },
      {
        mono: "SESSION MODE",
        title: "Play",
        body: "Game Sessions detects your game launching, applies the Turbo preset automatically, and reverts it the moment you close. Peak state only when it matters.",
      },
      {
        mono: "STABILITY GUARANTEE",
        title: "Rollback, anytime",
        body: "Changed your mind? Restore one tweak or the entire system to its original state in one click. Cleanup deletions live in the Recycle Bin, not the void.",
      },
    ],
  },
  pricing: {
    tag: "05 / ACCESS",
    title: "33 tweaks free, forever.",
    free: {
      plan: "FREE",
      price: "€0",
      per: "/ forever",
      features: [
        "33 real tweaks across all five domains",
        "One-click Scan & Fix All",
        "Full rollback engine included",
        "No account required",
      ],
      cta: "Download Free",
    },
    pro: {
      plan: "PRO — ANNUAL",
      price: "€59",
      per: "/ year · or €9.99/mo",
      save: "SAVE 51%",
      features: [
        "All 50 tweaks unlocked",
        "Turbo Gaming preset + Game Sessions",
        "Duplicate & large file finder, drive optimization",
        "Pro syncs across your installs",
      ],
      cta: "Get the App → Upgrade Inside",
    },
  },
  faq: {
    tag: "06 / STRAIGHT ANSWERS",
    title: "Asked, answered.",
    items: [
      {
        q: "Is this safe? Can it break Windows?",
        a: "Every tweak snapshots the original value before changing it, and everything can be reverted — individually or all at once with Restore All. Cleanup operations move files to the Recycle Bin, never delete permanently. That reversibility is the core design constraint of the entire app.",
      },
      {
        q: "Will it get me banned in competitive games?",
        a: "PC Tweaker changes Windows settings only — registry values, power plans, service states. It never touches game files, injects into processes, or modifies memory. It's system configuration, the same category as changing settings in Control Panel.",
      },
      {
        q: "What's actually free?",
        a: "33 of the 50 tweaks, the Scan, the rollback engine, the RAM cleaner, and the startup manager — free forever, no account needed. Pro (€9.99/month or €59/year) unlocks the advanced set: Turbo Gaming, Game Sessions, duplicate/large file finders, drive optimization, disabling Recall and Memory Integrity, the classic right-click menu, and the rest of the power-user tweaks.",
      },
      {
        q: "Does it phone home?",
        a: "The tweaks themselves never send data anywhere. The optional account exists solely to sync your Pro status between installs. The password breach check uses k-anonymity — your password never leaves your machine in full. The source is publicly viewable on GitHub, so you can verify all of this yourself.",
      },
      {
        q: 'Windows says "unrecognized app" on install. Why?',
        a: 'The installer isn\'t Authenticode-signed yet, so SmartScreen shows a warning on first run: click "More info" → "Run anyway". Prefer zero prompts? Install via winget: winget install AurelioAvila.PCTweaker',
      },
    ],
  },
  reviews: {
    tag: "05 / VERDICT",
    title: "What people who run it say",
    outOf: "out of 5",
    basedOn: "based on {count} ratings",
    note: "Ratings are published as an average. Anything you write goes straight to the team — it isn't posted on this page.",
    writeCta: "Rate PC Tweaker",
    formTitle: "Leave your rating",
    formName: "Your name",
    formNameHint: "Optional.",
    formEmail: "Email",
    formEmailHint: "Optional. Only used if we need to follow up.",
    formRating: "Your rating",
    formBody: "Anything you want to tell us",
    formBodyHint: "Optional, and private — this reaches the team by email only.",
    formBodyPlaceholder:
      "What did you run it on, and what changed? Concrete numbers help more than adjectives.",
    submit: "Submit rating",
    submitting: "Sending…",
    thanks: "Thanks — your rating has been counted.",
    cancel: "Cancel",
  },
  support: {
    navLabel: "Support",
    tag: "SUPPORT / DIRECT LINE",
    title: "Something not working? Tell us.",
    intro:
      "PC Tweaker is built and maintained by one engineer, so your message is read by the person who writes the code — not a ticket queue. Most issues are solved on the first reply.",
    selfServeTitle: "Fix it yourself in 30 seconds",
    selfServe: [
      {
        q: "A tweak made something worse",
        a: "Open the app and press Restore All, or restore that single tweak from its card. Every tweak snapshots the previous value before it writes, so undo is exact — not a guess at defaults.",
      },
      {
        q: 'Windows blocked the installer ("unrecognized app")',
        a: 'The installer isn\'t Authenticode-signed yet, so SmartScreen warns on first run. Click "More info" → "Run anyway". To skip the prompt entirely, install with: winget install AurelioAvila.PCTweaker',
      },
      {
        q: "Pro features are still locked after paying",
        a: "Sign out and back in from the account menu — entitlement is fetched at sign-in. If it's still locked, send us the email address you paid with and we'll fix it manually.",
      },
      {
        q: "The app won't start at all",
        a: "Right-click the shortcut and choose Run as administrator. PC Tweaker needs elevation to read and write the registry keys it manages. If it still fails, include the exact error code below.",
      },
    ],
    beforeTitle: "Include these and we'll likely solve it in one reply",
    beforeItems: [
      "Your Windows version (Win + R → type winver)",
      "Which tweak or screen the problem happens on",
      "The exact error text or code, if any appeared",
      "What you already tried (including Restore All)",
    ],
    formTitle: "Send a support request",
    formIntro: "We reply to the address you enter here.",
    name: "Full name",
    email: "Email address",
    emailHint: "This is where our reply goes. Double-check it.",
    category: "What's this about?",
    categories: [
      { value: "installation", label: "Installation / update" },
      { value: "activation", label: "Pro activation" },
      { value: "tweak-issue", label: "A tweak isn't working" },
      { value: "rollback", label: "Rollback / restore" },
      { value: "billing", label: "Billing / refund" },
      { value: "bug", label: "Bug report" },
      { value: "other", label: "Something else" },
    ],
    subject: "Subject",
    subjectPlaceholder: "One line: what's wrong",
    systemInfo: "System details",
    systemInfoHint: "Optional — Windows version, GPU, app version.",
    message: "Describe the problem",
    messagePlaceholder:
      "What did you do, what did you expect, and what happened instead? Include any error text exactly as it appeared.",
    submit: "Send message",
    submitting: "Sending…",
    successTitle: "Message sent",
    successBody:
      "It's in our inbox and a copy is on its way to your email. We usually reply within one business day.",
    responseTime: "Typical first reply: under 24 hours, Monday to Friday.",
    backHome: "Back to home",
  },
  newsletter: {
    pitch: "New tweaks, new releases, new tools — occasionally, by email.",
    placeholder: "your@email.com",
    button: "Subscribe",
    thanks: "You're in — check your inbox for a welcome email.",
    genericError: "Something went wrong. Please try again in a moment.",
  },
  footer: {
    tagline: "A safer way to tune your Windows PC.",
    product: "PRODUCT",
    download: "Download",
    changelog: "Changelog",
    source: "Source Code",
    reviews: "REVIEWS",
    legal: "LEGAL",
    privacy: "Privacy Policy",
    terms: "Terms",
    cookies: "Cookie Policy",
    accessibility: "Accessibility",
    contact: "Contact",
    license: "Proprietary License",
    copyright: "Built solo in Amsterdam with Tauri (Rust) + React. © 2026 Aurelio Avila",
    motto: "// every millisecond is earned",
  },
};

export const dictionaries = { en: engDictionary } as const;
export type Locale = keyof typeof dictionaries;

/** Active dictionary. Swap here (or lift into state) to change language. */
export const text: Dictionary = dictionaries.en;
