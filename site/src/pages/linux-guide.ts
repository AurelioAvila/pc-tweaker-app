/**
 * The Linux readiness checklist, with the waitlist for the "Ready for Linux?"
 * check (a demand test: signups go to the shared list with source
 * "linux-check"). ProtonDB and Are We Anti-Cheat Yet? are linked, never
 * quoted or embedded: their data stays on their sites.
 */
export const LINUX_FAQS = [
  {
    q: "How can I tell if a Windows game runs on Linux?",
    a: "Look it up on ProtonDB, where players report how it runs through Proton, and read the most recent reports from people with similar hardware. For an online game, also check its anti-cheat status on Are We Anti-Cheat Yet? and the publisher's support pages. Steam Deck Verified is a further hint, but Valve tests on Steam Deck hardware only.",
  },
  {
    q: "Do games with anti-cheat work on Linux?",
    a: "Some do. Widely used anti-cheat systems can run under Proton when the game's developer turns that support on, but some publishers have not done so or block Linux on purpose. A game marked Broken or Denied will not play online on Linux, however good your hardware is.",
  },
  {
    q: "Can I keep Windows and try Linux?",
    a: "Yes. Start a live session from a USB stick to test your hardware without installing anything, then dual boot, ideally from a second drive. Back up your files and have your BitLocker recovery key ready first. SteamOS is the exception: its desktop installer wipes the whole drive.",
  },
  {
    q: "Do NVIDIA graphics cards work for gaming on Linux?",
    a: "Yes, with NVIDIA's own driver. Bazzite includes it, CachyOS installs it through its hardware detection tool and Linux Mint offers it in Driver Manager. SteamOS on desktop PCs is a beta that Valve lists for AMD graphics cards only.",
  },
  {
    q: "Do I need to turn off Secure Boot to install Linux?",
    a: "Not always. Linux Mint is designed to install with Secure Boot on, Bazzite works with it once you enrol its key, and CachyOS can be set up for it after installation. The SteamOS installer may need it turned off to start from a USB stick.",
  },
];

