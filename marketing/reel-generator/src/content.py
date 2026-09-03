"""
Curated content pools for PC Tweaker Reels. Grounded entirely in
marketing/video-scripts.md (real 2026 research already done for this
niche: hook formulas, direct competitors, posting notes, KB5121003 -
Windows 11's August 2026 update) and README.md (real app features) -
nothing invented. Archetypes match what the research already identified
as working here: Mistake Warning, List Tease, Contrarian Claim.
"""
import random

# PER-ITEM queries instead of per-category (2026-08-05, requested: "when you
# do the rankings you should at least depict the thing you're talking about,
# even approximately"). Before this, every slideshow image was drawn at random
# from the category's GENERIC pool ("windows laptop screen" and so on),
# regardless of which of the 3 ranking entries the voice was actually on at
# that moment - the narration could say "Xbox Game Bar" while showing some
# unrelated desk. Same shape already proven on solofounded-bot
# (_VISUAL_CONCEPTS/fact_footage_query): the mapped concept first, then - only
# as a fallback - the generic category, never a gap.
_VISUAL_CONCEPTS = [
    (("xbox game bar", "game bar"), "xbox controller gaming"),
    (("power plan", "cpu", "throttle"), "laptop cpu performance"),
    (("gpu", "graphics", "input lag"), "gaming pc graphics card"),
    (("mouse pointer", "mouse acceleration", "aim"), "computer mouse closeup"),
    (("advertising id", "profile on you", "ads"), "smartphone notifications ads"),
    (("location tracking", "location"), "phone gps map"),
    (("bing", "search results", "start menu search"), "windows search bar typing"),
    (("telemetry", "data collection"), "server data privacy"),
    (("admin rights", "permission"), "windows security settings screen"),
    (("optimize now", "vague button", "one time permission"), "software settings toggle"),
    (("registry",), "computer code settings screen"),
    (("winget", "package manager", "random exe"), "software download install"),
    (("dns", "isp"), "network router internet"),
    (("original value", "reversible", "revert"), "windows laptop settings screen"),
    # Added 2026-08-20 alongside the two new Copilot/Recall items below - the
    # same "AI & Technology" niche already documented in video-scripts.md
    # (Video 8, Copilot Actions) but until now never represented in the
    # AUTOMATIC pool (content.py), only in the script for a manual shoot.
    (("copilot", "ai assistant"), "artificial intelligence computer screen"),
    (("recall", "ai screen snapshot", "ai-indexed"), "computer screen artificial intelligence"),
    # Added 2026-08-23 alongside the four new KB5121003 items below - the same
    # gap as the Copilot/Recall block above: real, already-verified facts (see
    # marketing/video-scripts.md, "Update 23 August 2026") that had never made
    # it into the AUTOMATIC pool before now.
    (("fingerprint", "enhanced sign-in security", "ess"), "fingerprint scanner biometric security"),
    (("image generation", "on-device ai", "ai component"), "artificial intelligence computer screen"),
    (("file explorer", "file size", "kilobytes"), "windows file explorer screen"),
    (("middle-click", "middle click", "new tab"), "computer mouse closeup"),
    (("low latency profile", "app launch", "cpu boost"), "laptop cpu performance"),
]


def item_footage_query(text: str) -> str:
    """Pexels query for the background/photo of ONE specific entry (one of the
    points in a ranking, or the single item of a mistakewarning/contrarian/
    beforeafter script), rather than for the whole category.

    Falls back to None (not an empty string) when no concept matches, so the
    caller can tell "no match, use the category pool" apart from "empty
    query"."""
    low = f" {text.lower()} "
    for keywords, query in _VISUAL_CONCEPTS:
        if any(k in low for k in keywords):
            return query
    return None


CATEGORIES = ["mistakewarning", "contrarian", "beforeafter"]

# Listicle category ("3 things Windows does against you"), handled
# separately since it needs several items, not one - same pattern as the
# getcertsprint bot's checklist category.
LISTTEASE_CATEGORY = "listtease"
LISTTEASE_TOPICS = ["windows_defaults", "privacy_tweaks", "windows_2026_update"]

ALL_CATEGORIES = CATEGORIES + [LISTTEASE_CATEGORY]

