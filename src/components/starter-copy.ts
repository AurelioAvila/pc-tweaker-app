import type { Lang } from "../i18n";
const en = {
  heading: "Start with your day",
  intro: "Choose a setup, adjust the selection, then apply it in one click.",
  gaming: "Gaming",
  study: "Study",
  work: "Work",
  gamingBody: "Consistent Windows pointer movement and control over Game DVR recording.",
  studyBody: "Fewer Windows suggestions, survey prompts and taskbar distractions.",
  workBody: "Visible file extensions, faster menu opening and no startup app delay.",
  gamingNote:
    "Game DVR capture is turned off. Mouse acceleration changes also affect the desktop; games using raw input may ignore them. The optional Sticky Keys setting disables its keyboard shortcut.",
  studyNote:
    "Widgets disappear from the taskbar. This does not mute messages or block websites. Some changes may need a sign-out to appear.",
  workNote:
    "Menus open without their usual delay. Startup apps may launch together after sign-in. File extensions become visible; hidden files are optional.",
  apply: "Apply selected",
  applying: "Applying…",
  active: "Already applied",
  optional: "Optional",
  notice:
    "Adds your selected tweaks. Other settings stay as they are. Restore individual changes from their category or Change history. This is not an exclusive mode switch.",
  empty: "Select a change to apply.",
  ready: "All selected tweaks are already applied.",
  missing: "Some options are unavailable in this build.",
  free: "Included in Free",
};
type Copy = typeof en;
export const STARTER_COPY: Record<Lang, Copy> = {
  en,
  it: {
    ...en,
    heading: "Parti da ciò che fai",
    intro: "Scegli un profilo, modifica la selezione e applicalo con un clic.",
    gaming: "Gaming",
    study: "Studio",
    work: "Lavoro",
    gamingBody: "Movimento del puntatore coerente e controllo della registrazione Game DVR.",
    studyBody:
      "Meno suggerimenti di Windows, sondaggi e distrazioni nella barra delle applicazioni.",
    workBody: "Estensioni visibili, menu immediati e nessuna attesa per le app all’avvio.",
    gamingNote:
      "Disattiva la registrazione Game DVR. L’accelerazione del mouse cambia anche sul desktop; i giochi con input diretto possono ignorarla. L’opzione Tasti permanenti disattiva la sua scorciatoia.",
    studyNote:
      "I widget scompaiono dalla barra. Non silenzia i messaggi e non blocca i siti. Alcune modifiche possono richiedere di uscire e rientrare nell’account Windows.",
    workNote:
      "I menu si aprono senza attesa. Le app possono avviarsi insieme dopo l’accesso. Le estensioni diventano visibili; i file nascosti sono facoltativi.",
    apply: "Applica selezionati",
    applying: "Applicazione…",
    active: "Già applicato",
    optional: "Facoltativo",
    notice:
      "Aggiunge i tweak selezionati e conserva le altre impostazioni. Ripristina le singole modifiche dalla categoria o dalla cronologia. Non sostituisce integralmente il profilo precedente.",
    empty: "Seleziona una modifica da applicare.",
    ready: "Tutti i tweak selezionati sono già applicati.",
    missing: "Alcune opzioni non sono disponibili in questa versione.",
    free: "Incluso in Free",
  },
  fr: {
    ...en,
    heading: "Un profil pour votre journée",
    intro: "Choisissez un profil, ajustez les options et appliquez-les en un clic.",
    gaming: "Jeu",
    study: "Études",
    work: "Travail",
    gamingBody: "Un pointeur Windows constant et le contrôle de l’enregistrement Game DVR.",
    studyBody: "Moins de suggestions Windows, de sondages et de distractions.",
    workBody: "Extensions visibles, menus immédiats et applications sans délai au démarrage.",
    gamingNote:
      "Désactive Game DVR. La souris change aussi sur le bureau ; les jeux avec entrée brute peuvent ignorer ce réglage. L’option Touches rémanentes désactive son raccourci.",
    studyNote:
      "Masque les widgets de la barre. Ne coupe pas les messages et ne bloque pas les sites. Certaines modifications peuvent nécessiter une déconnexion.",
    workNote:
      "Les menus s’ouvrent sans délai. Les applications peuvent démarrer ensemble. Les extensions sont visibles ; les fichiers cachés sont facultatifs.",
    apply: "Appliquer la sélection",
    applying: "Application…",
    active: "Déjà appliqué",
    optional: "Facultatif",
    notice:
      "Ajoute les réglages sélectionnés et conserve les autres. Restaurez-les depuis leur catégorie ou l’historique. Ce n’est pas un changement de mode exclusif.",
    empty: "Sélectionnez un réglage.",
    ready: "Tous les réglages sélectionnés sont appliqués.",
    missing: "Certaines options sont indisponibles dans cette version.",
    free: "Inclus dans Free",
  },
  es: {
    ...en,
    heading: "Un perfil para tu día",
    intro: "Elige un perfil, ajusta las opciones y aplícalas con un clic.",
    gaming: "Gaming",
    study: "Estudio",
    work: "Trabajo",
    gamingBody: "Movimiento constante del puntero y control de la grabación Game DVR.",
    studyBody: "Menos sugerencias de Windows, encuestas y distracciones.",
    workBody: "Extensiones visibles, menús inmediatos y aplicaciones sin demora al iniciar.",
    gamingNote:
      "Desactiva Game DVR. El ratón también cambia en el escritorio; los juegos con entrada directa pueden ignorarlo. La opción Teclas especiales desactiva su atajo.",
    studyNote:
      "Oculta los widgets de la barra. No silencia mensajes ni bloquea sitios. Algunos cambios pueden requerir cerrar sesión.",
    workNote:
      "Los menús se abren sin demora. Las aplicaciones pueden iniciarse juntas. Las extensiones quedan visibles; los archivos ocultos son opcionales.",
    apply: "Aplicar selección",
    applying: "Aplicando…",
    active: "Ya aplicado",
    optional: "Opcional",
    notice:
      "Añade los ajustes seleccionados y conserva los demás. Restáuralos desde su categoría o el historial. No sustituye todo el modo anterior.",
    empty: "Selecciona un cambio.",
    ready: "Todos los ajustes seleccionados están aplicados.",
    missing: "Algunas opciones no están disponibles en esta versión.",
    free: "Incluido en Free",
  },
  de: {
    ...en,
    heading: "Ein Profil für deinen Alltag",
    intro: "Profil wählen, Auswahl anpassen und mit einem Klick anwenden.",
    gaming: "Gaming",
    study: "Lernen",
    work: "Arbeit",
    gamingBody: "Gleichmäßige Windows-Zeigerbewegung und Kontrolle über Game-DVR-Aufnahmen.",
    studyBody: "Weniger Windows-Vorschläge, Umfragen und Ablenkungen.",
    workBody: "Sichtbare Dateiendungen, direkte Menüs und Autostart ohne Verzögerung.",
    gamingNote:
      "Deaktiviert Game DVR. Die Maus ändert sich auch auf dem Desktop; Spiele mit Raw Input können dies ignorieren. Die optionale Einrastfunktion-Einstellung deaktiviert deren Tastenkürzel.",
    studyNote:
      "Blendet Widgets in der Taskleiste aus. Schaltet Nachrichten nicht stumm und blockiert keine Websites. Einige Änderungen erfordern eine erneute Anmeldung.",
    workNote:
      "Menüs öffnen ohne Verzögerung. Autostart-Apps können gleichzeitig starten. Dateiendungen werden sichtbar; versteckte Dateien sind optional.",
    apply: "Auswahl anwenden",
    applying: "Wird angewendet…",
    active: "Bereits angewendet",
    optional: "Optional",
    notice:
      "Aktiviert die gewählten Einstellungen und behält andere bei. Einzelne Änderungen lassen sich in der Kategorie oder im Verlauf zurücksetzen. Kein exklusiver Moduswechsel.",
    empty: "Wähle eine Änderung.",
    ready: "Alle gewählten Einstellungen sind bereits aktiv.",
    missing: "Einige Optionen fehlen in dieser Version.",
    free: "In Free enthalten",
  },
  pt: {
    ...en,
    heading: "Um perfil para o seu dia",
    intro: "Escolha um perfil, ajuste as opções e aplique com um clique.",
    gaming: "Gaming",
    study: "Estudo",
    work: "Trabalho",
    gamingBody: "Movimento consistente do ponteiro e controlo da gravação Game DVR.",
    studyBody: "Menos sugestões do Windows, questionários e distrações.",
    workBody: "Extensões visíveis, menus imediatos e aplicações sem atraso no arranque.",
    gamingNote:
      "Desativa o Game DVR. O rato também muda no ambiente de trabalho; jogos com entrada direta podem ignorar o ajuste. A opção de teclas presas desativa o respetivo atalho.",
    studyNote:
      "Oculta os widgets da barra. Não silencia mensagens nem bloqueia sites. Algumas alterações podem exigir terminar a sessão.",
    workNote:
      "Os menus abrem sem atraso. As aplicações podem iniciar em conjunto. As extensões ficam visíveis; ficheiros ocultos são opcionais.",
    apply: "Aplicar seleção",
    applying: "A aplicar…",
    active: "Já aplicado",
    optional: "Opcional",
    notice:
      "Adiciona os ajustes selecionados e mantém os restantes. Restaure alterações na categoria ou no histórico. Não substitui integralmente o modo anterior.",
    empty: "Selecione uma alteração.",
    ready: "Todos os ajustes selecionados já estão aplicados.",
    missing: "Algumas opções não estão disponíveis nesta versão.",
    free: "Incluído em Free",
  },
};
