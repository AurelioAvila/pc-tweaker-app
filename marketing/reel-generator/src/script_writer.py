"""
Turns curated PC Tweaker content into a voiced Reels script. Free local
templates only (no Claude/paid API - matches the getcertsprint bot's
"free templates only" configuration). Every script ends with the exact
CTA convention already used in this project's hand-made videos: "Search
'PC Tweaker', link in bio" - never a spoken URL, Reels/TikTok can't carry
a clickable link in the video itself.

Every builder returns (script, item_word_starts): item_word_starts is the
0-based word-index (into script.split()) where each content item begins -
main.py uses it to switch background clips/photos in sync with the real
TTS word timing, same mechanism as the getcertsprint bot.
"""
import random

HOOKS = {
    "mistakewarning": [
        "Windows turned this on without asking you.",
        "This default setting is working against you.",
        "You didn't enable this, Windows did.",
        "Here's a setting you never agreed to.",
        "This has probably been on the whole time.",
    ],
    "contrarian": [
        "Don't install a PC optimizer before hearing this.",
        "Most optimizer tools can't do this one thing.",
        "Here's what separates a safe tool from a risky one.",
        "Before you download anything, check this first.",
    ],
    "beforeafter": [
        "Here's what one click actually changes.",
        "Same PC, one setting flipped.",
        "This is the difference one preset makes.",
        "Watch what changes with a single toggle.",
    ],
}

REACTIONS = {
    "mistakewarning": [
        "And most people never notice.",
        "It's been like that since day one.",
        "Nobody tells you that by default.",
        "That alone can throw things off.",
    ],
    "contrarian": [
        "That's the real difference.",
        "That's what actually matters here.",
        "Worth checking before you install anything.",
    ],
    "beforeafter": [
        "That's not a small difference.",
        "One toggle, real difference.",
        "That's the whole point of the preset.",
    ],
}

CTA = [
    "Search PC Tweaker, link in bio.",
    "Free to try, link in bio.",
    "One click, fully reversible, link in bio.",
    "PC Tweaker, link in bio.",
]

TRANSITIONS = [
    "Here's another one.",
    "And there's more.",
    "Next up.",
    "On top of that.",
]


def _wc(text: str) -> int:
    return len(text.split())


def build_script_template(items, category: str) -> tuple:
    if isinstance(items, str):
        items = [items]
    hook = random.choice(HOOKS.get(category, HOOKS["mistakewarning"]))
    reaction_pool = REACTIONS.get(category, REACTIONS["mistakewarning"])
    cta = random.choice(CTA)

    n = min(len(items), len(reaction_pool))
    reactions = random.sample(reaction_pool, n) if n else []

    parts = [hook]
    item_word_starts = []

    word_count = _wc(hook)
    item_word_starts.append(word_count)
    parts.append(items[0])
    word_count += _wc(items[0])
    if reactions:
        parts.append(reactions[0])
        word_count += _wc(reactions[0])

    for i, item in enumerate(items[1:], start=1):
        transition = random.choice(TRANSITIONS)
        parts.append(transition)
        word_count += _wc(transition)

        item_word_starts.append(word_count)
        parts.append(item)
        word_count += _wc(item)

        if i < len(reactions):
            parts.append(reactions[i])
            word_count += _wc(reactions[i])

    parts.append(cta)
    return " ".join(parts), item_word_starts


LISTTEASE_INTROS = [
    "{n} things Windows does against you.",
    "Save this, {n} things to check right now.",
    "{n} settings Windows turns on without asking.",
    "Check all {n} of these on your own PC.",
]


def build_listtease_script_template(topic: str, items: list) -> tuple:
    intro = random.choice(LISTTEASE_INTROS).format(n=len(items))
    cta = random.choice(CTA)

    parts = [intro]
    item_word_starts = []
    word_count = _wc(intro)
    for i, item in enumerate(items):
        item_text = f"Number {i + 1}: {item}"
        item_word_starts.append(word_count)
        parts.append(item_text)
        word_count += _wc(item_text)

    parts.append(cta)
    return " ".join(parts), item_word_starts


if __name__ == "__main__":
    from content import get_random_content_multi

    category, items = get_random_content_multi("mistakewarning")
    print(build_script_template(items, category))
