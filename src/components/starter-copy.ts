import type { Lang } from "../i18n";
const en = {
  heading: "Start with your day",
  intro: "Choose a setup, adjust the selection, then apply it in one click.",
  gaming: "Gaming",
  study: "Study",
  work: "Work",
  laptop: "Laptop",
  quiet: "No interruptions",
  streaming: "Streaming",
  laptopBody: "Fewer visual effects and no apps reopening on their own after sign-in.",
  quietBody: "No feedback surveys, suggested apps or Sticky Keys pop-ups.",
  streamingBody: "Game DVR recording off and fewer Windows pop-ups that could appear on stream.",
  laptopNote:
    "Animations and transparency are turned off, so Windows looks plainer; the changes show after you sign out and back in. Whether this saves battery depends on the laptop and is not measured here; power settings are not changed.",
  quietNote:
    "This is about pop-ups, not fan noise: fan and power settings are not changed. Notifications from your own apps keep working.",
  streamingNote:
    "Game Bar background recording stops, so record with your streaming app. Windows feedback surveys and the Sticky Keys pop-up no longer appear over your game.",
  gamingBody: "Consistent Windows pointer movement and control over Game DVR recording.",
  studyBody: "Fewer Windows suggestions, survey prompts and taskbar distractions.",
  workBody: "Visible file extensions, faster menu opening and no startup app delay.",
  gamingNote:
    "Game DVR capture is turned off. Mouse acceleration changes also affect the desktop; games using raw input may ignore them. The optional Sticky Keys setting disables its keyboard shortcut.",
  studyNote:
    "Widgets disappear from the taskbar. This does not mute messages or block websites. Some changes may need a sign-out to appear.",
  workNote:
    "Menus open without their usual delay. Startup apps may launch together after sign-in. File extensions become visible; hidden files are optional. The menu change shows after you sign out and back in.",
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
  notHere: "Not available on this PC",
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
    laptop: "Portatile",
    quiet: "Senza interruzioni",
    streaming: "Streaming",
    laptopBody: "Meno effetti visivi e nessuna app che si riapre da sola dopo l’accesso.",
    quietBody: "Niente sondaggi di feedback, app suggerite o finestre dei Tasti permanenti.",
    streamingBody:
      "Registrazione Game DVR disattivata e meno finestre di Windows che possono comparire in diretta.",
    laptopNote:
      "Animazioni e trasparenza vengono disattivate, quindi Windows appare più sobrio; le modifiche si vedono dopo essere usciti e rientrati nell’account. Se questo faccia risparmiare batteria dipende dal portatile e qui non viene misurato; le impostazioni di alimentazione non cambiano.",
    quietNote:
      "Riguarda le finestre a comparsa, non il rumore delle ventole: ventole e alimentazione non cambiano. Le notifiche delle tue app continuano a funzionare.",
    streamingNote:
      "La registrazione in background della Game Bar si ferma: per registrare usa la tua app di streaming. I sondaggi di Windows e la finestra dei Tasti permanenti non compaiono più sopra il gioco.",
    gamingBody: "Movimento del puntatore coerente e controllo della registrazione Game DVR.",
    studyBody:
      "Meno suggerimenti di Windows, sondaggi e distrazioni nella barra delle applicazioni.",
    workBody: "Estensioni visibili, menu immediati e nessuna attesa per le app all’avvio.",
    gamingNote:
      "Disattiva la registrazione Game DVR. Le modifiche all’accelerazione del mouse valgono anche sul desktop; i giochi che usano il raw input possono ignorarle. L’opzione facoltativa Tasti permanenti disattiva solo la sua scorciatoia da tastiera.",
    studyNote:
      "I Widget scompaiono dalla barra delle applicazioni. Non silenzia i messaggi e non blocca i siti. Alcune modifiche possono richiedere di uscire e rientrare nell’account Windows.",
    workNote:
      "I menu si aprono senza attesa. Le app possono avviarsi insieme dopo l’accesso. Le estensioni diventano visibili; i file nascosti sono facoltativi. La modifica ai menu si vede dopo essere usciti e rientrati nell’account.",
    apply: "Applica selezionati",
    applying: "Applicazione…",
    active: "Già applicato",
    optional: "Facoltativo",
    notice:
      "Aggiunge i tweak selezionati; le altre impostazioni restano come sono. Ripristina le singole modifiche dalla loro categoria o dalla Cronologia modifiche. Non è una modalità esclusiva che sostituisce tutto il resto.",
    empty: "Seleziona una modifica da applicare.",
    ready: "Tutti i tweak selezionati sono già applicati.",
    missing: "Alcune opzioni non sono disponibili in questa versione.",
    free: "Incluso in Free",
    notHere: "Non disponibile su questo PC",
  },
  fr: {
    ...en,
    heading: "Un profil pour votre journée",
    intro: "Choisissez un profil, ajustez les options et appliquez-les en un clic.",
    gaming: "Gaming",
    study: "Études",
    work: "Travail",
    laptop: "Portable",
    quiet: "Sans interruptions",
    streaming: "Streaming",
    laptopBody:
      "Moins d’effets visuels et aucune application qui se rouvre seule après la connexion.",
    quietBody: "Plus de sondages, d’applications suggérées ni de fenêtre des touches rémanentes.",
    streamingBody:
      "Enregistrement Game DVR désactivé et moins de fenêtres Windows susceptibles d’apparaître en direct.",
    laptopNote:
      "Les animations et la transparence sont désactivées : Windows paraît plus sobre ; les changements apparaissent après une déconnexion puis une reconnexion. Une éventuelle économie de batterie dépend du portable et n’est pas mesurée ici ; les réglages d’alimentation ne changent pas.",
    quietNote:
      "Il s’agit des fenêtres surgissantes, pas du bruit des ventilateurs : ventilateurs et alimentation ne changent pas. Les notifications de vos applications continuent de fonctionner.",
    streamingNote:
      "L’enregistrement en arrière-plan de la Game Bar s’arrête : enregistrez avec votre logiciel de streaming. Les sondages Windows et la fenêtre des touches rémanentes n’apparaissent plus par-dessus le jeu.",
    gamingBody: "Un déplacement du pointeur constant et le contrôle de l’enregistrement Game DVR.",
    studyBody:
      "Moins de suggestions Windows, de sondages et de distractions dans la barre des tâches.",
    workBody: "Extensions visibles, menus immédiats et applications sans délai au démarrage.",
    gamingNote:
      "La capture Game DVR est désactivée. Le changement d’accélération de la souris s’applique aussi au bureau ; les jeux en entrée brute peuvent l’ignorer. L’option Touches rémanentes désactive son raccourci clavier.",
    studyNote:
      "Les Widgets disparaissent de la barre des tâches. Cela ne coupe pas les messages et ne bloque pas les sites web. Certaines modifications peuvent nécessiter une déconnexion pour apparaître.",
    workNote:
      "Les menus s’ouvrent sans leur délai habituel. Les applications au démarrage peuvent se lancer toutes en même temps après la connexion. Les extensions de fichiers deviennent visibles ; les fichiers cachés sont facultatifs. Le changement des menus apparaît après une déconnexion puis une reconnexion.",
    apply: "Appliquer la sélection",
    applying: "Application…",
    active: "Déjà appliqué",
    optional: "Facultatif",
    notice:
      "Ajoute les réglages sélectionnés et conserve les autres. Restaurez-les depuis leur catégorie ou l’historique. Ce n’est pas un changement de mode exclusif.",
    empty: "Sélectionnez un réglage à appliquer.",
    ready: "Tous les réglages sélectionnés sont déjà appliqués.",
    missing: "Certaines options sont indisponibles dans cette version.",
    free: "Inclus dans Free",
    notHere: "Non disponible sur ce PC",
  },
  es: {
    ...en,
    heading: "Un perfil para tu día",
    intro: "Elige un perfil, ajusta las opciones y aplícalas con un clic.",
    gaming: "Gaming",
    study: "Estudio",
    work: "Trabajo",
    laptop: "Portátil",
    quiet: "Sin interrupciones",
    streaming: "Streaming",
    laptopBody:
      "Menos efectos visuales y ninguna aplicación que se vuelva a abrir sola al iniciar sesión.",
    quietBody:
      "Sin encuestas de opinión, aplicaciones sugeridas ni la ventana de Teclas especiales.",
    streamingBody:
      "Grabación de Game DVR desactivada y menos ventanas de Windows que puedan aparecer en directo.",
    laptopNote:
      "Se desactivan las animaciones y la transparencia, así que Windows se ve más sobrio; los cambios se ven después de cerrar sesión y volver a entrar. Si esto ahorra batería depende del portátil y aquí no se mide; la configuración de energía no cambia.",
    quietNote:
      "Se trata de ventanas emergentes, no del ruido de los ventiladores: los ajustes de ventiladores y energía no cambian. Las notificaciones de tus aplicaciones siguen funcionando.",
    streamingNote:
      "La grabación en segundo plano de Game Bar se detiene: graba con tu aplicación de streaming. Las encuestas de opinión de Windows y la ventana de Teclas especiales ya no aparecen sobre el juego.",
    gamingBody: "Movimiento constante del puntero y control de la grabación Game DVR.",
    studyBody: "Menos sugerencias de Windows, encuestas y distracciones en la barra de tareas.",
    workBody: "Extensiones visibles, menús inmediatos y aplicaciones sin demora al iniciar.",
    gamingNote:
      "Se desactiva la captura de Game DVR. Los cambios en la aceleración del ratón también afectan al escritorio; los juegos que usan entrada sin procesar pueden ignorarlos. El ajuste opcional de Teclas especiales desactiva su atajo de teclado.",
    studyNote:
      "Los Widgets desaparecen de la barra de tareas. No silencia mensajes ni bloquea sitios web. Algunos cambios pueden requerir cerrar sesión para verse.",
    workNote:
      "Los menús se abren sin su demora habitual. Las aplicaciones de inicio pueden abrirse todas a la vez tras iniciar sesión. Las extensiones de archivo quedan visibles; los archivos ocultos son opcionales. El cambio en los menús se ve después de cerrar sesión y volver a entrar.",
    apply: "Aplicar selección",
    applying: "Aplicando…",
    active: "Ya aplicado",
    optional: "Opcional",
    notice:
      "Añade los ajustes seleccionados. Los demás ajustes no cambian. Restaura cambios individuales desde su categoría o desde el historial de cambios. No es un cambio de modo excluyente.",
    empty: "Selecciona un cambio para aplicarlo.",
    ready: "Todos los ajustes seleccionados están aplicados.",
    missing: "Algunas opciones no están disponibles en esta versión.",
    free: "Incluido en Free",
    notHere: "No disponible en este PC",
  },
  de: {
    ...en,
    heading: "Ein Profil für deinen Alltag",
    intro: "Profil wählen, Auswahl anpassen und mit einem Klick anwenden.",
    gaming: "Gaming",
    study: "Lernen",
    work: "Arbeit",
    laptop: "Laptop",
    quiet: "Ohne Unterbrechungen",
    streaming: "Streaming",
    laptopBody:
      "Weniger visuelle Effekte und keine Apps, die sich nach der Anmeldung von selbst wieder öffnen.",
    quietBody: "Keine Feedback-Umfragen, vorgeschlagenen Apps oder Hinweise der Einrastfunktion.",
    streamingBody:
      "Game-DVR-Aufnahme aus und weniger Windows-Pop-ups, die im Stream erscheinen könnten.",
    laptopNote:
      "Animationen und Transparenz werden abgeschaltet, Windows wirkt dadurch schlichter; die Änderungen werden nach Ab- und erneuter Anmeldung sichtbar. Ob das Akku spart, hängt vom Laptop ab und wird hier nicht gemessen; Energieeinstellungen bleiben unverändert.",
    quietNote:
      "Es geht um Pop-ups, nicht um Lüftergeräusche: Lüfter- und Energieeinstellungen bleiben unverändert. Benachrichtigungen deiner Apps funktionieren weiter.",
    streamingNote:
      "Die Hintergrundaufnahme der Game Bar stoppt, nimm also mit deiner Streaming-App auf. Windows-Umfragen und der Hinweis der Einrastfunktion erscheinen nicht mehr über dem Spiel.",
    gamingBody: "Gleichmäßige Windows-Zeigerbewegung und Kontrolle über Game-DVR-Aufnahmen.",
    studyBody: "Weniger Windows-Vorschläge, Umfragen und Ablenkungen in der Taskleiste.",
    workBody:
      "Sichtbare Dateiendungen, schneller öffnende Menüs und Autostart-Apps ohne Verzögerung.",
    gamingNote:
      "Deaktiviert die Game-DVR-Aufnahme. Die Änderung der Mausbeschleunigung wirkt auch auf dem Desktop; Spiele mit Raw Input können sie ignorieren. Die optionale Einrastfunktion-Einstellung deaktiviert deren Tastenkürzel.",
    studyNote:
      "Widgets verschwinden aus der Taskleiste. Das schaltet Nachrichten nicht stumm und blockiert keine Websites. Einige Änderungen werden erst nach einer Abmeldung sichtbar.",
    workNote:
      "Menüs öffnen sich ohne die übliche Verzögerung. Autostart-Apps können nach der Anmeldung gleichzeitig starten. Dateiendungen werden sichtbar; versteckte Dateien sind optional. Die Menüänderung wird nach Ab- und erneuter Anmeldung sichtbar.",
    apply: "Auswahl anwenden",
    applying: "Wird angewendet…",
    active: "Bereits angewendet",
    optional: "Optional",
    notice:
      "Aktiviert die gewählten Tweaks. Andere Einstellungen bleiben, wie sie sind. Einzelne Änderungen lassen sich in ihrer Kategorie oder im Änderungsverlauf zurücksetzen. Kein exklusiver Moduswechsel.",
    empty: "Wähle eine Änderung.",
    ready: "Alle gewählten Tweaks sind bereits aktiv.",
    missing: "Einige Optionen fehlen in dieser Version.",
    free: "In Free enthalten",
    notHere: "Auf diesem PC nicht verfügbar",
  },
  pt: {
    ...en,
    heading: "Um perfil para o seu dia",
    intro: "Escolha um perfil, ajuste as opções e aplique com um clique.",
    gaming: "Jogos",
    study: "Estudo",
    work: "Trabalho",
    laptop: "Portátil",
    quiet: "Sem interrupções",
    streaming: "Streaming",
    gamingBody: "Movimento consistente do ponteiro e controlo da gravação Game DVR.",
    studyBody: "Menos sugestões do Windows, questionários e distrações na barra de tarefas.",
    workBody: "Extensões visíveis, menus imediatos e aplicações sem atraso no arranque.",
    laptopBody:
      "Menos efeitos visuais e nenhuma aplicação a reabrir sozinha depois de iniciar sessão.",
    quietBody: "Sem questionários de opinião, aplicações sugeridas nem a janela das Teclas Fixas.",
    streamingBody:
      "Gravação Game DVR desativada e menos janelas do Windows que possam aparecer na transmissão.",
    gamingNote:
      "A captura do Game DVR é desativada. A alteração da aceleração do rato também afeta o ambiente de trabalho; os jogos que usam raw input podem ignorá-la. A opção das Teclas Fixas desativa o respetivo atalho.",
    studyNote:
      "Os widgets desaparecem da barra de tarefas. Não silencia mensagens nem bloqueia sites. Algumas alterações podem exigir terminar a sessão para aparecerem.",
    workNote:
      "Os menus abrem sem o atraso habitual. As aplicações de arranque podem iniciar todas ao mesmo tempo depois de iniciar sessão. As extensões de ficheiro ficam visíveis; os ficheiros ocultos são opcionais. A alteração dos menus nota-se depois de terminar a sessão e voltar a entrar.",
    laptopNote:
      "As animações e a transparência são desativadas, por isso o Windows fica com um aspeto mais simples; as alterações notam-se depois de terminar a sessão e voltar a entrar. Se isto poupa bateria depende do portátil e não é medido aqui; as definições de energia não mudam.",
    quietNote:
      "Trata-se de janelas que surgem no ecrã, não do ruído das ventoinhas: as definições de ventoinhas e de energia não mudam. As notificações das suas aplicações continuam a funcionar.",
    streamingNote:
      "A gravação em segundo plano da Game Bar para, por isso grave com a sua aplicação de streaming. Os questionários do Windows e a janela das Teclas Fixas deixam de aparecer por cima do jogo.",
    apply: "Aplicar seleção",
    applying: "A aplicar…",
    active: "Já aplicado",
    optional: "Opcional",
    notice:
      "Adiciona os ajustes selecionados. As outras definições ficam como estão. Restaure alterações individuais na respetiva categoria ou no Histórico de alterações. Não se trata de um modo exclusivo.",
    empty: "Selecione uma alteração para aplicar.",
    ready: "Todos os ajustes selecionados já estão aplicados.",
    missing: "Algumas opções não estão disponíveis nesta versão.",
    free: "Incluído no Free",
    notHere: "Não disponível neste PC",
  },
};