# List Tease gets 2x weight - video-scripts.md's Video 2 is exactly this
# format and the research notes call out "List Tease" as one of the
# highest-performing hook formulas for this niche.
CATEGORY_WEIGHTS = {c: 1 for c in CATEGORIES}
CATEGORY_WEIGHTS[LISTTEASE_CATEGORY] = 2
# beforeafter to 2x too (2026-08-03 research): AI/tech-tutorial content is
# the fastest-growing Shorts niche in 2026, and within that niche the
# format called out as a specific high performer is exactly this category -
# "Shorts that demo a tool in 30 seconds or show a before-and-after
# workflow comparison tend to get high engagement and shares" - not just
# tutorials in general. Same reasoning as the List Tease boost above, this
# time backed by 2026 data specific to our niche instead of the niche in
# general. (https://virvid.ai/blog/most-profitable-ai-youtube-shorts-niches-2026-rpm-data)
CATEGORY_WEIGHTS["beforeafter"] = 2


def pick_category() -> str:
    return random.choices(ALL_CATEGORIES, weights=[CATEGORY_WEIGHTS[c] for c in ALL_CATEGORIES])[0]


# category -> (hashtags, Pexels background search queries)
# Each category's query pool is deliberately distinct (not just reshuffled
# from the same 4 phrases) - reusing "gaming setup" / "computer screen close
# up" etc. across every category was collapsing everything into the same
# handful of Pexels results, so videos ended up with near-identical covers
# (user feedback 2026-08-02: "I've already seen some that look alike").
# Hashtag pools widened 2026-08-17 (user feedback: "tags poco efficaci" -
# every listtease video, for example, carried the exact same 5 tags in the
# exact same order every single time, since the old pool WAS the per-video
# tag set instead of a pool to draw from). Each pool below is now 10-12 real
# tags actually used by PC-optimization/gaming-tech TikTok accounts, and
# auto-upload.js's buildCaption() samples a random subset per video instead
# of taking the list verbatim - see tiktok-upload/auto-upload.js.
CATEGORY_META = {
    "mistakewarning": (
        ["pcgaming", "windowstips", "pctweaks", "gamingsetup", "fps", "pcperformance",
         "gamingpc", "windows11tips", "pcbuild", "techtok", "gamingtips"],
        ["gaming setup rgb", "esports player headset", "pc monitor night", "gaming keyboard closeup", "controller hands gaming"],
    ),
    "contrarian": (
        ["windowstools", "pcoptimization", "cybersecurity", "windows", "techtok",
         "pcsafety", "windowssecurity", "techtips", "pcbuild", "computersetup"],
        ["coding screen", "server room", "hacker typing", "data center lights", "software developer office"],
    ),
    "beforeafter": (
        ["pcoptimization", "windowstips", "gaming", "techtips", "pcbuild",
         "gamingsetup", "windows11", "pcperformance", "beforeandafter", "techtok"],
        ["windows laptop settings screen", "computer keyboard closeup", "gaming pc case lights", "gaming laptop screen"],
    ),
    LISTTEASE_CATEGORY: (
        ["windows11", "pcoptimization", "techtips", "gaming", "windowstips",
         "pctips", "windowshacks", "gamingsetup", "pcbuild", "techtok"],
        ["laptop desk workspace", "typing laptop home", "tech desk setup", "windows laptop screen"],
    ),
}

# Caption "hook" line, first line of the IG/TikTok caption (research in
# video-scripts.md: fear/mistake-warning hooks vastly outperform generic
# benefit hooks in this niche).
# Pool widened 2026-08-03: it was 4 captions per category, 16 in total. An
# audit over 300 generations counted just 16 distinct captions, meaning at 3
# videos a day the text started repeating verbatim every 5 days - a
# duplicate-content signal never worth giving, least of all on a new account.
# Doubled to 8 per category (32 in total, ~11 days).
# KEYWORD ALWAYS IN THE FIRST LINE (2026-08-06): Instagram ranks captions like
# a search engine and weighs keywords in the first 60-80 characters
# (Toptal/TrueFuture research, 2026). Several hooks contained neither
# "Windows" nor "PC" nor "gaming" ("One click, real difference", "The setting
# nobody thinks to check"): curiosity with no subject = invisible in search.
# Every hook now carries at least one keyword from the topic.
CAPTION_HOOKS = {
    "mistakewarning": [
        "Windows turned this on without asking you \U0001F6A8",
        "This Windows default setting is working against you",
        "You didn't enable this, Windows did",
        "Check if this Windows setting is still on right now",
        "Your PC isn't slow, it's busy doing this",
        "This has been running since day one on your PC",
        "Fresh Windows install and this was already on",
        "The Windows setting nobody thinks to check",
    ],
    "contrarian": [
        "Don't install a PC optimizer before this",
        "Most PC optimizer tools can't do this",
        "The difference between a safe PC tool and a risky one",
        "Read this before you download any PC booster",
        "If a Windows tweak can't be undone, it's a gamble",
        "I tested these PC boosters so you can skip them",
        "Registry cleaners are still being sold in 2026",
        "The honest answer about PC 'speed boosters'",
    ],
    "beforeafter": [
        "One click, real Windows difference",
        "This is what one Windows preset actually changes",
        "Before vs after, same PC",
        "Nobody expects this much of a PC difference",
        "Same PC hardware, completely different numbers",
        "Nothing upgraded on this PC, only switched off",
        "The Windows boot time alone made this worth it",
        "No new PC parts, just the Windows defaults corrected",
    ],
    LISTTEASE_CATEGORY: [
        "3 things Windows does against you \U0001F440",
        "Save this before your next gaming session",
        "Windows never tells you this",
        "Check all 3 of these Windows settings right now",
        "3 Windows defaults worth turning off tonight",
        "Save this Windows checklist, you'll want it later",
        "3 Windows settings that only bite you later",
        "Number 3 is the Windows setting people miss",
    ],
}

