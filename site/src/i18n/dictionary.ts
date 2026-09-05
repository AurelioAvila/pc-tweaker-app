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
    readonly safetyNote: string;
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
    readonly tipThanks: string;
  };
  readonly coffee: {
    readonly pill: string;
    readonly caption: string;
    readonly fewer: string;
    readonly more: string;
    readonly unavailable: string;
  };
}

export const engDictionary: Dictionary = {
  "coffee": {
    "pill": "Support PC Tweaker",
    "caption": "Optional one-time tip. Your download is free.",
    "fewer": "One fewer coffee",
    "more": "One more coffee",
    "unavailable": "Tipping is temporarily unavailable. You can still download PC Tweaker."
  },
  "nav": {
    "results": "Evidence",
    "arsenal": "Features",
    "protocol": "How it works",
    "access": "Free & Pro",
    "faq": "FAQ",
    "download": "Download Free"
  },
  "hero": {
    "eyebrow": "WINDOWS TUNING YOU CAN INSPECT",
    "title1": "TUNE FOR",
    "title2": "STEADIER",
    "title3": "FRAME TIMES.",
    "subBold": "Make deliberate changes. Keep what works.",
    "sub": " Review Windows settings for gaming, privacy and everyday use. See what each tweak changes, save its previous state and restore supported settings when you need to. Start free. No account required.",
    "cta": "Download Free for Windows",
    "safetyNote": "PC Tweaker 1.9.0 is code-signed. Our signed Windows installers identify Aurelio Avila as the publisher. Older downloads may be unsigned; check the file's Digital Signatures tab. SmartScreen may still show a warning for a new release.",
    "terminalTitle": "Install with Windows Package Manager",
    "terminalCmd": "winget install --id AurelioAvila.PCTweaker --exact",
    "terminalHint": "# install the official PC Tweaker package",
    "copy": "COPY",
    "copied": "COPIED",
    "badges": [
      {
        "label": "MajorGeeks reviews",
        "href": "https://www.majorgeeks.com/files/details/pc_tweaker.html"
      },
      {
        "label": "Softpedia review: 4.5/5",
        "href": "https://www.softpedia.com/get/Tweak/System-Tweak/Avila-PC-Tweaker.shtml"
      },
      {
        "label": "Microsoft Store",
        "href": "https://apps.microsoft.com/detail/9nh3c6dt1g87"
      },
      {
        "label": "Inspect the source",
        "href": "https://github.com/AurelioAvila/pc-tweaker-app"
      }
    ],
    "themeLabel": "THEMES"
  },
  "metrics": {
    "tag": "01 / WHAT TO MEASURE",
    "title": "Average FPS is only part of the story.",
    "sub": "Judge a change by repeated runs: frame-time spikes, 1% lows and consistency. Results depend on your hardware, drivers and game. The chart below is an illustration, not a captured benchmark or a promised improvement.",
    "stats": [
      {
        "value": 37,
        "unit": "",
        "label": "TWEAKS INCLUDED FREE"
      },
      {
        "value": 61,
        "unit": "",
        "label": "TWEAKS IN THIS RELEASE"
      },
      {
        "value": 0,
        "unit": "",
        "label": "ACCOUNTS NEEDED FOR FREE"
      },
      {
        "value": 1,
        "unit": "",
        "label": "PLACE TO REVIEW & RESTORE"
      }
    ],
    "graphTitle": "ILLUSTRATIVE COMPARISON — NOT MEASURED DATA",
    "graphStock": "EXAMPLE A",
    "graphTweaked": "EXAMPLE B",
    "graphNote": "Illustrative traces and FPS values. No measured frame-time, micro-stutter or DPC-latency improvement is claimed by this chart.",
    "fpsStock": 330,
    "fpsTweaked": 551
  },
  "arsenal": {
    "tag": "02 / YOUR CONTROLS",
    "title": "Know what changes. Know why.",
    "cards": [
      {
        "tag": "PC HEALTH",
        "title": "Understand the score",
        "body": "See the settings and observations behind your health score, including startup apps, power configuration and security status. It is a configuration summary, not an FPS benchmark.",
        "pro": false,
        "span": "wide"
      },
      {
        "tag": "CHANGE TRACKING",
        "title": "See what moved",
        "body": "Compare the facts behind your previous and current scores. When startup apps or settings change, see the difference. When the evidence is unchanged, there is no reason to invent a problem.",
        "pro": false,
        "span": "wide"
      },
      {
        "tag": "TECHNICAL DETAILS",
        "title": "Inspect before you apply",
        "body": "Read the registry path, value type and setting written by a tweak. For other operations, inspect the commands involved. Decide with the details in front of you.",
        "pro": false,
        "span": "wide"
      },
      {
        "tag": "RESTORE",
        "title": "Keep a way back",
        "body": "Supported settings save their previous state before a change. Restore an individual tweak or review Restore All. Restoring settings does not recover permanently deleted caches or replace a full system backup.",
        "pro": false,
        "span": "wide"
      },
      {
        "tag": "HARDWARE",
        "title": "Read the sensors you have",
        "body": "Monitor available temperatures, utilization, VRAM, fan speed and power readings. Unsupported sensors are identified. Use readings during a real workload to understand heat and load together.",
        "pro": false,
        "span": "wide"
      },
      {
        "tag": "DRIVERS",
        "title": "Review updates in one place",
        "body": "Inspect your driver inventory and install available updates through Windows Update. Check the device and update details before proceeding; a newer driver is not automatically a faster one.",
        "pro": false,
        "span": "std"
      },
      {
        "tag": "THERMAL PROFILES",
        "title": "Choose your power trade-off",
        "body": "Use supported hardware controls to balance noise, temperature and power. Review the limits your device exposes and return to its stock profile. Higher limits can mean more heat and noise.",
        "pro": false,
        "span": "std"
      },
      {
        "tag": "SCAN",
        "title": "Start with a clear inventory",
        "body": "Check CPU, memory, storage and available tweaks. Review your selection before applying changes. An inactive tweak is an option to consider, not proof that your PC is broken.",
        "pro": false,
        "span": "std"
      },
      {
        "tag": "PERFORMANCE",
        "title": "Tune Windows to your workload",
        "body": "Review power plans, startup delay and foreground scheduling settings. Compare under the same workload, then retain only the changes that help your machine.",
        "pro": false,
        "span": "std"
      },
      {
        "tag": "GAMING",
        "title": "Make sessions easier to manage",
        "body": "Use Game Sessions to apply a gaming preset when a supported game starts and restore its supported settings afterward. Review hardware scheduling and input options individually.",
        "pro": true,
        "span": "std"
      },
      {
        "tag": "PRIVACY",
        "title": "Choose what Windows shares",
        "body": "Review supported advertising, tracking and diagnostic settings. Availability varies by Windows edition. Check password exposure using a hash-prefix lookup; your full password is not sent.",
        "pro": true,
        "span": "std"
      },
      {
        "tag": "NETWORK",
        "title": "Test your connection settings",
        "body": "Compare supported TCP congestion settings and restore the previous configuration. TCP tuning does not control every download on your network or guarantee lower latency in UDP-based games.",
        "pro": false,
        "span": "std"
      },
      {
        "tag": "RYZEN X3D",
        "title": "Test cache-aware placement",
        "body": "On supported dual-die Ryzen X3D processors, inspect the cache topology and test game placement on the cache-equipped die. Single-die chips do not need this adjustment. Compare before keeping it.",
        "pro": false,
        "span": "std"
      },
      {
        "tag": "MAINTENANCE",
        "title": "Find what is taking up space",
        "body": "Review large files, duplicates and supported drive tools. Cleanup explains what can be restored and what is deleted permanently. Removing shader caches can cause rebuilding and temporary stutter.",
        "pro": false,
        "span": "wide"
      },
      {
        "tag": "INTERFACE",
        "title": "Make Windows feel familiar",
        "body": "Adjust file extensions, taskbar options, appearance and other supported interface settings. Choose your app language and theme while keeping the controls close at hand.",
        "pro": false,
        "span": "wide"
      }
    ]
  },
  "philosophy": {
    "tag": "03 / THE STANDARD",
    "lines": [
      {
        "text": "// a setting is not a result.",
        "kind": "comment"
      },
      {
        "text": "// your workload decides what helps.",
        "kind": "comment"
      },
      {
        "text": "",
        "kind": "plain"
      },
      {
        "text": "Inspect. Change. Compare.",
        "kind": "strong"
      },
      {
        "text": "See the setting before you apply it.",
        "kind": "plain"
      },
      {
        "text": "Keep the changes that earn their place.",
        "kind": "accent"
      },
      {
        "text": "Restore supported settings when you need to.",
        "kind": "plain"
      },
      {
        "text": "",
        "kind": "plain"
      },
      {
        "text": "// clear limits are part of the product.",
        "kind": "comment"
      }
    ]
  },
  "protocol": {
    "tag": "04 / HOW IT WORKS",
    "title": "Four steps. You stay in control.",
    "steps": [
      {
        "mono": "REVIEW",
        "title": "See your starting point",
        "body": "Run a scan and inspect available settings. Note your hardware, game settings and current performance before changing anything."
      },
      {
        "mono": "APPLY",
        "title": "Choose the changes",
        "body": "Read each tweak's effect and trade-offs. Apply your selection; operations that need administrator access request Windows approval."
      },
      {
        "mono": "COMPARE",
        "title": "Run the same workload",
        "body": "Repeat the same scene or task under comparable conditions. Look at consistency and frame-time spikes alongside average FPS. Pro adds Game Sessions for repeatable session setup."
      },
      {
        "mono": "RESTORE",
        "title": "Keep what helps",
        "body": "Restore supported settings that do not improve your experience. Check the outcome of each restore. Cleanup and repair operations have their own recovery limits."
      }
    ]
  },
  "pricing": {
    "tag": "05 / FREE & PRO",
    "title": "Start with control. Upgrade for convenience.",
    "free": {
      "plan": "FREE",
      "price": "€0",
      "per": "/ no subscription",
      "features": [
        "37 Windows tweaks",
        "Scan and review your settings",
        "Startup tools and Windows integrity checks",
        "Restore supported changes",
        "No account or card required"
      ],
      "cta": "Download Free"
    },
    "pro": {
      "plan": "PRO — ANNUAL",
      "price": "€59",
      "per": "/ year · monthly option €9.99",
      "save": "SAVE 51% VS MONTHLY",
      "features": [
        "All 61 tweaks in this release",
        "Turbo Gaming and Game Sessions",
        "Guided Windows repair with DISM and SFC",
        "Selective cookie cleanup",
        "Supported app cache cleanup",
        "Advanced file and drive tools",
        "Account-based Pro activation"
      ],
      "cta": "Download & Explore Pro"
    }
  },
  "faq": {
    "tag": "07 / BEFORE YOU START",
    "title": "Clear answers before your first change.",
    "items": [
      {
        "q": "Will PC Tweaker improve FPS or remove micro-stutter?",
        "a": "There is no universal FPS gain. Results depend on the game, hardware, drivers and starting configuration. Compare repeated runs and check frame-time consistency. Shader compilation, thermal limits and driver problems may need a different fix. PC Tweaker does not promise to eliminate micro-stutter or reduce DPC latency on every system."
      },
      {
        "q": "Are the sensor readings real, and where do drivers come from?",
        "a": "Hardware monitoring uses available sensor readings and identifies unsupported values. Driver updates are delivered through Windows Update. Review the target device, keep a recovery path and compare behavior after updating."
      },
      {
        "q": "What can I undo?",
        "a": "Supported settings store their previous state and can be restored individually or through Restore All. This is not a complete system image. Permanently deleted caches cannot be recovered through setting rollback, and Windows repair and driver changes have separate recovery limits. Review each operation before applying it."
      },
      {
        "q": "Can I use it with competitive games?",
        "a": "PC Tweaker configures Windows and uses supported monitoring paths; it is not an aim or gameplay modification tool. Game and anti-cheat policies can change. Check the rules for your game, league or tournament. Compatibility and freedom from bans cannot be guaranteed."
      },
      {
        "q": "What is free, and how does Pro work?",
        "a": "Free includes 37 tweaks, scan, supported restore tools, hardware monitoring and selected maintenance tools, with no account required. Pro adds advanced features and Game Sessions. Current subscriptions are €9.99 per month or €59 per year; lifetime is €74.99 once while offered in the app. Review the final price and renewal terms at checkout. Existing lifetime purchases retain the access promised when purchased."
      },
      {
        "q": "What leaves my PC?",
        "a": "Applying local settings is separate from online services. Account, license, update, payment, support and optional breach-check requests contact their respective services. The breach check sends a hash prefix, not your complete password. Read the Privacy Policy for details. Private feedback is not reused as a public testimonial without permission."
      },
      {
        "q": "Is PC Tweaker code-signed?",
        "a": "PC Tweaker 1.9.0 ships with Windows application and installer signatures from Aurelio Avila and a trusted timestamp. Older releases may be unsigned. A valid signature identifies the publisher and helps detect changed files. The separate update signature verifies update packages. Neither guarantees performance gains or prevents every SmartScreen prompt."
      }
    ]
  },
  "reviews": {
    "tag": "06 / USER FEEDBACK",
    "title": "See what other users found.",
    "outOf": "out of 5",
    "basedOn": "based on {count} site ratings",
    "note": "Existing site ratings are kept. Written feedback is private and is not published here. On SourceForge, fulxor wrote: “Helpful and well done, good job!” (August 6, 2026). External reviews retain their original context and do not verify performance claims.",
    "writeCta": "Share Your Experience",
    "formTitle": "How did PC Tweaker work for you?",
    "formName": "Name",
    "formNameHint": "Optional; not displayed publicly.",
    "formEmail": "Email",
    "formEmailHint": "Optional; used to identify an updated rating and contact you if needed.",
    "formRating": "Your rating",
    "formBody": "Your experience",
    "formBodyHint": "Optional. Sent privately to support; not posted on this page.",
    "formBodyPlaceholder": "Tell me your hardware, what you changed and what happened. Improvements, no change and problems are all useful.",
    "submit": "Submit Rating",
    "submitting": "Submitting…",
    "thanks": "Thank you. Your rating has been recorded.",
    "cancel": "Close"
  },
  "support": {
    "navLabel": "Support",
    "tag": "SUPPORT / DIRECT LINE",
    "title": "Something not working? Tell us.",
    "intro": "Send the details below so Aurelio can investigate the issue. Include your app version, the setting or tool involved, and the exact error message.",
    "selfServeTitle": "Start with these checks",
    "selfServe": [
      {
        "q": "A tweak made something worse",
        "a": "Restore that supported setting from its card, or review Restore All. Check the result of the restore. Setting rollback does not recover permanently deleted files or replace the separate recovery procedures for repair, drivers and hardware controls."
      },
      {
        "q": "Windows blocked the installer (\"unrecognized app\")",
        "a": "Check that the download came from an official channel and compare the release notes and publisher details. Version 1.9.0 introduces signed Windows installers from Aurelio Avila. Older versions, including v1.8.0, may be unsigned. A valid signature or winget installation does not guarantee that SmartScreen will show no warning."
      },
      {
        "q": "Pro features are still locked after paying",
        "a": "Return to PC Tweaker while connected to the internet so it can refresh your account and license. If access is still locked, contact support with the email used for the purchase and the payment time. Do not post your license file or payment details publicly."
      },
      {
        "q": "The app won't start at all",
        "a": "Confirm that you are using the official Windows x64 build and note any Windows or WebView2 error. If an operation requires administrator access, Windows asks for approval. Send the exact error and app version if the app still will not start."
      }
    ],
    "beforeTitle": "Include these details",
    "beforeItems": [
      "Your Windows version (Win + R → type winver)",
      "Which tweak or screen the problem happens on",
      "The exact error text or code, if any appeared",
      "What you already tried (including Restore All)"
    ],
    "formTitle": "Send a support request",
    "formIntro": "We reply to the address you enter here.",
    "name": "Full name",
    "email": "Email address",
    "emailHint": "This is where our reply goes. Double-check it.",
    "category": "What's this about?",
    "categories": [
      {
        "value": "installation",
        "label": "Installation / update"
      },
      {
        "value": "activation",
        "label": "Pro activation"
      },
      {
        "value": "tweak-issue",
        "label": "A tweak isn't working"
      },
      {
        "value": "rollback",
        "label": "Rollback / restore"
      },
      {
        "value": "billing",
        "label": "Billing / refund"
      },
      {
        "value": "bug",
        "label": "Bug report"
      },
      {
        "value": "other",
        "label": "Something else"
      }
    ],
    "subject": "Subject",
    "subjectPlaceholder": "One line: what's wrong",
    "systemInfo": "System details",
    "systemInfoHint": "Optional — Windows version, GPU, app version.",
    "message": "Describe the problem",
    "messagePlaceholder": "What did you do, what did you expect, and what happened instead? Include any error text exactly as it appeared.",
    "submit": "Send message",
    "submitting": "Sending…",
    "successTitle": "Message sent",
    "successBody": "Your request has been accepted. Check your inbox for a confirmation; delivery may take a little time.",
    "responseTime": "Replies are sent to the email address you provide.",
    "backHome": "Back to home"
  },
  "newsletter": {
    "pitch": "Release notes, test results and practical Windows tuning guides.",
    "placeholder": "Your email address",
    "button": "Get Updates",
    "thanks": "Thank you. Check your inbox for your welcome email.",
    "genericError": "We could not save your subscription. Please try again."
  },
  "footer": {
    "tagline": "Windows tuning. Visible changes. Informed decisions.",
    "product": "PC TWEAKER",
    "download": "Download for Windows",
    "changelog": "Release Notes",
    "source": "Inspect the Source",
    "reviews": "INDEPENDENT REVIEWS",
    "legal": "POLICIES",
    "privacy": "Privacy",
    "terms": "Terms & Billing",
    "cookies": "Cookies",
    "accessibility": "Accessibility",
    "contact": "Contact Aurelio",
    "license": "Source-Available License",
    "copyright": "Created and maintained by Aurelio Avila. © 2026 Aurelio Avila",
    "motto": "// every millisecond is earned",
    "tipThanks": "Thank you for supporting PC Tweaker."
  }
};

export const dictionaries = { en: engDictionary } as const;
export type Locale = keyof typeof dictionaries;

/** Active dictionary. Swap here (or lift into state) to change language. */
export const text: Dictionary = dictionaries.en;
