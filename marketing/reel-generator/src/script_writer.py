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

# Rinforzati 2026-08-01 dopo la prima analisi cross-account reale: gli hook
# in prima persona/conseguenza diretta (stress-test, POV, "la differenza si
# vede solo quando e' troppo tardi") hanno performato 5-40x meglio degli
# hook generici "ecco un'impostazione" su Groomlyco/Magdock - stessa logica
# applicata qui, non solo teoria. Vedi
# feedback_reinforce_winning_hooks nella memoria per i dati.
# Pool ampliati 2026-08-02 da 4-5 a 10 hook per categoria. Un audit su 300
# generazioni ne ha contati solo 5 distinti: da quando l'hook e' anche il
# testo della HOOK CARD nel primo fotogramma (vedi _hook_card_clip in
# src/render.py) e' diventato l'elemento piu' visibile del video, quindi
# ripetersi ogni 5 video costa molto piu' di prima. Archetipi volutamente
# diversi (prima persona / conseguenza / POV / numero concreto / mito da
# smontare) invece di variazioni della stessa formula: quella sarebbe
# varieta' solo apparente.
HOOKS = {
    "mistakewarning": [
        "I checked every default Windows setting for a week, this one shocked me.",
        "The setting that only shows up as a problem when it's too late.",
        "Windows turned this on without asking you.",
        "You didn't enable this, Windows did.",
        "This has probably been on the whole time.",
        "Nobody checks this one, and it's been running since day one.",
        "Your PC isn't slow, it's busy doing something you never approved.",
        "I found this on every single machine I've cleaned up this year.",
        "This is the default that quietly costs you performance every boot.",
        "Fresh install, brand new laptop, and this was already switched on.",
    ],
    "contrarian": [
        "I stress-tested three PC optimizers so you don't have to.",
        "Don't install a PC optimizer before hearing this.",
        "Most optimizer tools can't do this one thing.",
        "Here's what separates a safe tool from a risky one.",
        "The free tools aren't the problem, the irreversible ones are.",
        "Every 'speed booster' I tested did the same three things.",
        "If a tool can't undo a change, that's not optimization, that's a gamble.",
        "I paid for one of these so you can skip it entirely.",
        "The honest answer is most of these do almost nothing.",
        "Registry cleaners are still being sold in 2026, and here's why that matters.",
    ],
    "beforeafter": [
        "POV: your PC finally runs like it should.",
        "Same PC, one setting flipped, here's the difference.",
        "Here's what one click actually changes.",
        "This is the difference one preset makes.",
        "Same hardware, same games, completely different numbers.",
        "I recorded the before and after so you don't have to trust me.",
        "Nothing was upgraded here, only switched off.",
        "This took eleven seconds and I wish I'd done it a year ago.",
        "The boot time alone made this worth it.",
        "No new parts, no reinstall, just the defaults corrected.",
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
    # Aggiunte 2026-08-02: ricerca 2026 (Hootsuite, Eclincher, TrueFuture
    # Media) conferma che share/save sono il segnale di ranking piu' pesato
    # su Instagram/TikTok (le DM share valgono 3-10x un like) - prima ogni
    # CTA era solo "link in bio", zero richiesta esplicita di salvare o
    # condividere. Queste varianti chiedono l'azione ad alto peso E
    # nominano comunque il prodotto.
    "Save this before you forget, then search PC Tweaker.",
    "Send this to whoever's PC is a mess right now. PC Tweaker, link in bio.",
    "Tag someone who needs this fix. PC Tweaker, link in bio.",
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
    # Il terzo elemento e' la frase-hook parlata: serve alla hook card del
    # render, che la mostra per intero nel primo fotogramma (vedi
    # _hook_card_clip in src/render.py).
    return " ".join(parts), item_word_starts, hook


LISTTEASE_INTROS = [
    "I went through {n} Windows settings that only bite you later.",
    "{n} things Windows does against you.",
    "Save this, {n} things to check right now.",
    "{n} settings Windows turns on without asking.",
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
    return " ".join(parts), item_word_starts, intro


if __name__ == "__main__":
    from content import get_random_content_multi

    category, items = get_random_content_multi("mistakewarning")
    print(build_script_template(items, category))