# Every item here is a REAL feature/behavior straight from README.md and
# video-scripts.md - nothing invented, nothing exaggerated beyond what the
# app actually does.
FALLBACK = {
    "mistakewarning": [
        "Windows enables mouse pointer acceleration by default, called Enhance Pointer Precision, and it throws off your aim in games without you noticing.",
        "Windows defaults to the Balanced power plan, which throttles CPU performance to save battery even on a plugged in desktop.",
        "Xbox Game Bar runs in the background by default, and its overlay can quietly eat CPU and RAM during gameplay.",
        "Hardware accelerated GPU Scheduling is often left disabled by default, even though enabling it can reduce input lag.",
        "Windows ships with an advertising ID turned on by default, letting apps build a profile on you for targeted ads.",
        "Bing search results get mixed into your Start menu search by default, even when you are just looking for a local file.",
        # Added 2026-08-20 (trend research: "AI & Technology" is the
        # fastest-growing Shorts niche in mid-2026, ~18x YoY, CPM $15-22 -
        # virvid.ai/blog/most-profitable-ai-youtube-shorts-niches-2026-rpm-data,
        # confirmed by mediacube.io/en-US/blog/best-youtube-niches. The channel
        # had already identified the angle (video-scripts.md, Video 8) but only
        # for a one-off manual shoot: content.py, the pool that generates the
        # actual automatic videos, contained NO item on Copilot or Recall even
        # though both are real, already-shipped tweaks (tweaks.rs, ids
        # "disable_copilot" and "disable_recall") - a concrete gap between what
        # the app really does and what the channel says about it.
        "Windows Copilot runs in the background by default with no permanent off switch in Settings, only a policy toggle most people never find.",
        "Recall can build a searchable AI history of everything that has ever been on your screen, passwords and private messages included, unless you turn it off yourself.",
        # Added 2026-08-23 (KB5121003, the August 2026 Windows 11 update,
        # build 26100.9168/26200.9168 - the same gap as the Copilot/Recall
        # block above, this time on the most recent news. Sources:
        # windowsforum.com "KB5121003 Lets Copilot+ PCs Remove Image
        # Generation AI", notebookcheck.net "Windows 11 ships nine AI
        # components, you can delete one" - see marketing/video-scripts.md for
        # the detail).
        "Copilot+ PCs ship with on-device AI components like Image Generation pre-installed and running, and only since the August 2026 Windows update can you actually uninstall the ones you never asked for.",
    ],
    "contrarian": [
        "Most PC optimizer tools change registry values with no real way to undo them if something breaks.",
        "PC Tweaker shows you exactly what each tweak modifies before you apply it, not a vague optimize now button.",
        "Every tweak in PC Tweaker saves the original value first, so you can roll it back with one click.",
        "PC Tweaker installs through winget, the official Windows package manager, not a random exe from a website.",
        "The app itself never runs with admin rights, it only asks for a one time permission for the specific tweak you approve.",
        # Added 2026-08-19 (feedback: these tools "get criticised a lot...
        # they need to be less stupid and more genuinely useful", plus a real
        # comment found on a video: "probably an unsafe vibe coded tool", with
        # a link to CTT util windows as the "real alternative"). The contrarian
        # category already talked about reversibility, but never about the tool
        # having been checked by independent third parties - the real answer to
        # "vibe coded" is "not just my code, other people have looked at it",
        # not one more line of self-reassurance. Facts verifiable from
        # README.md, nothing invented: it is NOT open source (source-available
        # licence, not MIT/GPL), so it must never be called "open source".
        "PC Tweaker isn't open source, but the code is source-available for anyone to review, and it's listed independently on MajorGeeks and Softpedia, not just self-hosted.",
        "The Windows package manager only lists PC Tweaker because a Microsoft-reviewed pull request approved it into winget-pkgs, the same community repo every legit app goes through.",
        "78 automated tests run on every single code change before it ships, covering the exact rollback logic that undoes a tweak.",
    ],
    "beforeafter": [
        "Before: Windows fighting you with default settings tuned for battery life. After: a Turbo Gaming preset that flips every performance setting at once.",
        "Before: mouse aim feels inconsistent because of pointer acceleration. After: turning it off makes every flick land where you expect.",
        "Before: not knowing what a random optimizer tool actually changed. After: seeing the exact setting and reverting it in one click if you want to.",
        # Added 2026-08-03 along with the category's weight boost (see
        # CATEGORY_WEIGHTS above): the pool was stuck at 3 items, the same
        # thinness already solved for the HOOKS on 2026-08-02 - doubling this
        # category's frequency without also widening its content would only
        # have moved the repetition problem from one pool to another. These two
        # are real features from README.md as well, not invented.
        "Before: Xbox Game Bar's Game DVR recording in the background every time you play. After: switched off in one toggle, nothing left running behind your game.",
        "Before: your DNS still pointed at whatever your ISP set by default. After: switched to Cloudflare's private DNS in one toggle.",
        # Added 2026-08-23: the same real fact already documented for Video 7
        # in marketing/video-scripts.md (KB5121003, August 2026), which never
        # made it into the automatic pool. The "40%" and "1-3 seconds" figures
        # come from Microsoft/Windows Latest, they are not estimates - see the
        # sources in the video script.
        "Before: apps took a beat to open even on decent hardware. After: Windows 11's August 2026 update spikes your CPU for 1 to 3 seconds the moment you launch an app, up to 40% faster for in-box apps like Edge.",
    ],
}

