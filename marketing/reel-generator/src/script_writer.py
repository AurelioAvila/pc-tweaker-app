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

# Reinforced 2026-08-01 after the first real cross-account analysis:
# first-person/direct-consequence hooks (stress test, POV, "you only see the
# difference when it is too late") performed 5-40x better than generic "here is
# a setting" hooks on Groomlyco/Magdock - the same logic applied here, not just
# theory. See feedback_reinforce_winning_hooks in memory for the data.
# Pools widened 2026-08-02 from 4-5 to 10 hooks per category. An audit over 300
# generations counted only 5 distinct ones: ever since the hook became the text
# of the HOOK CARD in the first frame too (see _hook_card_clip in
# src/render.py) it has been the most visible element of the video, so
# repeating every 5 videos costs far more than it used to. The archetypes are
# deliberately different (first person / consequence / POV / concrete number /
# myth to break) rather than variations on one formula: that would be variety
# in appearance only.
# Removed 2026-08-19: three first-person hooks that asserted tests or purchases
# that never happened ("I stress-tested three PC optimizers", "I paid for one
# of these", "I recorded the before and after so you don't have to trust me") -
# the render always shows generic Pexels b-roll, never a real screen recording
# or a real purchase of a competing tool, so those lines were fabricated
# evidence put in the mouth of an AI voice. Exactly the kind of detail a real
# comment ("probably an unsafe vibe coded tool") picks up on: the problem is
# not how technical the content is, it is false first-person testimony.
# Replaced with equivalent claims that do not assert a specific test or
# purchase by the author.
HOOKS = {
    # Note on hook patterns (updated 2026-08-03): 2026 tests across 30 viral
    # hooks put only 4 families above 70 - Identity Call, Contrarian Strike,
    # Open Loop, Confession - with Identity Call first outright (85 average)
    # because it names the audience it is talking to, while generic openings
    # fall below 30. Confession, Contrarian and Open Loop were already here;
    # Identity Call was missing entirely, and is now added to every category.
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
        # Aggiunto 2026-08-23: ricerca sui pattern hook 2026 conferma che
        # citare nome prodotto + versione/anno nel titolo aiuta la ricerca
        # (vidiq.com, scalelab.com) - nessun hook esistente citava una
        # versione/anno specifico, solo "Windows" in generale. Fatto reale
        # dietro l'hook: KB5121003, vedi content pool.
        "Windows 11's August 2026 update changed something on your PC and didn't ask first.",
    ],
    "contrarian": [
        "If you've ever downloaded a 'PC booster', this one's for you.",
        "Windows 11 users: the tool you're about to install matters more than you think.",
        "Three PC optimizers, one thing in common: no undo button.",
        "Don't install a PC optimizer before hearing this.",
        "Most optimizer tools can't do this one thing.",
        "Here's what separates a safe tool from a risky one.",
        "The free tools aren't the problem, the irreversible ones are.",
        "Every 'speed booster' I tested did the same three things.",
        "If a tool can't undo a change, that's not optimization, that's a gamble.",
        "The paid ones aren't any more honest about what they change.",
        "The honest answer is most of these do almost nothing.",
        "Registry cleaners are still being sold in 2026, and here's why that matters.",
        # Added 2026-08-19 alongside the verifiability facts in content.py: a
        # hook that names directly the doubt a real commenter raised ("unsafe
        # vibe coded tool"), instead of continuing to speak only in the
        # abstract about "PC optimizer tools".
        "You'd be right to be skeptical of a random Windows tweak tool, here's how to actually check one.",
    ],
    "beforeafter": [
        "If your PC takes forever to boot, this is for you.",
        "Anyone still gaming on a five-year-old machine: watch this part.",
        "POV: your PC finally runs like it should.",
        "Same PC, one setting flipped, here's the difference.",
        "Here's what one click actually changes.",
        "This is the difference one preset makes.",
        "Same hardware, same games, completely different numbers.",
        "Same PC, same benchmark, one setting different.",
        "Nothing was upgraded here, only switched off.",
        "This took eleven seconds and I wish I'd done it a year ago.",
        "The boot time alone made this worth it.",
        "No new parts, no reinstall, just the defaults corrected.",
        # Added 2026-08-23, same research and reasoning as the equivalent
        # entry under "mistakewarning" above.
        "Windows 11's August 2026 update, one setting, real difference.",
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

# CTAs rewritten 2026-08-06 with the YouTube channel's conversion logic: the
# point of the video is to bring the viewer to the product, so the offer has to
# be CONCRETE and hooked to what the video has just shown ("fixes everything
# you just saw in one click" continues the sentence; "link in bio" on its own
# offers nothing). The save/share variants stay because those are the actions
# ranking weighs most, but they too now say WHAT you get by opening the link.
CTA = [
    "PC Tweaker fixes everything you just saw in one click, and it's free to try. Link in bio.",
    "You could change all of this by hand, or let PC Tweaker do it in one click. Free, link in bio.",
    "Every tweak you just saw is one click in PC Tweaker, and one click to undo. Link in bio.",
    "PC Tweaker shows you exactly what it changes before it touches anything. Free to try, link in bio.",
    "Save this before you forget, then let PC Tweaker do it for you in one click. Link in bio.",
    "Send this to whoever's PC is a mess right now, the one-click fix is in the bio.",
    # Added 2026-08-19: the one CTA that points explicitly at verifiability
    # (source-available and independently listed) rather than repeating "free,
    # link in bio" - a direct answer to the "is it safe?" doubt without
    # repeating it in every single video, where it would weigh as heavily as
    # the other CTAs are light.
    "Don't just trust a random tweak tool, check it yourself, the code is source-available. Link in bio.",
]

# Comment-game closers for the list format (2026-08-06): a lesson taken from
# youtube-bot, where the quiz is the one format in which commenting is part of
# the game ("drop a 1, 2 or 3") and comments are the ranking signal pure
# narration never triggers. A numbered list offers the same mechanic for free:
# asking WHICH number struck you is a question with an immediate answer, costs
# ~2s of video, and produces the rarest signal in the ecosystem (zero comments
# on almost every profile).
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

    # REACTIONS removed from the spoken script on 2026-08-04, the same fix
    # already applied to solofounded-bot (bringing the two generators in line).
    #
    # Measured reason: @pctweaker10 had the lowest median watch time of every
    # account (2.9s) on the longest video of all (22.7s), which is 13%
    # completion - and watch time is the #1 ranking signal. Reactions are
    # generic commentary that adds no information ("And most people never
    # notice.", "That's the real difference.") while eating seconds of a video
    # that is already too long.
    #
    # CAREFUL, for anyone touching this function: item_word_starts holds the
    # WORD INDICES at which each item begins, and main.py uses them to read
    # word_timings[i] and decide the instant each slideshow image appears. The
    # word_count counter therefore has to stay aligned word by word with the
    # final string: removing a piece of the script means removing its
    # word_count += _wc(...) TOO, otherwise the images appear out of sync with
    # the voice and nothing raises an error.
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

    cta_start_word = word_count
    parts.append(cta)
    # The third element is the spoken hook sentence: the render's hook card
    # needs it, and shows it in full in the first frame (see _hook_card_clip in
    # src/render.py). The fourth is the word index at which the CTA begins, so
    # render.py can stop subtitling from there (caption_end_word) without
    # showing the literal text "link in bio".
    return " ".join(parts), item_word_starts, hook, cta_start_word


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

    # Comment-game closer before the CTA (see LIST_COMMENT_CLOSERS): it comes
    # AFTER the last item, so it does not touch item_word_starts - the images
    # stay in sync with the entries of the list.
    closer = random.choice(LIST_COMMENT_CLOSERS)
    parts.append(closer)
    word_count += _wc(closer)
    cta_start_word = word_count
    parts.append(cta)
    return " ".join(parts), item_word_starts, intro, cta_start_word


if __name__ == "__main__":
    from content import get_random_content_multi

    category, items = get_random_content_multi("mistakewarning")
    print(build_script_template(items, category))
