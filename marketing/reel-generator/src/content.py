"""
Curated content pools for PC Tweaker Reels. Grounded entirely in
marketing/video-scripts.md (real 2026 research already done for this
niche: hook formulas, direct competitors, posting notes) and README.md
(real app features) - nothing invented. Archetypes match what the
research already identified as working here: Mistake Warning, List
Tease, Contrarian Claim.
"""
import random

CATEGORIES = ["mistakewarning", "contrarian", "beforeafter"]

# Listicle category ("3 things Windows does against you"), handled
# separately since it needs several items, not one - same pattern as the
# getcertsprint bot's checklist category.
LISTTEASE_CATEGORY = "listtease"
LISTTEASE_TOPICS = ["windows_defaults", "privacy_tweaks"]

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
# (user feedback 2026-08-02: "gia' ne ho viste alcune simili").
CATEGORY_META = {
    "mistakewarning": (
        ["pcgaming", "windowstips", "pctweaks", "gamingsetup", "fps"],
        ["gaming setup rgb", "esports player headset", "pc monitor night", "gaming keyboard closeup", "controller hands gaming"],
    ),
    "contrarian": (
        ["windowstools", "pcoptimization", "cybersecurity", "windows", "techtok"],
        ["coding screen", "server room", "hacker typing", "data center lights", "software developer office"],
    ),
    "beforeafter": (
        ["pcoptimization", "windowstips", "gaming", "techtips", "pcbuild"],
        ["pc build custom", "computer parts closeup", "gaming pc case lights", "hardware upgrade desk"],
    ),
    LISTTEASE_CATEGORY: (
        ["windows11", "pcoptimization", "techtips", "gaming", "windowstips"],
        ["laptop desk workspace", "typing laptop home", "tech desk setup", "windows laptop screen"],
    ),
}

# Caption "hook" line, first line of the IG/TikTok caption (research in
# video-scripts.md: fear/mistake-warning hooks vastly outperform generic
# benefit hooks in this niche).
# Pool ampliato il 2026-08-03: erano 4 caption per categoria, 16 in tutto.
# Un audit su 300 generazioni ha mostrato appena 16 caption distinte, cioe'
# a 3 video/giorno il testo ricominciava a ripetersi identico ogni 5 giorni -
# un segnale di contenuto duplicato che non conviene mai dare, tanto piu' su
# un account nuovo. Raddoppiate a 8 per categoria (32 totali, ~11 giorni).
CAPTION_HOOKS = {
    "mistakewarning": [
        "Windows turned this on without asking you \U0001F6A8",
        "This default setting is working against you",
        "You didn't enable this, Windows did",
        "Check if this is still on right now",
        "Your PC isn't slow, it's busy doing this",
        "This has been running since day one",
        "Fresh install and this was already on",
        "The setting nobody thinks to check",
    ],
    "contrarian": [
        "Don't install a PC optimizer before this",
        "Most optimizer tools can't do this",
        "The difference between a safe tool and a risky one",
        "Read this before you download anything",
        "If it can't undo the change, it's a gamble",
        "I tested these so you can skip them",
        "Registry cleaners are still being sold in 2026",
        "The honest answer about 'speed boosters'",
    ],
    "beforeafter": [
        "One click, real difference",
        "This is what one preset actually changes",
        "Before vs after, same PC",
        "Nobody expects this much of a difference",
        "Same hardware, completely different numbers",
        "Nothing upgraded here, only switched off",
        "The boot time alone made this worth it",
        "No new parts, just the defaults corrected",
    ],
    LISTTEASE_CATEGORY: [
        "3 things Windows does against you \U0001F440",
        "Save this before your next gaming session",
        "Windows never tells you this",
        "Check all 3 of these right now",
        "3 defaults worth turning off tonight",
        "Save this list, you'll want it later",
        "3 settings that only bite you later",
        "Number 3 is the one people miss",
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
    ],
    "contrarian": [
        "Most PC optimizer tools change registry values with no real way to undo them if something breaks.",
        "PC Tweaker shows you exactly what each tweak modifies before you apply it, not a vague optimize now button.",
        "Every tweak in PC Tweaker saves the original value first, so you can roll it back with one click.",
        "PC Tweaker installs through winget, the official Windows package manager, not a random exe from a website.",
        "The app itself never runs with admin rights, it only asks for a one time permission for the specific tweak you approve.",
    ],
    "beforeafter": [
        "Before: Windows fighting you with default settings tuned for battery life. After: a Turbo Gaming preset that flips every performance setting at once.",
        "Before: mouse aim feels inconsistent because of pointer acceleration. After: turning it off makes every flick land where you expect.",
        "Before: not knowing what a random optimizer tool actually changed. After: seeing the exact setting and reverting it in one click if you want to.",
        # Aggiunti 2026-08-03 insieme al boost di peso della categoria (vedi
        # CATEGORY_WEIGHTS sopra): la pool era ferma a 3 item, la stessa
        # thinness gia' risolta per gli HOOKS il 2026-08-02 - raddoppiare la
        # frequenza di questa categoria senza ampliarne anche il contenuto
        # avrebbe solo spostato il problema della ripetizione da un pool
        # all'altro. Anche questi due sono feature reali da README.md, non
        # inventate.
        "Before: Xbox Game Bar's Game DVR recording in the background every time you play. After: switched off in one toggle, nothing left running behind your game.",
        "Before: your DNS still pointed at whatever your ISP set by default. After: switched to Cloudflare's private DNS in one toggle.",
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
