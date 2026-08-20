"""
Curated content pools for PC Tweaker Reels. Grounded entirely in
marketing/video-scripts.md (real 2026 research already done for this
niche: hook formulas, direct competitors, posting notes) and README.md
(real app features) - nothing invented. Archetypes match what the
research already identified as working here: Mistake Warning, List
Tease, Contrarian Claim.
"""
import random

# Query per-VOCE invece che per-categoria (2026-08-05, richiesta utente:
# "quando fai le classifiche dovresti raffigurare almeno la cosa di cui
# parli, magari anche in modo approssimativo"). Prima ogni immagine dello
# slideshow veniva pescata a caso dal pool GENERICO della categoria
# ("windows laptop screen" ecc.), a prescindere da quale dei 3 punti della
# classifica la voce stesse davvero dicendo in quel momento - una voce
# poteva dire "Xbox Game Bar" e mostrare una scrivania qualsiasi. Stesso
# schema gia' validato su solofounded-bot (_VISUAL_CONCEPTS/
# fact_footage_query): prima il concetto mappato, poi - solo come ripiego -
# la categoria generica, mai un buco.
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
    # Aggiunti 2026-08-20 insieme ai due nuovi item Copilot/Recall qui sotto -
    # stessa nicchia "AI & Technology" gia' documentata in video-scripts.md
    # (Video 8, Copilot Actions) ma finora mai rappresentata nel pool
    # AUTOMATICO (content.py), solo nello script per la ripresa manuale.
    (("copilot", "ai assistant"), "artificial intelligence computer screen"),
    (("recall", "ai screen snapshot", "ai-indexed"), "computer screen artificial intelligence"),
]


def item_footage_query(text: str) -> str:
    """Query Pexels per lo sfondo/foto di UNA voce specifica (uno dei punti
    di una classifica, o l'unico item di uno script mistakewarning/
    contrarian/beforeafter), invece della categoria intera.

    Ripiego a None (non stringa vuota) quando nessun concetto combacia,
    cosi' il chiamante puo' distinguere "nessuna corrispondenza, usa il
    pool di categoria" da "query vuota"."""
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
# Pool ampliato il 2026-08-03: erano 4 caption per categoria, 16 in tutto.
# Un audit su 300 generazioni ha mostrato appena 16 caption distinte, cioe'
# a 3 video/giorno il testo ricominciava a ripetersi identico ogni 5 giorni -
# un segnale di contenuto duplicato che non conviene mai dare, tanto piu' su
# un account nuovo. Raddoppiate a 8 per categoria (32 totali, ~11 giorni).
# KEYWORD SEMPRE NELLA PRIMA RIGA (2026-08-06): Instagram ranka le caption
# come un motore di ricerca e pesa le keyword nei primi 60-80 caratteri
# (ricerca Toptal/TrueFuture 2026). Diversi hook non contenevano ne'
# "Windows" ne' "PC" ne' "gaming" ("One click, real difference", "The
# setting nobody thinks to check"): curiosita' senza argomento = invisibile
# in ricerca. Ogni hook ora contiene almeno una keyword del topic.
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
        # Aggiunti 2026-08-20 (ricerca trend: "AI & Technology" e' la nicchia
        # Shorts a crescita piu' rapida a meta' 2026, ~18x YoY, CPM $15-22 -
        # virvid.ai/blog/most-profitable-ai-youtube-shorts-niches-2026-rpm-data,
        # confermato da mediacube.io/en-US/blog/best-youtube-niches. Il canale
        # aveva gia' individuato l'angolo (video-scripts.md, Video 8) ma solo
        # per una ripresa manuale una tantum: content.py, il pool che genera i
        # video automatici veri, non conteneva NESSUN item su Copilot o
        # Recall pur essendo entrambi tweak reali e gia' shippati (tweaks.rs,
        # id "disable_copilot" e "disable_recall") - un gap concreto tra cio'
        # che l'app fa davvero e cio' che il canale racconta di lei.
        "Windows Copilot runs in the background by default with no permanent off switch in Settings, only a policy toggle most people never find.",
        "Recall can build a searchable AI history of everything that has ever been on your screen, passwords and private messages included, unless you turn it off yourself.",
    ],
    "contrarian": [
        "Most PC optimizer tools change registry values with no real way to undo them if something breaks.",
        "PC Tweaker shows you exactly what each tweak modifies before you apply it, not a vague optimize now button.",
        "Every tweak in PC Tweaker saves the original value first, so you can roll it back with one click.",
        "PC Tweaker installs through winget, the official Windows package manager, not a random exe from a website.",
        "The app itself never runs with admin rights, it only asks for a one time permission for the specific tweak you approve.",
        # Aggiunti 2026-08-19 (Aurelio: "vengono molto criticati... bisogna
        # renderli meno stupidi e piu' utili e intelligenti" + commento reale
        # trovato su un video: "probably an unsafe vibe coded tool", con link
        # a CTT util windows come "alternativa vera"). La categoria
        # contrarian gia' parlava di reversibilita', ma mai del fatto che il
        # tool e' stato controllato da terzi indipendenti - la vera risposta
        # a "vibe coded" e' "non solo il mio codice, altri l'hanno guardato",
        # non un'altra frase di auto-rassicurazione. Fatti verificabili da
        # README.md, niente inventato: NON e' open source (licenza source-
        # available, non MIT/GPL), quindi non va mai chiamato "open source".
        "PC Tweaker isn't open source, but the code is source-available for anyone to review, and it's listed independently on MajorGeeks and Softpedia, not just self-hosted.",
        "The Windows package manager only lists PC Tweaker because a Microsoft-reviewed pull request approved it into winget-pkgs, the same community repo every legit app goes through.",
        "78 automated tests run on every single code change before it ships, covering the exact rollback logic that undoes a tweak.",
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
        # Aggiunti 2026-08-20, stesso gap e stesse fonti citate sopra in
        # FALLBACK["mistakewarning"].
        "Windows Copilot has no permanent off switch in Settings, only a policy toggle most people never find.",
        "Recall can quietly build a searchable AI history of everything shown on your screen.",
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