LISTTEASE_ITEMS = {
    "windows_defaults": [
        "Xbox Game Bar runs in the background by default and can eat CPU and RAM mid game.",
        "The Balanced power plan throttles your CPU by default, even on a plugged in desktop.",
        "Hardware accelerated GPU Scheduling is often left off by default, even though it can cut input lag.",
        "Mouse pointer acceleration is on by default and can throw off your aim.",
    ],
    "privacy_tweaks": [
        "The advertising ID is on by default, letting apps build a profile on you.",
        "Location tracking is on by default for apps that request it.",
        "Bing search results get mixed into local Start menu search by default.",
        "Telemetry data collection is on by default at a higher level than most people realize.",
        # Aggiunti 2026-08-20, stesso gap e stesse fonti citate sopra in
        # FALLBACK["mistakewarning"].
        "Windows Copilot has no permanent off switch in Settings, only a policy toggle most people never find.",
        "Recall can quietly build a searchable AI history of everything shown on your screen.",
    ],
    # New topic 2026-08-23: KB5121003, the August 2026 Windows 11 update
    # (build 26100.9168/26200.9168) - too fresh, and with too many distinct
    # points, to fit in a single item of the lists above, exactly as
    # "beforeafter" already has a dedicated topic for specific news. Every
    # entry is a real behaviour of that release, not invented - sources and
    # detail in marketing/video-scripts.md, "Update 23 August 2026".
    "windows_2026_update": [
        "Windows Hello Enhanced Sign-in Security now works with compatible external USB fingerprint readers, not only sensors built into the laptop.",
        "Copilot+ PCs can finally uninstall the on-device Image Generation AI component instead of it sitting there unused.",
        "File Explorer finally shows file sizes in KB, MB or GB instead of listing everything in kilobytes.",
        "Middle-clicking a folder in File Explorer's address bar or Home page now opens it in a new tab instead of replacing the current one.",
        "The Low Latency Profile now covers app launches too, briefly spiking your CPU to open apps faster.",
    ],
}


def get_random_content_multi(category: str, n: int = 2) -> tuple:
    """Returns (category, [n distinct items]) drawn from the curated pool."""
    pool = FALLBACK[category]
    n = min(n, len(pool))
    items = random.sample(pool, n)
    return category, items


def get_listtease_content(n: int = 3, topic: str = None) -> tuple:
    """Returns (topic, [n distinct list items])."""
    topic = topic or random.choice(LISTTEASE_TOPICS)
    pool = LISTTEASE_ITEMS[topic]
    items = random.sample(pool, min(n, len(pool)))
    return topic, items


if __name__ == "__main__":
    print(get_random_content_multi("mistakewarning"))
    print(get_listtease_content())
