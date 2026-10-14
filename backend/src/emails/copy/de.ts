import type { Copy } from "./index";

/**
 * Deutsch: mit "du", wie die meisten Texte in PC Tweaker und Uninstaller.
 * Bezeichnungen wie in der Oberfläche ("Tarife & Preise" in PC Tweaker,
 * "Tarife und Preise" im Uninstaller).
 */
const named = (lead: string, n: string, end = ".") => (n ? `${lead}, ${n}${end}` : `${lead}${end}`);

export const de: Copy = {
  tag: "de",
  dateLocale: "de-DE",

  shell: {
    writeTo: (address: string) => `Schreib an ${address} oder antworte auf diese E-Mail.`,
    expectation: "Wir lesen alles und antworten in der Regel innerhalb eines Werktags.",
    neverSend: "Schick niemals ein Passwort oder eine Kartennummer per E-Mail.",
    questions: "Fragen?",
    family: "Ein Konto für PC Tweaker, PC Tweaker Uninstaller und Tweaky Driver.",
    support: "Support",
    privacy: "Datenschutz",
    terms: "AGB",
    linkFallback: "Falls sich die Schaltfläche nicht öffnet, kopiere diese Adresse in deinen Browser:",
    ifYou: "Wenn du das warst:",
    ifNot: "Wenn nicht:",
    unsubscribe: "Abmelden",
  },

  plans: { monthly: "Pro, monatlich", annual: "Pro, jährlich", lifetime: "Pro, lebenslang" },

  verify: {
    subject: (b: string) => `Bestätige deine E-Mail-Adresse für ${b}`,
    preheader: "Ein Klick bestätigt diese Adresse. Der Link gilt 24 Stunden.",
    eyebrow: "E-Mail bestätigen",
    headline: (n: string) => named("Nur noch ein Schritt", n),
    intro: (b: string) =>
      `Du hast mit dieser Adresse ein ${b}-Konto erstellt. Bestätige sie, und das Konto ist aktiv. Das Konto nimmt einen Pro-Tarif von einem PC zum nächsten mit, und nur darüber können wir dir später ein neues Passwort zuschicken.`,
    button: "E-Mail bestätigen",
    stepsTitle: "Nach der Bestätigung",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "Geh zurück in den Uninstaller und melde dich im Bereich <strong>Konto</strong> an. Die App prüft das Konto bei der Anmeldung, du musst also nichts von Hand aktualisieren.",
            "Nichts, was du entfernt hast, ändert sich. Einzelne Deinstallationen, die Restesuche und das Entfernungsprotokoll haben nie ein Konto gebraucht.",
            "Der Kauf von Uninstaller Pro öffnet sich erst mit bestätigter Adresse. Ein PC-Tweaker-Tarif auf demselben Konto schaltet den Treuepreis frei.",
          ]
        : [
            "Geh zurück zu PC Tweaker und melde dich über die Schaltfläche <strong>Konto</strong> an. Die App prüft das Konto bei der Anmeldung, du musst also nichts von Hand aktualisieren.",
            "Nichts, was du schon angewendet hast, ändert sich. Free hat nie ein Konto gebraucht: die Free-Einstellungen, der Systemscan und dein Änderungsverlauf bleiben, wie du sie verlassen hast.",
            "Der Kauf von Pro öffnet sich erst mit bestätigter Adresse. Eine Pro-Lizenz wird für das Konto signiert, nicht für den Rechner: Auf einem anderen PC reicht die Anmeldung.",
          ],
    noteHtml: (b: string) =>
      `Der Link gilt 24 Stunden und nur einmal. Ist er abgelaufen, öffne in der App das Kontomenü und wähle <strong>Erneut senden</strong>. Hast du kein ${b}-Konto erstellt, ignoriere diese E-Mail: Ohne den Klick passiert nichts.`,
    helpTitle: "Der Link kommt nicht an, oder doppelt?",
    helpText: "Sieh zuerst im Spamordner nach und nenn uns dann die Adresse, mit der du dich registriert hast.",
    why: (b: string) => `Du erhältst diese E-Mail, weil mit dieser Adresse ein ${b}-Konto erstellt wurde.`,
  },

  welcome: {
    subject: (b: string) => `Dein ${b}-Konto ist bereit`,
    preheader: (u: boolean) =>
      u ? "Drei Dinge, die du zuerst ausprobieren solltest, und was Pro hinzufügt." : "Drei Einstellungen für den Anfang, und wie jede Änderung rückgängig gemacht wird.",
    eyebrow: "Konto bereit",
    headline: (n: string) => named("Du bist dabei", n),
    intro: (u: boolean, free: number) =>
      u
        ? "Deine Adresse ist bestätigt und das Konto ist aktiv. Melde dich im Bereich Konto des Uninstallers an, und alles Folgende gehört dir, ohne etwas zu bezahlen. Hier fängst du am besten an."
        : `Deine Adresse ist bestätigt und das Konto ist aktiv. Melde dich über die Schaltfläche Konto in der App an, und die ${free} Free-Einstellungen, der Systemscan, der Gesundheitswert und der Änderungsverlauf gehören dir, ohne etwas zu bezahlen. Hier fängst du am besten an.`,
    stepsTitle: "Drei Dinge für den Anfang",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "<strong>Installierte Apps.</strong> Jedes Programm auf diesem PC, Microsoft-Store-Apps eingeschlossen, mit Größe und Herausgeber.",
            "<strong>Details, dann Deinstallieren.</strong> Jedes Programm zeigt eine Einschätzung und eine Zusammenfassung der Entfernung, bevor irgendetwas läuft, und bei systemweit installierten Programmen wird zuerst ein Wiederherstellungspunkt versucht.",
            "<strong>Die Restesuche.</strong> Nach einer Deinstallation sucht die App nach Dateien und Registrierungsschlüsseln, die das Programm hinterlassen hat, und das Entfernungsprotokoll hält fest, was entfernt wurde und wie viel Platz frei wurde.",
          ]
        : [
            "<strong>Systemscan, dann Systemanalyse starten.</strong> Prüfungen zu Autostart, Speicher, Arbeitsspeicher, Datenschutz, Leistung und Updates. Empfohlene und optionale Änderungen stehen getrennt, und nichts wird angewendet, bevor du zustimmst. Alles beheben zeigt zuerst die genauen Einstellungen und prüft danach jede einzelne.",
            "<strong>Autostart.</strong> Einträge, die mit Windows starten, jeweils mit dem Herausgeber daneben. Zwei oder drei zu deaktivieren, die du nie nutzt, ist die Änderung, die die meisten beim nächsten Start bemerken, und jeder Eintrag lässt sich einzeln wiederherstellen.",
            "<strong>Profile.</strong> Gaming, Lernen und Arbeit sind in Free enthalten. Öffne eines, lies die Abwägungen auf jeder Karte, entferne die Haken bei dem, was du nicht willst, und wende den Rest mit einem Klick an. Ein Profil fügt seine Einstellungen hinzu, ohne andere Änderungen rückgängig zu machen.",
          ],
    noteHtml: (u: boolean, guideLink: (label: string) => string) =>
      u
        ? "Restebereinigung, Stapelentfernung und das Entfernen defekter Einträge gehören zu Uninstaller Pro. Hat dasselbe Konto einen PC-Tweaker-Tarif, kostet Pro weniger: Der Preis steht unter Tarife und Preise."
        : `Bevor eine Einstellung etwas schreibt, speichert PC Tweaker den vorherigen Wert, und jede Karte hat <strong>Was genau geändert wird</strong>. Stell direkt an der Einstellung wieder her oder öffne den Änderungsverlauf und nutze <strong>Aktive Einstellungen zurücksetzen</strong>. Was die Bereinigung in den Papierkorb legt, lässt sich wiederherstellen, bis du ihn leerst; Treiberupdates, Reparaturen und Hardware-Einstellungen haben eigene Wiederherstellungsschritte. Details: ${guideLink("so machst du Windows-Änderungen rückgängig")}.`,
    button: (b: string) => `${b} öffnen`,
    helpTitle: "Funktioniert etwas nicht wie beschrieben?",
    helpText: "Nenn uns die App-Version und worauf du geklickt hast.",
    why: (b: string) => `Du erhältst diese E-Mail, weil du mit dieser Adresse ein ${b}-Konto bestätigt hast. Sie wird nur einmal gesendet.`,
  },

  reset: {
    subject: (b: string) => `Setze dein ${b}-Passwort zurück`,
    preheader: "Der Link gilt einmal, für eine Stunde. Bis du ihn nutzt, ändert sich nichts.",
    eyebrow: "Passwort zurücksetzen",
    headline: "Wähle ein neues Passwort.",
    intro: (b: string) =>
      `Jemand hat darum gebeten, das Passwort des ${b}-Kontos zu dieser Adresse zurückzusetzen. Warst du das, öffnet die Schaltfläche unten eine Seite, auf der du ein neues festlegst. Bisher hat sich nichts geändert.`,
    button: "Neues Passwort festlegen",
    rows: [
      ["Link gültig", "Eine Stunde, einmal"],
      ["Neues Passwort", "Mindestens 8 Zeichen, bis zu 72 Byte"],
      ["Gilt für", "PC Tweaker, PC Tweaker Uninstaller und Tweaky Driver"],
      ["Nach der Änderung", "Jeder angemeldete PC wird abgemeldet"],
    ],
    after:
      "Sobald das neue Passwort gespeichert ist, melde dich auf jedem PC, auf dem du die Apps nutzt, neu an. Angewendete Einstellungen, Verlauf und ein Pro-Tarif hängen am Konto und am Rechner, nicht am Passwort, daran ändert sich also nichts.",
    note:
      "Nicht angefordert? Ignoriere die E-Mail: Der Link gilt eine Stunde und nur einmal, und dein Passwort bleibt genau, wie es ist. Kommen weiter solche Anfragen, schreib uns, und wir sehen nach, woher sie stammen.",
    helpTitle: "Link abgelaufen, oder die Seite sagt, er sei ungültig?",
    helpTextHtml:
      "Fordere über <strong>Passwort vergessen?</strong> auf dem Anmeldebildschirm einen neuen an und nutze die neueste E-Mail.",
    why: (b: string) => `Du erhältst diese E-Mail, weil für das ${b}-Konto zu dieser Adresse ein Zurücksetzen des Passworts angefordert wurde.`,
  },

  changed: {
    subject: (b: string) => `Dein ${b}-Passwort wurde geändert`,
    preheader: (when: string) => `Geändert am ${when}. Andere angemeldete PCs wurden abgemeldet. Warst du das nicht, lies weiter.`,
    eyebrow: "Sicherheitshinweis",
    headline: (n: string) => named("Dein Passwort wurde geändert", n),
    intro: (b: string, when: string) =>
      `Das Passwort deines ${b}-Kontos wurde am ${when} geändert. Alle angemeldeten Geräte wurden abgemeldet, in PC Tweaker, PC Tweaker Uninstaller und Tweaky Driver.`,
    ifYou: "Melde dich auf jedem PC neu an, dann bist du fertig. Angewendete Einstellungen, Verlauf und Tarif bleiben unverändert.",
    ifNot: "Jemand anderes hat dieses Passwort festgelegt, und das alte funktioniert nicht mehr. Erledige diese drei Dinge in dieser Reihenfolge.",
    stepsTitle: "Wenn du es nicht warst",
    stepsHtml: [
      "Öffne die App, wähle auf dem Anmeldebildschirm <strong>Passwort vergessen?</strong> und fordere ein Zurücksetzen an diese Adresse an. Der Link, den du bekommst, gehört nur dir, und wer ihn nutzt, meldet die andere Person ab.",
      "Wähle ein Passwort, das du nirgendwo sonst verwendest. Hat dieses E-Mail-Postfach dasselbe Passwort wie vorher, ändere es auch dort: Über dieses Konto wäre ein Angreifer gekommen.",
      "Antworte auf diese E-Mail, damit wir das Konto auch von unserer Seite prüfen.",
    ],
    button: "Support kontaktieren",
    noteHtml:
      "Diese E-Mail enthält absichtlich keinen Link, der etwas ändert, und keinen Code: Eine Schaltfläche zum Zurücksetzen in einer &quot;Warst du das?&quot;-Nachricht ist genau das, was eine gefälschte E-Mail anbieten würde. Wir fragen dich nie per E-Mail nach deinem Passwort.",
    helpTitle: "Sollen wir uns das Konto ansehen?",
    helpText: "Sicherheitsmeldungen lesen wir zuerst.",
    expectation: "Du hörst in der Regel innerhalb eines Werktags von uns.",
    why: (b: string) => `Dieser Hinweis wird jedes Mal gesendet, wenn sich das Passwort eines ${b}-Kontos ändert. Er lässt sich nicht abschalten.`,
  },

  emailChange: {
    subject: (b: string) => `Bestätige deine neue E-Mail-Adresse für ${b}`,
    preheader: "Ein Klick zieht dein Konto auf diese Adresse um. Der Link gilt 24 Stunden.",
    eyebrow: "Neue Adresse bestätigen",
    headline: (n: string) => named("Bestätige diese Adresse", n),
    intro:
      "Du hast darum gebeten, das Konto für PC Tweaker, PC Tweaker Uninstaller und Tweaky Driver auf diese Adresse umzuziehen. Bestätige sie, und du meldest dich ab jetzt mit dieser Adresse an; die bisherige funktioniert dann nicht mehr für die Anmeldung.",
    button: "Neue Adresse bestätigen",
    note: "Der Link gilt 24 Stunden und nur einmal. Bis du bestätigst, ändert sich nichts. Nach dem Umzug wird jeder angemeldete PC abgemeldet.",
    helpTitle: "Nicht angefordert?",
    helpText: "Ignoriere diese E-Mail: Das Konto bleibt bei seiner bisherigen Adresse.",
    why: "Du erhältst diese E-Mail, weil sich jemand bei einem PC-Tweaker-Konto angemeldet und darum gebeten hat, es auf diese Adresse umzuziehen.",
  },

  emailChanged: {
    subject: (b: string) => `Die E-Mail-Adresse deines ${b}-Kontos wurde geändert`,
    preheader: (masked: string) => `Das Konto nutzt jetzt ${masked}. Warst du das nicht, lies weiter.`,
    eyebrow: "Sicherheitshinweis",
    headline: (n: string) => named("Die E-Mail-Adresse deines Kontos wurde geändert", n),
    intro: (masked: string, when: string) =>
      `Am ${when} ist das Konto für PC Tweaker, PC Tweaker Uninstaller und Tweaky Driver von dieser Adresse auf ${masked} umgezogen. Jeder angemeldete PC wurde abgemeldet; die Anmeldung läuft jetzt über die neue Adresse.`,
    ifYou: "Sonst ist nichts zu tun. Tarife, Einstellungen und Verlauf sind mit dem Konto umgezogen.",
    ifNot:
      "Jemand, der dein Passwort kannte, hat das Konto umgezogen. Antworte sofort auf diese E-Mail: Wir können es zurückholen und sperren, während wir prüfen. Ändere danach dieses Passwort überall, wo du es benutzt hast.",
    button: "Support kontaktieren",
    note: "Diese E-Mail enthält absichtlich keinen Link, der etwas ändert. Wir fragen dich nie per E-Mail nach deinem Passwort.",
    helpTitle: "Sollen wir uns das Konto ansehen?",
    helpText: "Sicherheitsmeldungen lesen wir zuerst.",
    why: (b: string) => `Dieser Hinweis geht jedes Mal an die bisherige Adresse, wenn sich die E-Mail-Adresse eines ${b}-Kontos ändert. Er lässt sich nicht abschalten.`,
  },

  signIn: {
    subject: (b: string) => `Neue Anmeldung bei deinem ${b}-Konto`,
    preheader: (device: string, when: string) => `Anmeldung auf ${device} am ${when}. Warst du das, ist nichts zu tun.`,
    eyebrow: "Neue Anmeldung",
    aPc: "einem Windows-PC",
    headline: (device: string) => `Neue Anmeldung auf ${device}.`,
    intro: (b: string) =>
      `Bei deinem ${b}-Konto hat sich jemand von einem PC oder Netzwerk angemeldet, das wir bei diesem Konto noch nicht gesehen hatten. Wir senden das einmal pro neuem PC und nur bei Anmeldungen mit dem richtigen Passwort; ein falsches Passwort löst diese E-Mail nie aus.`,
    rows: { device: "PC", when: "Wann", account: "Konto" },
    ifYou: "Nichts zu tun, zum Beispiel bei einem zweiten PC, einer Neuinstallation oder einem neuen Netzwerk. Ein Pro-Tarif folgt dem Konto.",
    ifNotHtml:
      "Ändere sofort dein Passwort über <strong>Passwort vergessen?</strong> auf dem Anmeldebildschirm. Ein neues Passwort meldet alle PCs auf einmal ab, auch diesen. Antworte danach auf diese E-Mail, damit wir uns das Konto ansehen.",
    note:
      "Diese E-Mail enthält absichtlich keinen Link zum Abmelden: Ein Link wie „Konto sichern“ in einer Sicherheitswarnung ist genau die Form, die eine gefälschte Nachricht hätte. Die einzige sichere Aktion ist das Zurücksetzen, das du selbst in der App startest. Wir fragen dich nie per E-Mail nach deinem Passwort.",
    helpTitle: "Nicht sicher, ob du das warst?",
    helpText: "Behandle es so, als wärst du es nicht gewesen, und sag uns Bescheid. Sicherheitsmeldungen lesen wir zuerst.",
    why: (b: string) => `Dieser Hinweis wird gesendet, wenn sich zum ersten Mal ein neuer PC oder ein neues Netzwerk bei einem ${b}-Konto anmeldet. Er lässt sich nicht abschalten.`,
  },

  receipt: {
    subject: (u: boolean, lifetime: boolean) =>
      u
        ? lifetime
          ? "Dein Kauf von PC Tweaker Uninstaller Pro ist bestätigt"
          : "Dein PC Tweaker Uninstaller Pro-Abo ist aktiv"
        : lifetime
          ? "Deine PC Tweaker Pro Lifetime-Lizenz ist aktiv"
          : "Dein PC Tweaker Pro-Abo ist aktiv",
    rows: {
      plan: "Tarif",
      charged: "Abgebucht",
      renewsOn: "Verlängert sich am",
      access: "Zugang",
      neverExpires: "Läuft nie ab",
      renewal: "Verlängerung",
      renewalNone: "Keine. Es wird nichts mehr abgebucht.",
      included: "Enthalten",
      includedValue: "12 Monate PC Tweaker Uninstaller Pro",
      account: "Konto",
      shared: (email: string) => `${email} (gemeinsam mit PC Tweaker)`,
    },
    eyebrowPro: "Pro aktiviert",
    eyebrowLifetime: "Lifetime-Lizenz",
    buttonPct: "PC Tweaker öffnen",
    buttonUn: "Uninstaller öffnen",
    help: {
      title: "Bezahlt, aber noch nicht Pro, oder etwas Unerwartetes abgebucht?",
      text: "Nenn uns die Adresse des Kontos und das Datum auf dem Stripe-Beleg.",
      expectation: "Antworten zu Zahlungen gehen in der Regel innerhalb eines Werktags raus.",
    },
    sub: {
      headline: (n: string) => named("Pro ist auf deinem Konto aktiv", n),
      preheader: (plan: string, price: string, renews: string) =>
        `${plan}, ${price}, verlängert sich am ${renews}. So verwaltest du den Tarif und nutzt Pro auf einem zweiten PC.`,
      intro: (email: string, total: number, free: number, pro: number) =>
        `Stripe hat die Zahlung bestätigt, und die Lizenz für ${email} ist signiert. Alle ${total} Einstellungen stehen jetzt bereit: die ${free}, die du mit Free hattest, plus die ${pro} Pro-Einstellungen, Game Sessions und das Turbo-Gaming-Profil eingeschlossen. Die App aktualisiert ihre Lizenz, wenn du online vom Bezahlen zurückkommst, Pro sollte also schon angezeigt werden.`,
      stepsTitle: "Gut zu wissen ab dem ersten Tag",
      stepsHtml: (who: string, renews: string) => [
        `<strong>Den Tarif verwalten.</strong> Öffne Tarife &amp; Preise in der App. Dort siehst du den Tarif und öffnest das Abrechnungsportal von Stripe, in dem du die Karte änderst oder kündigst. Ein gekündigter Tarif bleibt bis zum ${renews} Pro und wird nicht mehr abgebucht.`,
        `<strong>Ein zweiter PC.</strong> Installiere dort PC Tweaker und melde dich mit ${who} an. Die Lizenz ist für das Konto signiert, nicht für den Rechner, also ist sie auf beiden Pro. Angewendete Einstellungen und der Änderungsverlauf bleiben pro Rechner.`,
        "<strong>Nach einer Windows-Neuinstallation oder neuer Hardware.</strong> Melde dich neu an, und Pro kommt von selbst zurück. Der Änderungsverlauf wird nicht übernommen, wende also lieber ein Profil neu an, statt nach einer Wiederherstellung zu suchen.",
        "<strong>Wo du mit Pro anfängst.</strong> Gaming, dann Game Sessions: Registriere ein Spiel, und die Turbo-Einstellungen schalten sich beim Start ein und beim Beenden wieder zurück.",
      ],
      note: "Stripe schickt Rechnung und Zahlungsbeleg separat von seiner eigenen Adresse; heb sie für deine Unterlagen auf. Zeigt die App nach ein paar Minuten noch Free, melde dich einmal ab und wieder an: Die Lizenz wird bei der Anmeldung neu geladen.",
      why: "Du erhältst diese E-Mail, weil auf dem Konto zu dieser Adresse ein PC Tweaker Pro-Abo abgeschlossen wurde.",
    },
    lifetime: {
      headline: (n: string) => named("Pro, für immer. Danke", n),
      preheader: (price: string) =>
        `Eine Zahlung von ${price}, keine Verlängerung. Mit 12 Monaten Uninstaller Pro, aktiviert bei der ersten Anmeldung.`,
      intro: (email: string, total: number) =>
        `Du hast einmal bezahlt, und das war die letzte Abbuchung für dieses Konto. Die Lifetime-Lizenz für ${email} ist signiert, und alle ${total} Einstellungen, Game Sessions und das Turbo-Gaming-Profil stehen jetzt bereit.`,
      stepsTitle: "Was Lifetime in der Praxis bedeutet",
      stepsHtml: (who: string, uninstallerLink: string) => [
        `<strong>Jeder deiner PCs.</strong> Melde dich mit ${who} auf einem beliebigen PC mit Windows 10 oder 11 an, und er ist Pro. Keine Aktivierungen zu zählen, kein Lizenzschlüssel einzutippen: Der Schlüssel ist das Konto.`,
        `<strong>Ein Jahr Uninstaller Pro.</strong> Installiere PC Tweaker Uninstaller von ${uninstallerLink} und melde dich mit demselben Konto an. Die 12 Monate beginnen mit deiner ersten Anmeldung dort, nicht heute. Es ist ein separater, befristeter Vorteil, keine Lifetime-Lizenz für den Uninstaller.`,
        "<strong>Neuinstallation und neue Hardware.</strong> Nichts zu übertragen. Nach einem frischen Windows installierst du PC Tweaker, meldest dich an, und Pro ist zurück. Der Änderungsverlauf gehört zur alten Installation, starte also lieber mit einem Profil, statt auf die alten Einstellungen zu warten.",
        "<strong>Updates.</strong> PC Tweaker sucht selbst nach Updates, und Lifetime umfasst jedes Update von PC Tweaker Pro.",
      ],
      note: "Stripe schickt die Rechnung separat. Siehst du nach diesem Kauf jemals eine monatliche Abbuchung von uns, schreib uns sofort: Ein Lifetime-Konto darf nie wieder belastet werden, und wir bringen das in Ordnung.",
      why: "Du erhältst diese E-Mail, weil auf dem Konto zu dieser Adresse eine PC Tweaker Pro Lifetime-Lizenz gekauft wurde.",
    },
    un: {
      headline: (n: string) => named("Pro ist aktiv", n, ". Jetzt kannst du auch die Reste entfernen."),
      preheader: (plan: string, price: string, renews: string | null) =>
        `${plan}, ${price}, ${renews ? `verlängert sich am ${renews}` : "keine Verlängerung"}. Restebereinigung, Stapelentfernung und defekte Einträge sind freigeschaltet.`,
      intro: (email: string) =>
        `Stripe hat die Zahlung bestätigt, und die Uninstaller Pro-Lizenz für ${email} ist signiert. In der App ändern sich drei Dinge: Die Restesuche kann jetzt bereinigen, was sie findet, mehrere Programme lassen sich in eine Warteschlange stellen und in einem Durchgang entfernen, und auch Einträge, deren eigenes Deinstallationsprogramm fehlt, lassen sich entfernen. Alles, was du mit Free hattest, einschließlich Einschätzung und Entfernungsprotokoll, bleibt genau, wie es war.`,
      stepsTitle: "Eine erste saubere Entfernung mit Pro",
      stepsHtml: (lifetime: boolean, who: string, renews: string) => [
        "Wähle ein als <strong>Sicher</strong> eingestuftes Programm und lies die Zusammenfassung der Entfernung: den genauen Befehl, ob Windows Installer oder das programmeigene Deinstallationsprogramm läuft, die angeforderten Berechtigungen und die angegebene Größe. Nichts läuft, bevor du bestätigst.",
        "Nach der Deinstallation listet die Restesuche Ordner, Verknüpfungen und Registrierungsschlüssel auf, die das Programm hinterlassen hat. Mit Pro entfernst du sie direkt im selben Fenster. Dateien landen im Papierkorb, ein Fehlgriff lässt sich also wiederherstellen, bis du ihn leerst; Registrierungswerte bleiben im Entfernungsprotokoll.",
        "Für ein größeres Aufräumen markierst du mehrere Programme und startest einen Stapel. Geschützte Programme kommen nie in einen Stapel, die Prüfung zugehöriger Programme warnt weiterhin, bevor ein Hauptprogramm seine Plug-ins mitnimmt, und vor Entfernungen mit erhöhten Rechten wird ein Wiederherstellungspunkt versucht und das Ergebnis protokolliert.",
        ...(lifetime
          ? []
          : [
              `<strong>Den Tarif verwalten.</strong> Tarife und Preise in der oberen Leiste zeigt Konto und Tarif und öffnet das Abrechnungsportal von Stripe für Karte, Laufzeit oder Kündigung. Ein gekündigter Tarif bleibt bis zum ${renews} Pro. Meldest du dich mit ${who} auf einem anderen PC an, ist er dort ebenfalls Pro.`,
            ]),
      ],
      note: (lifetime: boolean) =>
        `${lifetime ? "Dieser Kauf verlängert sich nicht. " : ""}Ein Konto, zwei Lizenzen: Eine PC Tweaker Pro-Lizenz schaltet den Uninstaller nicht frei und diese nicht PC Tweaker; jede App prüft ihre eigene. Stripe schickt die Rechnung separat. Zeigt der Uninstaller nach ein paar Minuten noch Free, melde dich über Tarife und Preise einmal ab und wieder an.`,
      help: {
        title: "Bezahlt, aber noch nicht Pro, oder eine Entfernung, die anders lief als in der Zusammenfassung?",
        text: "Nenn uns die App-Version und den Eintrag im Entfernungsprotokoll (als CSV exportierbar).",
        expectation: "Wir antworten in der Regel innerhalb eines Werktags.",
      },
      why: (lifetime: boolean) =>
        lifetime
          ? "Du erhältst diese E-Mail, weil auf dem PC-Tweaker-Konto zu dieser Adresse PC Tweaker Uninstaller Pro gekauft wurde."
          : "Du erhältst diese E-Mail, weil auf dem PC-Tweaker-Konto zu dieser Adresse ein Uninstaller Pro-Abo abgeschlossen wurde.",
    },
  },

  reversal: {
    subject: (u: boolean) =>
      u ? "Deine Zahlung für PC Tweaker Uninstaller Pro wurde zurückgebucht" : "Deine Zahlung für PC Tweaker Pro wurde zurückgebucht",
    eyebrow: "Zahlung zurückgebucht",
    headline: (n: string) => named("Deine Zahlung wurde zurückgebucht", n),
    rows: {
      amount: "Zurückgebuchter Betrag",
      plan: "Tarif",
      proAccess: "Pro-Zugang",
      ended: "Beendet",
      account: "Dein Konto",
      accountValue: "Offen, mit Free",
      unPro: "Uninstaller Pro",
      unFree: "Bleibt dir mit Free",
      unFreeValue: "Einzelne Deinstallationen, Einschätzung, Zusammenfassung der Entfernung, Restesuche, Entfernungsprotokoll",
    },
    pct: {
      lead: (amount: string | null) =>
        `${amount ? `Deine Zahlung von ${amount}` : "Deine Zahlung"} für PC Tweaker Pro wurde von deinem Zahlungsanbieter zurückgebucht.`,
      preheaderTail: "Der Pro-Zugang ist beendet; die kostenlosen Funktionen laufen weiter.",
      introTail:
        "Stripe hat uns informiert, und der Pro-Zugang aus dieser Zahlung ist auf deinem Konto beendet. Diese E-Mail hält fest, was sich geändert hat; sie fordert nichts von dir.",
      ended: "Der Pro-Zugang aus dieser Zahlung ist beendet. Dein Konto und die kostenlosen Funktionen laufen weiter.",
      endedTail: "Die App wechselt bei der nächsten Lizenzprüfung zu Free, meist beim nächsten Start oder bei der nächsten Anmeldung.",
      stopRenewal: "Ist das Abo selbst noch aktiv, kündige es unter Tarife & Preise, damit es sich nicht verlängert.",
      oneOff: "Das war ein einmaliger Kauf, es gibt also kein Abo zu kündigen.",
      mistake: "Hältst du das für einen Fehler, antworte auf diese E-Mail, und wir gehen die Stripe-Daten mit dir durch.",
    },
    un: {
      preheader: (amount: string | null) =>
        `${amount ?? "Deine Zahlung"} wurde von deinem Zahlungsanbieter zurückgebucht. Pro ist beendet; einzelne Deinstallationen, die Zusammenfassung der Entfernung und das Entfernungsprotokoll laufen weiter.`,
      intro: (amount: string | null) =>
        `Dein Zahlungsanbieter hat ${amount ? `die Zahlung von ${amount}` : "deine Zahlung"} für PC Tweaker Uninstaller Pro zurückgebucht, und Stripe hat uns informiert. Der Pro-Zugang aus dieser Zahlung ist beendet. Dein Konto bleibt offen, ebenso der PC-Tweaker-Teil: Diese Rückbuchung betrifft nur den Uninstaller.`,
      stops:
        "Was endet: Restebereinigung, Stapelentfernung und das Entfernen defekter Einträge. Was bleibt: Bereits Entferntes bleibt entfernt, das Entfernungsprotokoll behält jeden Beleg, und Dateien im Papierkorb bleiben dort, bis du ihn leerst.",
      stopRenewal:
        "Wird das Abo bei Stripe noch als aktiv geführt, kündige es unter Tarife und Preise in der oberen Leiste, damit keine weitere Abbuchung versucht wird.",
      oneOff: "Das war ein einmaliger Zugang, es gibt also nichts zu kündigen.",
      origin:
        "Diese Rückbuchung kam von deiner Bank oder deinem Kartenaussteller, nicht von uns. Hast du sie nicht bei deiner Bank veranlasst, antworte mit Datum und Betrag aus deinem Kontoauszug, und wir gehen die Stripe-Daten mit dir durch.",
    },
    helpTitle: "Fragen zu dieser Rückbuchung?",
    helpText: "Nenn uns Datum und Betrag aus deinem Kontoauszug.",
    why: (u: boolean) =>
      u
        ? "Du erhältst diese E-Mail, weil eine Zahlung für Uninstaller Pro auf dem PC-Tweaker-Konto zu dieser Adresse zurückgebucht wurde."
        : "Du erhältst diese E-Mail, weil eine Zahlung für PC Tweaker Pro auf dem Konto zu dieser Adresse zurückgebucht wurde.",
  },

  ending: {
    subject: (b: string, ends: string) => `Dein ${b} Pro-Tarif endet am ${ends}`,
    preheader: (ends: string) => `Pro bleibt bis zum ${ends} aktiv, danach wechselt das Konto zu Free. Gelöscht wird nichts.`,
    eyebrow: "Tarif endet",
    headline: (n: string, ends: string) => named(`Pro läuft bis zum ${ends}`, n),
    intro: (b: string, failed: boolean, ends: string) =>
      failed
        ? `Stripe konnte die Verlängerung deines ${b} Pro-Abos nicht einziehen. Pro läuft weiter, während Stripe die Zahlung erneut versucht; kann sie bis zum ${ends} nicht eingezogen werden, wechselt das Konto zu Free.`
        : `Dein ${b} Pro-Abo wurde wie gewünscht gekündigt. Es wird nichts mehr abgebucht. Alles von Pro funktioniert bis zum Ende des bereits bezahlten Zeitraums, danach wechselt das Konto zu Free.`,
    rows: { plan: "Tarif", until: "Pro bis", next: "Nächste Abbuchung", nextValue: "Keine", after: "Danach" },
    afterValue: (u: boolean, free: number) =>
      u ? "Free: einzelne Deinstallationen, Restesuche, Entfernungsprotokoll" : `Free: ${free} Einstellungen, Systemscan, Gesundheitswert, Änderungsverlauf`,
    stepsTitle: (ends: string) => `Vor dem ${ends}`,
    steps: (u: boolean, failed: boolean) => [
      u
        ? "Restebereinigung und Stapelentfernung enden, wenn Pro endet. Bereits Entferntes bleibt entfernt, und das Entfernungsprotokoll behält jeden Beleg."
        : "Mit Pro-Einstellungen angewendete Werte werden beim Ende von Pro nicht zurückgesetzt; Windows behält sie. Willst du einige wieder auf Standard setzen, mach das jetzt an der Karte der Einstellung oder im Änderungsverlauf, wo die Wiederherstellung auch mit Free funktioniert.",
      u
        ? "Dateien, die eine Pro-Bereinigung in den Papierkorb gelegt hat, bleiben dort, bis du ihn leerst, mit oder ohne Pro."
        : "Wenn Pro endet, schaltet Game Sessions die Turbo-Einstellungen beim Spielstart nicht mehr ein. Von einer bereits beendeten Sitzung bleibt nichts angewendet, weil jede Sitzung beim Beenden zurückgesetzt wird.",
      failed
        ? "Aktualisiere die Karte über Tarife & Preise und dann Abo verwalten. Stripe versucht die Verlängerung selbst erneut; sobald es klappt, läuft Pro ohne Unterbrechung weiter."
        : "Doch anders entschieden? Öffne Tarife & Preise und dann Abo verwalten: Bis zum Enddatum lässt Stripe dich denselben Tarif ohne neuen Bezahlvorgang fortsetzen.",
    ],
    button: (b: string) => `${b} öffnen`,
    note: "Wenn Pro endet, wird nichts gelöscht: Das Konto, sein Verlauf und jede angewendete Einstellung bleiben genau, wo sie sind. Stripe schickt separat einen eigenen Hinweis zum Abo.",
    helpTitle: "Nicht gekündigt, oder das Datum stimmt nicht?",
    helpText: "Sag uns Bescheid, und wir prüfen die Stripe-Daten mit dir.",
    why: (b: string) => `Du erhältst diese E-Mail, weil sich der Status des ${b} Pro-Abos auf dem Konto zu dieser Adresse geändert hat.`,
  },

  bonus: {
    subject: "Deine 12 Monate Uninstaller Pro haben begonnen",
    preheader: (ends: string) => `In deiner PC Tweaker Lifetime-Lizenz enthalten, aktiv bis zum ${ends}. Nichts zu bezahlen, nichts zu kündigen.`,
    eyebrow: "Lifetime-Vorteil",
    headline: (n: string) => named("Dein Jahr Uninstaller Pro hat heute begonnen", n),
    intro: (ends: string) =>
      `Du hast dich bei PC Tweaker Uninstaller mit dem Konto angemeldet, das deine PC Tweaker Lifetime-Lizenz hat, und genau diese erste Anmeldung startet die enthaltenen 12 Monate Uninstaller Pro. Es wurde keine Karte belastet, und dahinter steht kein Abo; es läuft bis zum ${ends} und endet dann einfach.`,
    rows: {
      entitlement: "Berechtigung",
      entitlementValue: "Uninstaller Pro, 12-monatiger Lifetime-Vorteil",
      started: "Begonnen",
      ends: "Endet",
      charged: "Abgebucht",
      chargedValue: "Nichts. Keine Verlängerung.",
    },
    stepsTitle: "Was Pro dir für das Jahr bringt",
    stepsHtml: [
      "<strong>Restebereinigung.</strong> Die Suche nach jeder Deinstallation hat schon aufgelistet, was übrig blieb; jetzt entfernst du diese Ordner, Verknüpfungen und Registrierungsschlüssel direkt im selben Fenster. Dateien landen im Papierkorb, Registrierungswerte bleiben im Entfernungsprotokoll.",
      "<strong>Stapelentfernung.</strong> Markiere mehrere Programme und lass sie in sicherer Reihenfolge entfernen. Geschützte Programme sind ausgenommen, und vor Entfernungen mit erhöhten Rechten wird zuerst ein Wiederherstellungspunkt versucht.",
      "<strong>Defekte Einträge.</strong> Programme, deren eigenes Deinstallationsprogramm fehlt und die sonst für immer in der Liste stehen, lassen sich entfernen.",
    ],
    button: "Uninstaller öffnen",
    note: (ends: string) =>
      `Wenn das Jahr endet, wechselt der Uninstaller von selbst zu Free: Einzelne Deinstallationen, Einschätzung, Restesuche und Entfernungsprotokoll bleiben, und nichts bereits Entferntes kommt zurück. Deine PC Tweaker Lifetime-Lizenz bleibt davon unberührt. Willst du Pro über den ${ends} hinaus, startet ein kostenpflichtiger Uninstaller-Tarif unter Tarife und Preise; eine automatische Umstellung gibt es nicht.`,
    helpTitle: "Pro wird im Uninstaller nicht angezeigt?",
    helpText: "Melde dich einmal ab und wieder an; jede App lädt bei der Anmeldung ihre eigene Lizenz.",
    why: "Du erhältst diese E-Mail, weil auf dem PC-Tweaker-Konto zu dieser Adresse der Lifetime-Vorteil aktiviert wurde. Sie wird nur einmal gesendet.",
  },

  reminder: {
    subject: "Dein PC Tweaker Lifetime-Kauf",
    preheader: "Der Bezahlvorgang wurde vor der Zahlung geschlossen, es wurde also nichts abgebucht. Das ist die einzige Erinnerung.",
    eyebrow: "Kauf nicht abgeschlossen",
    headline: (n: string) => named("Es wurde nichts abgebucht", n),
    intro:
      "Du hast einen Lifetime-Kauf für PC Tweaker Pro geöffnet, und die Stripe-Seite wurde geschlossen, bevor eine Zahlung durchging. Es wurde keine Karte belastet, und dein Konto ist genau wie vorher. Falls dich etwas aufgehalten hat: Das fragen die meisten, bevor sie sich entscheiden.",
    rows: (total: number) => [
      ["Lifetime", "Eine Zahlung. Nie eine Verlängerung."],
      ["Umfasst", `Alle ${total} Einstellungen, Game Sessions, jedes Update`],
      ["PCs", "Jeder PC, auf dem du dich mit diesem Konto anmeldest"],
      ["Außerdem enthalten", "12 Monate PC Tweaker Uninstaller Pro"],
    ],
    button: "PC Tweaker öffnen",
    retry:
      "Für einen neuen Versuch öffne Tarife & Preise in der App und wähle Lifetime. Der Kauf braucht eine bestätigte E-Mail-Adresse; ist die Schaltfläche ausgegraut, liegt es daran, und Erneut senden im Kontomenü behebt das. Der aktuelle Preis steht auf der Tarifkarte und auf der Stripe-Seite.",
    doubts:
      "Wurde eine Zahlungsart abgelehnt, zeigt Stripe den Grund auf seiner Seite; eine andere Karte oder eine digitale Geldbörse funktioniert meist. Und wenn du dich dagegen entschieden hast, ist das völlig in Ordnung: Free bleibt Free, und das ist die einzige Erinnerung zu diesem Kauf.",
    helpTitle: "Eine Frage, bevor du dich entscheidest?",
    helpText: "Ein echter Mensch antwortet.",
    why: "Du erhältst diese E-Mail, weil vom PC-Tweaker-Konto zu dieser Adresse ein Lifetime-Kauf begonnen und nicht abgeschlossen wurde. Nur eine Erinnerung.",
    unsubscribe: "Keine solchen E-Mails mehr erhalten.",
  },

  supportAck: {
    subject: "Wir haben deine PC Tweaker-Supportanfrage erhalten",
    preheader: "Deine Nachricht ist in der Warteschlange. Antworte auf diese E-Mail, um ein Detail oder einen Screenshot zu ergänzen.",
    eyebrow: "Supportanfrage erhalten",
    headline: (n: string) => (n ? `Angekommen, ${n}. Sie ist in der Warteschlange.` : "Angekommen. Sie ist in der Warteschlange."),
    intro:
      "Deine Nachricht ist im Support-Postfach von PC Tweaker angekommen. Ein Mensch liest sie, kein Bot, und die Antwort kommt an diese Adresse. Die meisten Antworten gehen innerhalb eines Werktags raus; was wir erst nachstellen müssen, kann etwas länger dauern, und das sagen wir dir dann.",
    replyTo: "Wir antworten an",
    stepsTitle: "Was die Antwort beschleunigt",
    steps: [
      "Antworte auf diese E-Mail mit allem, was du vergessen hast: der App-Version, deiner Windows-Version und der genauen Einstellung oder dem Scan, den du genutzt hast. Ein einziger Verlauf hält alles zusammen.",
      "Verhält sich eine Einstellung seltsam, öffne den Änderungsverlauf und sag uns, was im Eintrag steht. Jede angewendete Einstellung steht dort mit dem gesetzten und dem ersetzten Wert, was meist schon die ganze Diagnose ist.",
      "Screenshots helfen; mach vorher alles Persönliche unkenntlich. Schick nie ein Passwort, ein Lizenztoken oder Kartendaten, und falls es je so aussieht, als würden wir danach fragen, ist die Nachricht nicht von uns.",
    ],
    wait: "Während du wartest: Muss eine Änderung sofort rückgängig gemacht werden, setzt Aktive Einstellungen zurücksetzen im Änderungsverlauf jede aufgezeichnete Einstellung zurück, ohne auf uns zu warten.",
    guide: (link: string) => `Die ${link} deckt die Fälle ab, die es nicht erreicht.`,
    guideLabel: "Anleitung zum Rückgängigmachen",
    notYouTitle: "Du hast uns nicht geschrieben?",
    notYou:
      "Jemand hat diese Adresse ins Supportformular eingetragen. Du kannst diese E-Mail ignorieren; über das Formular ändert sich an keinem Konto etwas. Passiert das öfter, sag uns Bescheid, und wir sperren die Quelle.",
    why: "Du erhältst diese E-Mail, weil von dieser Adresse eine Supportanfrage an PC Tweaker gesendet wurde.",
  },

  pages: {
    error: "Fehler",
    unavailable: "Dieser Dienst ist gerade nicht verfügbar.",
    missingToken: "Dieser Link ist unvollständig. Öffne ihn direkt aus der E-Mail.",
    verifiedTitle: "E-Mail bestätigt",
    verified: (b: string) => `Deine E-Mail-Adresse ist bestätigt. Du kannst dieses Fenster schließen und zu ${b} zurückkehren.`,
    alreadyVerified: (b: string) => `Deine E-Mail-Adresse ist bereits bestätigt. Du kannst dieses Fenster schließen und zu ${b} zurückkehren.`,
    expiredTitle: "Link abgelaufen",
    verifyExpired: "Dieser Bestätigungslink ist ungültig oder abgelaufen. Fordere in der App einen neuen an.",
    failed: "Etwas ist schiefgelaufen. Versuch es später noch einmal.",
    resetTitle: "Wähle ein neues Passwort",
    resetLead:
      "Nimm eines, das du nirgendwo sonst verwendest. Es gilt für PC Tweaker, PC Tweaker Uninstaller und Tweaky Driver, und du wirst auf deinen anderen Geräten abgemeldet.",
    newPassword: "Neues Passwort",
    newPasswordPlaceholder: "Mindestens 8 Zeichen",
    passwordHint: "Verwende mindestens 8 Zeichen und höchstens 72 Byte UTF-8. Umlaute und Emojis können mehrere Byte belegen.",
    confirmPassword: "Passwort bestätigen",
    confirmPlaceholder: "Noch einmal eingeben",
    update: "Passwort aktualisieren",
    resetHint: "Dieser Link gilt nur einmal und läuft eine Stunde nach dem Versand ab.",
    notValidTitle: "Link ungültig",
    notValidLead: "Diese Seite braucht den Link aus deiner E-Mail zum Zurücksetzen. Öffne diesen Link direkt, statt die Seite neu zu laden.",
    passwordRule: "Das Passwort muss mindestens 8 Zeichen und höchstens 72 Byte UTF-8 haben.",
    mismatch: "Die beiden Passwörter stimmen nicht überein.",
    resetInvalid: "Dieser Link zum Zurücksetzen ist ungültig, wurde schon benutzt oder ist abgelaufen.",
    resetFailed: "Das Passwort konnte nicht zurückgesetzt werden. Bitte versuch es noch einmal.",
    updatedTitle: "Passwort aktualisiert",
    updated: (b: string) => `Erledigt. Geh zurück zu ${b} und melde dich mit deinem neuen Passwort an.`,
    closeHint: "Du kannst dieses Fenster schließen.",
    emailChangedTitle: "E-Mail-Adresse geändert",
    emailChanged: (b: string, email: string) => `Dein Konto nutzt jetzt ${email}. Geh zurück zu ${b} und melde dich damit an.`,
    emailChangeInvalid: "Dieser Link ist ungültig, wurde schon benutzt oder ist abgelaufen. Fordere die Änderung in der App erneut an.",
    emailTaken: "Diese Adresse wird bereits von einem anderen Konto verwendet. Es wurde nichts geändert.",
  },

  checkout: {
    paidTitle: "Zahlung abgeschlossen",
    paidBody: (app: string) =>
      `Pro ist jetzt in deinem Konto aktiv. Wechsle zurück zu ${app}: Der neue Tarif wird bei der nächsten Lizenzprüfung automatisch übernommen.`,
    trialTitle: "Deine kostenlose Testphase hat begonnen",
    trialBody: (app: string, days: number) =>
      `Heute wurde nichts abgebucht, und Pro ist ${days} Tage lang in deinem Konto aktiv. Am Ende der Testphase wird die erste Zahlung automatisch abgebucht, außer du kündigst vorher unter Tarife und Preise in ${app}. Wir schreiben dir am Tag davor.`,
    cancelTitle: "Bezahlvorgang abgebrochen",
    cancelBody: "Es wurde nichts abgebucht. Du kannst den Bezahlvorgang jederzeit erneut aus der App starten.",
    tipTitle: "Danke für deine Unterstützung",
    tipBody: "Dein Trinkgeld fließt direkt in neue Funktionen und die täglichen Updates von PC Tweaker. Stripe schickt dir die Quittung per E-Mail.",
    notedTitle: "Danke für deine Antwort",
    notedBody: "So wissen wir, wo wir weiter posten sollten. Wechsle zurück zur App: Dein neuer Tarif wird automatisch übernommen.",
    ask: "Optional: Wie bist du auf PC Tweaker gestoßen?",
    sources: {
      youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook",
      search: "Suchmaschine", friend: "Über Freunde", other: "Woanders",
    } as Record<string, string>,
    close: "Du kannst diesen Tab schließen.",
  },
};