export const LINUX_GUIDES = {
  "/will-my-games-work-on-linux": {
    published: "2026-11-01",
    eyebrow: "LINUX CHECKLIST",
    title: "Will my games work on Linux? Check before you switch",
    seoTitle: "Will My Games Work on Linux? Check First",
    seoDescription:
      "Check each game on ProtonDB and for anti-cheat, then your GPU, Wi-Fi, Secure Boot and disk space before you move to SteamOS, Bazzite, CachyOS or Mint.",
    intro:
      "Many Windows games run on Linux through Proton, the compatibility layer built into Steam, but whether yours do depends on the games, their anti-cheat and your hardware. You can check all three from Windows before you change anything, then decide whether to switch, dual boot or wait.",
    sections: [
      {
        heading: "1. List the games you actually play",
        body: "Start with the five to ten games you play most, not your whole library: those decide whether a switch works for you. Note where each one comes from. Proton is built into Steam; games from other launchers need a separate tool such as Heroic Games Launcher or Lutris, and some launchers have no dependable Linux route at all. Mark which games you play online, because those are the ones anti-cheat can block.",
      },
      {
        heading: "2. Look each game up on ProtonDB",
        body: "ProtonDB collects reports from players running Windows games on Linux and gives each game a medal. Platinum runs perfectly out of the box, Gold runs perfectly after tweaks, Silver runs with minor issues but is generally playable, Bronze runs but often crashes or has problems that get in the way, and Borked will not start or cannot be played. A rating summarises user reports, so open the game's page and read the most recent reports from people with a graphics card like yours: an update can break a game that used to work, and fix one that did not. Valve's Steam Deck Verified label is a second signal, but Valve tests on Steam Deck hardware only, so read it as a hint for a desktop PC, not a guarantee.",
        points: [
          "Platinum or Gold: a good sign",
          "Silver: playable, read the known issues",
          "Bronze or Borked: plan to keep Windows for it",
          "Prefer recent reports from similar hardware",
        ],
      },
      {
        heading: "3. Check anti-cheat before anything else",
        body: "Anti-cheat is the most common hard stop. Widely used anti-cheat systems can work under Proton, but only when the game's developer turns that support on: it is a decision made game by game, not a property of the anti-cheat. Some publishers have not done it, and some block Linux on purpose. Are We Anti-Cheat Yet? tracks multiplayer games with anti-cheat and labels each one Supported, Running, Planned, Broken or Denied. A game marked Broken or Denied will not play online on Linux, however well the rest of your system runs. Check the publisher's own support pages as well, because a single game update can change the answer.",
        points: [
          "Look up every online game you play",
          "Supported or Running: confirm with recent ProtonDB reports",
          "Broken or Denied: keep Windows for that game",
          "Check again after major game updates",
        ],
      },
      {
        heading: "4. Check your graphics card",
        body: "Find the exact model in Windows: open Task Manager, then Performance, then GPU, or run dxdiag and open the Display tab. AMD and Intel graphics use the open-source Mesa drivers that come with Linux distributions, so they normally work from the first boot. NVIDIA cards need NVIDIA's own driver, and each distribution handles it differently: Bazzite ships it built in, CachyOS installs it through its hardware detection tool, and Linux Mint offers it in Driver Manager after installation. SteamOS on a desktop PC is a beta that Valve lists for AMD graphics cards, not NVIDIA.",
      },
      {
        heading: "5. Check Wi-Fi, sound and the rest of your hardware",
        body: "Open Device Manager and write down the exact names under Network adapters, Sound and Bluetooth. Wi-Fi support depends on the chip inside, not on the brand of the laptop or motherboard, so search for the chip's name together with Linux and the distribution you are considering. The surest test is a live session: start the installer from a USB stick without installing anything, then try Wi-Fi, sound, Bluetooth, your monitor's refresh rate and your controller. Linux Mint's installer starts a full desktop for exactly this, and nothing on your drive changes until you choose to install. Also list the apps your hardware relies on: RGB, mouse, headset and fan-control software from hardware makers is usually Windows-only.",
      },
      {
        heading: "6. Secure Boot, BitLocker and Fast Startup",
        body: "Before you change the boot order, find your BitLocker recovery key. Many Windows 11 PCs encrypt the system drive, and Microsoft lists changes to the boot manager and firmware updates among the events that can trigger BitLocker recovery; without the key you cannot get back into Windows. Keys saved to a Microsoft account are listed at aka.ms/myrecoverykey. Then check System Information (msinfo32) for Secure Boot State. Linux Mint is designed to install with Secure Boot on, and its guide covers what to do if you see a Secure Boot violation. Bazzite works with Secure Boot once you enrol its key during setup. CachyOS leaves it to you: its wiki shows how to sign the boot files with your own keys after installation. The SteamOS installer may need Secure Boot turned off just to start from the USB stick. If you plan to dual boot, prefer a setup that keeps Secure Boot on, because some Windows games require it; EA, for example, requires it for Battlefield 6. Bazzite's dual-boot guide also asks you to turn off BitLocker and Windows fast startup before you share a drive with it.",
      },
      {
        heading: "7. Make room, and back up first",
        body: "Back up your personal files to an external drive or cloud storage before you resize anything. Shrinking a partition usually works, but only a backup makes a failure cheap. Plan the space: Linux Mint's guide says the system takes roughly 15 GB and recommends giving it 100 GB or more, and CachyOS asks for at least 30 GB. Games are the real cost. Install them again on the Linux side rather than pointing Steam at your Windows library, because Valve discourages keeping a Steam library on an NTFS drive for Proton. A second SSD just for Linux is the simplest and safest layout: neither system touches the other's drive. SteamOS on a desktop wipes the whole target drive, so give it only a drive you are prepared to erase.",
      },
      {
        heading: "8. Pick a distribution made for gaming",
        body: "SteamOS is Valve's own system, the one on Steam Deck and Steam Machine. On a desktop it is still a beta for PCs with AMD graphics, starts in Steam's console-style interface and takes over a whole drive. Bazzite is a gaming system built on Fedora: NVIDIA drivers and a current Mesa are included, and each update keeps the previous version, so you can go back to it from the boot menu. CachyOS is based on Arch Linux with performance-tuned packages and frequent updates; it suits people who are happy to use a terminal. Linux Mint is a traditional desktop built on Ubuntu. It is not made specifically for gaming, but it is the gentlest start if Linux is new to you, and Steam runs on it as on any other distribution.",
      },
      {
        heading: "Decide: switch, dual boot or wait",
        body: "If every game you care about is Platinum or Gold with no anti-cheat problem, and your hardware worked in a live session, switching is a reasonable move. If one or two important games are Broken or Denied, dual boot and keep Windows for those. If your main games are blocked, wait: anti-cheat support is the publisher's decision, and no setting on your PC can change it.",
      },
    ],
    waitlist: {
      heading: "We're building a free “Ready for Linux?” check inside PC Tweaker",
      body: "It will run on Windows and go through this checklist for you: your installed games with links to their ProtonDB and anti-cheat pages, your graphics card and Wi-Fi chip, Secure Boot and BitLocker status, and the free space for a dual boot. It is not available yet. Leave your email and we'll tell you when it is.",
      source: "linux-check",
      pitch: "One email when it's ready, plus occasional PC Tweaker news. Unsubscribe in one click.",
      button: "Get notified",
      thanks: "Thank you. We'll email you when the check is ready.",
    },
    related: [
      { to: "/gaming-performance/", label: "how to measure frame times before and after a change", note: "Record the same scene on Windows first, so you can compare it fairly on Linux." },
      { to: "/guides/", label: "all PC Tweaker guides", note: "Diagnosis, recovery and privacy guides for the Windows side of a dual boot." },
    ],
    sources: {
      checked: "1 November 2026",
      items: [
        { label: "ProtonDB: game compatibility reports for Proton", url: "https://www.protondb.com/" },
        { label: "ProtonDB: the medal rating system", url: "https://www.protondb.com/news/medal-rating-system" },
        { label: "Are We Anti-Cheat Yet?: anti-cheat status of multiplayer games", url: "https://areweanticheatyet.com/" },
        { label: "Epic Online Services: developers switch on anti-cheat support for Linux and Proton", url: "https://onlineservices.epicgames.com/en-US/news/epic-online-services-launches-anti-cheat-support-for-linux-mac-and-steam-deck" },
        { label: "Steam Deck: the Verified compatibility program", url: "https://www.steamdeck.com/en/verified" },
        { label: "Steam Support: SteamOS installation and supported devices", url: "https://help.steampowered.com/en/faqs/view/65B4-2AA3-5F37-4227" },
        { label: "Bazzite: features, drivers and rollback", url: "https://bazzite.gg/" },
        { label: "Bazzite documentation: Secure Boot", url: "https://docs.bazzite.gg/General/Installation_Guide/secure_boot/" },
        { label: "Bazzite documentation: dual boot setup", url: "https://docs.bazzite.gg/General/Installation_Guide/dual_boot_setup_guide/" },
        { label: "CachyOS wiki: requirements and USB preparation", url: "https://wiki.cachyos.org/installation/installation_prepare/" },
        { label: "CachyOS wiki: hardware detection (chwd)", url: "https://wiki.cachyos.org/features/chwd/chwd/" },
        { label: "CachyOS wiki: Secure Boot setup", url: "https://wiki.cachyos.org/configuration/secure_boot_setup/" },
        { label: "Linux Mint installation guide: live session and disk space", url: "https://linuxmint-installation-guide.readthedocs.io/en/latest/install.html" },
        { label: "Linux Mint installation guide: EFI and Secure Boot", url: "https://linuxmint-installation-guide.readthedocs.io/en/latest/efi.html" },
        { label: "Proton wiki: why Valve discourages NTFS for a Steam library", url: "https://github.com/ValveSoftware/Proton/wiki/Using-a-NTFS-disk-with-Linux-and-Windows" },
        { label: "Microsoft Learn: what can trigger BitLocker recovery", url: "https://learn.microsoft.com/en-us/windows/security/operating-system-security/data-protection/bitlocker/recovery-overview" },
        { label: "Microsoft Support: find your BitLocker recovery key", url: "https://support.microsoft.com/en-us/windows/security/encryption/find-your-bitlocker-recovery-key" },
        { label: "EA: Secure Boot requirement for Battlefield 6", url: "https://www.ea.com/games/battlefield/battlefield-6/news/secure-boot-information" },
      ],
    },
  },
};
