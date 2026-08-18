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
    # Nota sui pattern di hook (aggiornato 2026-08-03): i test 2026 su 30 hook
    # virali danno solo 4 famiglie sopra quota 70 - Identity Call, Contrarian
    # Strike, Open Loop, Confession - con Identity Call primo assoluto (85 di
    # media) perche' nomina in faccia il pubblico a cui parla, mentre le
    # aperture generiche scendono sotto 30. Qui c'erano gia' Confession,
    # Contrarian e Open Loop; mancava del tutto Identity Call, aggiunto ora
    # in ogni categoria.
    "mistakewarning": [
        "If you game on a laptop, Windows is working against you right now.",
        "Anyone with a prebuilt PC: check this before your next session.",
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
        "If you've ever downloaded a 'PC booster', this one's for you.",
        "Windows 11 users: the tool you're about to install matters more than you think.",
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
        "If your PC takes forever to boot, this is for you.",
        "Anyone still gaming on a five-year-old machine: watch this part.",
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

# CTA riscritte il 2026-08-06 con la logica di conversione del canale
# YouTube: il fine del video e' portare chi guarda al prodotto, quindi
# l'offerta dev'essere CONCRETA e agganciata a cio' che il video ha appena
# mostrato ("fixes everything you just saw in one click" continua il
# discorso; "link in bio" da solo non offre niente). Le varianti save/share
# restano perche' sono le azioni piu' pesate dal ranking, ma anche loro ora
# dicono COSA ottieni aprendo il link.
CTA = [
    "PC Tweaker fixes everything you just saw in one click, and it's free to try. Link in bio.",
    "You could change all of this by hand, or let PC Tweaker do it in one click. Free, link in bio.",
    "Every tweak you just saw is one click in PC Tweaker, and one click to undo. Link in bio.",
    "PC Tweaker shows you exactly what it changes before it touches anything. Free to try, link in bio.",
    "Save this before you forget, then let PC Tweaker do it for you in one click. Link in bio.",
    "Send this to whoever's PC is a mess right now, the one-click fix is in the bio.",
]

# Chiusure da commento-gioco per il formato a lista (2026-08-06): lezione
# presa da youtube-bot, dove il quiz e' l'unico formato in cui commentare
# fa parte del gioco ("drop a 1, 2 or 3") e i commenti sono il segnale di
# ranking che la narrazione pura non attiva mai. Una lista numerata offre
# gratis la stessa meccanica: chiedere QUALE numero ti ha colpito e' una
# domanda a risposta immediata, costa ~2s di video e produce il segnale
# piu' raro dell'ecosistema (zero commenti su quasi tutti i profili).
LIST_COMMENT_CLOSERS = [
    "Comment the number that surprised you most.",
    "Which one are you turning off first? Drop the number in the comments.",
    "Comment the one you didn't know about.",
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
    cta = random.choice(CTA)

    # REACTIONS rimosse dallo script parlato il 2026-08-04, stessa correzione
    # gia' applicata a solofounded-bot (omologazione fra i due generatori).
    #
    # Motivo misurato: @pctweaker10 aveva il watch time mediano piu' basso di
    # tutti gli account (2.9s) sul video piu' lungo di tutti (22.7s), cioe'
    # 13% di completamento - e il watch time e' il segnale di ranking #1.
    # Le reaction sono commento generico che non aggiunge informazione
    # ("And most people never notice.", "That's the real difference.") ma
    # occupa secondi di un video gia' troppo lungo.
    #
    # ATTENZIONE per chi tocchera' questa funzione: item_word_starts contiene
    # gli INDICI DI PAROLA in cui inizia ogni item, e main.py li usa per
    # leggere word_timings[i] e decidere l'istante in cui compare ogni
    # immagine della slideshow. Il contatore word_count deve quindi restare
    # allineato parola per parola con la stringa finale: togliendo un pezzo
    # dallo script va tolto ANCHE il suo word_count += _wc(...), altrimenti
    # le immagini compaiono sfasate rispetto alla voce senza che nulla
    # sollevi un errore.
    parts = [hook]
    item_word_starts = []

    word_count = _wc(hook)
    item_word_starts.append(word_count)
    parts.append(items[0])
    word_count += _wc(items[0])

    for item in items[1:]:
        transition = random.choice(TRANSITIONS)
        parts.append(transition)
        word_count += _wc(transition)

        item_word_starts.append(word_count)
        parts.append(item)
        word_count += _wc(item)

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

    # Chiusura da commento-gioco prima della CTA (vedi LIST_COMMENT_CLOSERS):
    # arriva DOPO l'ultimo item, quindi non tocca item_word_starts - le
    # immagini restano sincronizzate con le voci della lista.
    parts.append(random.choice(LIST_COMMENT_CLOSERS))
    parts.append(cta)
    return " ".join(parts), item_word_starts, intro


if __name__ == "__main__":
    from content import get_random_content_multi

    category, items = get_random_content_multi("mistakewarning")
    print(build_script_template(items, category))
