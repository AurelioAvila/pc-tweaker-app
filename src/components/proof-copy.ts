import type { Lang } from "../i18n";

/** Copy for the proof card, Safe optimize and the Windows Update alert.
 *  Every number these screens show is measured on the user's PC; the words
 *  around it never promise more than the measurement says. */
type Copy = {
  measuring: string;
  idle: string;
  stepBefore: string;
  stepApply: string;
  stepAfter: string;
  adminHint: string;
  title: string;
  sourceSafe: string;
  sourceScan: string;
  sourceProfile: string;
  measuredOn: string;
  heroNone: string;
  heroNoneBody: string;
  heroWorse: string;
  heroWorseBody: string;
  healthName: string;
  healthImpact: string;
  gridCaption: string;
  changed: string;
  nothingChanged: string;
  failures: string;
  notMeasured: string;
  laterNote: string;
  restoreCreated: string;
  restoreReused: string;
  restoreFailed: string;
  restoreSkipped: string;
  save: string;
  saved: string;
  done: string;
  close: string;
  failed: string;
  pngFooter: string;
  safeEyebrow: string;
  safeTitle: string;
  safeBody: string;
  safeButton: string;
  safeBusy: string;
  safeReview: string;
  safeAllSet: string;
  safeProMore: string;
  safeDeclined: string;
  safeContinue: string;
  safeUndo: string;
  safeReasons: Record<string, string>;
  alertTitleOne: string;
  alertTitleMany: string;
  alertBody: string;
  alertRestoreOne: string;
  alertRestoreMany: string;
  alertNotNow: string;
  alertRestoring: string;
  alertRestoredOne: string;
  alertRestoredMany: string;
  alertProHint: string;
  alertToggleTitle: string;
  alertToggleBody: string;
};

const en: Copy = {
  measuring: "Measuring your PC",
  idle: "Leave the PC idle for about half a minute: the same tests run before and after the change.",
  stepBefore: "Measure before",
  stepApply: "Apply changes",
  stepAfter: "Measure after",
  adminHint: "If Windows asks for administrator permission, choose Yes to continue.",
  title: "Proof of change",
  sourceSafe: "Safe optimize",
  sourceScan: "Scan · Fix all",
  sourceProfile: "Profile · {name}",
  measuredOn: "Measured on this PC · {date}",
  heroNone: "No measurable difference",
  heroNoneBody:
    "Every number below stayed within its normal variation between runs, so no gain is claimed. Many settings remove ads, prompts or waits, which these tests can't see.",
  heroWorse: "No measurable improvement this time",
  heroWorseBody:
    "A busy moment (updates, indexing, an open app) can move a single measurement. Measure again in PC Health → Before & After.",
  healthName: "Health score",
  healthImpact: "more health score points",
  gridCaption: "Before → after on this PC. A value without a badge did not change significantly.",
  changed: "What changed ({count})",
  nothingChanged: "Nothing needed changing: every setting was already in place.",
  failures: "Not applied: {count}. The details are in Change history.",
  notMeasured: "The measurement could not run ({error}). The changes below were applied.",
  laterNote:
    "Some settings take full effect only after you sign in again. Measure again then in PC Health → Before & After.",
  restoreCreated: "Restore point created · {time}",
  restoreReused: "Windows kept its restore point from {time} (it makes at most one a day).",
  restoreFailed: "No new restore point: {reason}",
  restoreSkipped: "No restore point: you continued without one.",
  save: "Save as PNG",
  saved: "Proof saved.",
  done: "Done",
  close: "Close",
  failed: "Could not finish: {error}",
  pngFooter:
    "Measured on this PC before and after the change. Timed tests: median of 7 or more runs; a difference inside normal variation counts as no change.",
  safeEyebrow: "ONE CLICK",
  safeTitle: "Safe optimize",
  safeBody:
    "{count} low-risk settings for this PC. A restore point first, then measured proof of what changed.",
  safeButton: "Safe optimize",
  safeBusy: "Optimizing…",
  safeReview: "What it changes",
  safeAllSet: "Every safe setting is already in place on this PC.",
  safeProMore: "+{count} with Pro",
  safeDeclined:
    "Nothing was changed. Safe optimize starts with a restore point, which needs administrator permission.",
  safeContinue: "Continue without a restore point",
  safeUndo: "Every change can be undone in Change history.",
  safeReasons: {
    disable_start_suggestions:
      "Removes ads and promoted apps from Start. Your pinned apps and search stay as they are.",
    disable_suggested_apps:
      "Stops Windows installing promoted apps on its own. Apps you installed are untouched.",
    disable_feedback_requests:
      "Stops feedback survey pop-ups. Feedback Hub still works when you open it.",
    disable_tailored_experiences:
      "Windows stops using diagnostic data to tailor ads and tips. No feature stops working.",
    reset_advertising_id:
      "Apps can no longer use your advertising ID to profile you. No app needs it to work.",
    disable_startup_delay:
      "Startup apps begin right after sign-in instead of after Windows' built-in wait.",
    menu_show_delay: "Menus open without the default 400 ms pause. Only the timing changes.",
    disable_windows_suggestions:
      "Turns off Windows' own tips, welcome screens and suggested notifications. No feature is removed.",
    block_oem_device_apps:
      "Stops device makers' apps installing themselves when you plug something in. Drivers still install.",
  },
  alertTitleOne: "A Windows update changed 1 of your settings",
  alertTitleMany: "A Windows update changed {count} of your settings",
  alertBody:
    "Since the update to {patch}, these settings you applied with PC Tweaker are no longer in effect. Restore puts back what you chose, and it stays undoable in Change history.",
  alertRestoreOne: "Restore 1 setting",
  alertRestoreMany: "Restore {count} settings",
  alertNotNow: "Not now",
  alertRestoring: "Restoring…",
  alertRestoredOne: "Setting restored.",
  alertRestoredMany: "{count} settings restored.",
  alertProHint:
    "With Pro, PC Tweaker tells you the moment an update finishes, even when it is closed.",
  alertToggleTitle: "Windows Update alert",
  alertToggleBody:
    "A Windows notification as soon as an update changes settings you applied, even with PC Tweaker closed. It only reads; restoring is always your click.",
};

const it: Copy = {
  measuring: "Misurazione del PC in corso",
  idle: "Lascia il PC inattivo per circa mezzo minuto: gli stessi test girano prima e dopo la modifica.",
  stepBefore: "Misura il prima",
  stepApply: "Applica le modifiche",
  stepAfter: "Misura il dopo",
  adminHint: "Se Windows chiede l'autorizzazione da amministratore, scegli Sì per continuare.",
  title: "Risultato misurato",
  sourceSafe: "Ottimizzazione sicura",
  sourceScan: "Scansione · Correggi tutto",
  sourceProfile: "Profilo · {name}",
  measuredOn: "Misurato su questo PC · {date}",
  heroNone: "Nessuna differenza misurabile",
  heroNoneBody:
    "Ogni valore qui sotto è rimasto entro la normale variazione tra una misurazione e l'altra, quindi non dichiariamo alcun guadagno. Molte impostazioni tolgono pubblicità, avvisi o attese, che questi test non vedono.",
  heroWorse: "Nessun miglioramento misurabile questa volta",
  heroWorseBody:
    "Un momento di attività (aggiornamenti, indicizzazione, un'app aperta) può spostare una singola misurazione. Misura di nuovo in Salute PC → Prima e dopo.",
  healthName: "Punteggio di salute",
  healthImpact: "punti di salute in più",
  gridCaption:
    "Prima → dopo su questo PC. Un valore senza etichetta non è cambiato in modo significativo.",
  changed: "Cosa è cambiato ({count})",
  nothingChanged: "Non c'era nulla da cambiare: ogni impostazione era già a posto.",
  failures: "Non applicate: {count}. I dettagli sono nella Cronologia modifiche.",
  notMeasured:
    "La misurazione non è riuscita ({error}). Le modifiche qui sotto sono state applicate.",
  laterNote:
    "Alcune impostazioni hanno pieno effetto solo dopo un nuovo accesso. Misura di nuovo allora in Salute PC → Prima e dopo.",
  restoreCreated: "Punto di ripristino creato · {time}",
  restoreReused:
    "Windows ha mantenuto il punto di ripristino delle {time} (ne crea al massimo uno al giorno).",
  restoreFailed: "Nessun nuovo punto di ripristino: {reason}",
  restoreSkipped: "Nessun punto di ripristino: hai scelto di continuare senza.",
  save: "Salva come PNG",
  saved: "Risultato salvato.",
  done: "Fatto",
  close: "Chiudi",
  failed: "Impossibile completare: {error}",
  pngFooter:
    "Misurato su questo PC prima e dopo la modifica. Test a tempo: mediana di almeno 7 esecuzioni; una differenza entro la normale variazione conta come nessuna variazione.",
  safeEyebrow: "UN CLIC",
  safeTitle: "Ottimizzazione sicura",
  safeBody:
    "{count} impostazioni a basso rischio per questo PC. Prima un punto di ripristino, poi la prova misurata di cosa è cambiato.",
  safeButton: "Ottimizza in sicurezza",
  safeBusy: "Ottimizzazione…",
  safeReview: "Cosa cambia",
  safeAllSet: "Ogni impostazione sicura è già attiva su questo PC.",
  safeProMore: "+{count} con Pro",
  safeDeclined:
    "Non è stato cambiato nulla. L'ottimizzazione sicura parte da un punto di ripristino, che richiede l'autorizzazione da amministratore.",
  safeContinue: "Continua senza punto di ripristino",
  safeUndo: "Ogni modifica si può annullare dalla Cronologia modifiche.",
  safeReasons: {
    disable_start_suggestions:
      "Toglie pubblicità e app promosse da Start. Le app aggiunte e la ricerca restano come sono.",
    disable_suggested_apps:
      "Impedisce a Windows di installare da solo le app promosse. Le app che hai installato non vengono toccate.",
    disable_feedback_requests:
      "Ferma i sondaggi di feedback a comparsa. Hub di Feedback funziona ancora quando lo apri.",
    disable_tailored_experiences:
      "Windows smette di usare i dati di diagnostica per personalizzare pubblicità e suggerimenti. Tutte le funzioni restano disponibili.",
    reset_advertising_id:
      "Le app non possono più usare il tuo ID pubblicità per profilarti. Nessuna app ne ha bisogno per funzionare.",
    disable_startup_delay:
      "Le app di avvio partono subito dopo l'accesso, senza l'attesa predefinita di Windows.",
    menu_show_delay:
      "I menu si aprono senza la pausa predefinita di 400 ms. Cambia solo il tempo di apertura.",
    disable_windows_suggestions:
      "Disattiva suggerimenti, schermate di benvenuto e notifiche suggerite di Windows. Nessuna funzione viene rimossa.",
    block_oem_device_apps:
      "Impedisce alle app dei produttori di installarsi da sole quando colleghi un dispositivo. I driver si installano come sempre.",
  },
  alertTitleOne: "Un aggiornamento di Windows ha cambiato 1 delle tue impostazioni",
  alertTitleMany: "Un aggiornamento di Windows ha cambiato {count} delle tue impostazioni",
  alertBody:
    "Dall'aggiornamento a {patch}, queste impostazioni che avevi applicato con PC Tweaker non sono più attive. Ripristina rimette ciò che avevi scelto e resta annullabile dalla Cronologia modifiche.",
  alertRestoreOne: "Ripristina 1 impostazione",
  alertRestoreMany: "Ripristina {count} impostazioni",
  alertNotNow: "Non ora",
  alertRestoring: "Ripristino…",
  alertRestoredOne: "Impostazione ripristinata.",
  alertRestoredMany: "{count} impostazioni ripristinate.",
  alertProHint:
    "Con Pro, PC Tweaker ti avvisa appena un aggiornamento finisce, anche quando è chiuso.",
  alertToggleTitle: "Avviso aggiornamenti di Windows",
  alertToggleBody:
    "Una notifica di Windows appena un aggiornamento cambia le impostazioni che hai applicato, anche con PC Tweaker chiuso. Si limita a leggere: il ripristino è sempre un tuo clic.",
};

const fr: Copy = {
  measuring: "Mesure de votre PC",
  idle: "Laissez le PC au repos environ une demi-minute : les mêmes tests sont lancés avant et après la modification.",
  stepBefore: "Mesurer avant",
  stepApply: "Appliquer les modifications",
  stepAfter: "Mesurer après",
  adminHint: "Si Windows demande l'autorisation d'administrateur, choisissez Oui pour continuer.",
  title: "Résultat mesuré",
  sourceSafe: "Optimisation sûre",
  sourceScan: "Analyse · Tout corriger",
  sourceProfile: "Profil · {name}",
  measuredOn: "Mesuré sur ce PC · {date}",
  heroNone: "Aucune différence mesurable",
  heroNoneBody:
    "Chaque valeur ci-dessous est restée dans sa variation normale entre deux mesures : aucun gain n'est donc annoncé. Beaucoup de réglages suppriment publicités, fenêtres ou attentes, que ces tests ne voient pas.",
  heroWorse: "Pas d'amélioration mesurable cette fois",
  heroWorseBody:
    "Un moment chargé (mises à jour, indexation, une application ouverte) peut déplacer une mesure isolée. Mesurez de nouveau dans Santé du PC → Avant / après.",
  healthName: "Score de santé",
  healthImpact: "points de santé en plus",
  gridCaption:
    "Avant → après sur ce PC. Une valeur sans étiquette n'a pas changé de façon significative.",
  changed: "Ce qui a changé ({count})",
  nothingChanged: "Rien à modifier : chaque réglage était déjà en place.",
  failures: "Non appliqués : {count}. Les détails sont dans l'Historique des modifications.",
  notMeasured:
    "La mesure n'a pas pu être effectuée ({error}). Les modifications ci-dessous ont été appliquées.",
  laterNote:
    "Certains réglages ne prennent pleinement effet qu'après une nouvelle connexion. Mesurez de nouveau à ce moment-là dans Santé du PC → Avant / après.",
  restoreCreated: "Point de restauration créé · {time}",
  restoreReused:
    "Windows a conservé son point de restauration de {time} (il en crée au plus un par jour).",
  restoreFailed: "Aucun nouveau point de restauration : {reason}",
  restoreSkipped: "Aucun point de restauration : vous avez continué sans.",
  save: "Enregistrer en PNG",
  saved: "Résultat enregistré.",
  done: "Terminé",
  close: "Fermer",
  failed: "Impossible de terminer : {error}",
  pngFooter:
    "Mesuré sur ce PC avant et après la modification. Tests chronométrés : médiane d'au moins 7 exécutions ; une différence dans la variation normale compte comme aucun changement.",
  safeEyebrow: "EN UN CLIC",
  safeTitle: "Optimisation sûre",
  safeBody:
    "{count} réglages à faible risque pour ce PC. D'abord un point de restauration, puis la preuve mesurée de ce qui a changé.",
  safeButton: "Optimiser en toute sécurité",
  safeBusy: "Optimisation…",
  safeReview: "Ce que cela change",
  safeAllSet: "Tous les réglages sûrs sont déjà en place sur ce PC.",
  safeProMore: "+{count} avec Pro",
  safeDeclined:
    "Rien n'a été modifié. L'optimisation sûre commence par un point de restauration, qui nécessite l'autorisation d'administrateur.",
  safeContinue: "Continuer sans point de restauration",
  safeUndo: "Chaque modification peut être annulée depuis l'Historique des modifications.",
  safeReasons: {
    disable_start_suggestions:
      "Retire les publicités et les applications promues du menu Démarrer. Vos applications épinglées et la recherche restent telles quelles.",
    disable_suggested_apps:
      "Empêche Windows d'installer de lui-même des applications promues. Les applications que vous avez installées ne sont pas touchées.",
    disable_feedback_requests:
      "Arrête les sondages de commentaires qui s'affichent. Le Hub de commentaires fonctionne toujours quand vous l'ouvrez.",
    disable_tailored_experiences:
      "Windows cesse d'utiliser les données de diagnostic pour personnaliser publicités et conseils. Toutes les fonctions restent disponibles.",
    reset_advertising_id:
      "Les applications ne peuvent plus utiliser votre identifiant de publicité pour vous profiler. Aucune n'en a besoin pour fonctionner.",
    disable_startup_delay:
      "Les applications de démarrage se lancent dès la connexion, sans l'attente intégrée de Windows.",
    menu_show_delay:
      "Les menus s'ouvrent sans la pause par défaut de 400 ms. Seul le délai change.",
    disable_windows_suggestions:
      "Désactive les conseils, les écrans d'accueil et les notifications suggérées de Windows. Aucune fonction n'est supprimée.",
    block_oem_device_apps:
      "Empêche les applications des fabricants de s'installer d'elles-mêmes quand vous branchez un appareil. Les pilotes s'installent comme avant.",
  },
  alertTitleOne: "Une mise à jour de Windows a modifié 1 de vos réglages",
  alertTitleMany: "Une mise à jour de Windows a modifié {count} de vos réglages",
  alertBody:
    "Depuis la mise à jour vers {patch}, ces réglages appliqués avec PC Tweaker ne sont plus actifs. Rétablir remet ce que vous aviez choisi, toujours annulable depuis l'Historique des modifications.",
  alertRestoreOne: "Rétablir 1 réglage",
  alertRestoreMany: "Rétablir {count} réglages",
  alertNotNow: "Plus tard",
  alertRestoring: "Rétablissement…",
  alertRestoredOne: "Réglage rétabli.",
  alertRestoredMany: "{count} réglages rétablis.",
  alertProHint:
    "Avec Pro, PC Tweaker vous prévient dès qu'une mise à jour se termine, même quand il est fermé.",
  alertToggleTitle: "Alerte Windows Update",
  alertToggleBody:
    "Une notification Windows dès qu'une mise à jour modifie des réglages que vous avez appliqués, même avec PC Tweaker fermé. Elle ne fait que lire : le rétablissement reste toujours votre décision.",
};

const es: Copy = {
  measuring: "Midiendo tu PC",
  idle: "Deja el PC sin usar durante medio minuto: las mismas pruebas se ejecutan antes y después del cambio.",
  stepBefore: "Medir antes",
  stepApply: "Aplicar cambios",
  stepAfter: "Medir después",
  adminHint: "Si Windows pide permiso de administrador, elige Sí para continuar.",
  title: "Resultado medido",
  sourceSafe: "Optimización segura",
  sourceScan: "Análisis · Corregir todo",
  sourceProfile: "Perfil · {name}",
  measuredOn: "Medido en este PC · {date}",
  heroNone: "Sin diferencia medible",
  heroNoneBody:
    "Cada valor de abajo se quedó dentro de su variación normal entre mediciones, así que no se anuncia ninguna mejora. Muchos ajustes quitan anuncios, avisos o esperas, y estas pruebas no los ven.",
  heroWorse: "Esta vez no hay mejora medible",
  heroWorseBody:
    "Un momento de actividad (actualizaciones, indexación, una app abierta) puede alterar una medición aislada. Vuelve a medir en Salud del PC → Antes y después.",
  healthName: "Puntuación de salud",
  healthImpact: "puntos más de salud",
  gridCaption:
    "Antes → después en este PC. Un valor sin etiqueta no cambió de forma significativa.",
  changed: "Qué cambió ({count})",
  nothingChanged: "No había nada que cambiar: todos los ajustes ya estaban aplicados.",
  failures: "Sin aplicar: {count}. Tienes los detalles en el Historial de cambios.",
  notMeasured: "No se pudo medir ({error}). Los cambios de abajo se aplicaron.",
  laterNote:
    "Algunos ajustes solo tienen efecto completo tras volver a iniciar sesión. Vuelve a medir entonces en Salud del PC → Antes y después.",
  restoreCreated: "Punto de restauración creado · {time}",
  restoreReused:
    "Windows conservó su punto de restauración de las {time} (crea como máximo uno al día).",
  restoreFailed: "Ningún punto de restauración nuevo: {reason}",
  restoreSkipped: "Sin punto de restauración: continuaste sin él.",
  save: "Guardar como PNG",
  saved: "Resultado guardado.",
  done: "Hecho",
  close: "Cerrar",
  failed: "No se pudo terminar: {error}",
  pngFooter:
    "Medido en este PC antes y después del cambio. Pruebas cronometradas: mediana de 7 o más ejecuciones; una diferencia dentro de la variación normal cuenta como sin cambios.",
  safeEyebrow: "CON UN CLIC",
  safeTitle: "Optimización segura",
  safeBody:
    "{count} ajustes de bajo riesgo para este PC. Primero un punto de restauración y luego la prueba medida de lo que cambió.",
  safeButton: "Optimizar con seguridad",
  safeBusy: "Optimizando…",
  safeReview: "Qué cambia",
  safeAllSet: "Todos los ajustes seguros ya están aplicados en este PC.",
  safeProMore: "+{count} con Pro",
  safeDeclined:
    "No se cambió nada. La optimización segura empieza con un punto de restauración, que necesita permiso de administrador.",
  safeContinue: "Continuar sin punto de restauración",
  safeUndo: "Puedes deshacer cada cambio desde el Historial de cambios.",
  safeReasons: {
    disable_start_suggestions:
      "Quita los anuncios y las apps promocionadas de Inicio. Tus apps ancladas y la búsqueda no cambian.",
    disable_suggested_apps:
      "Evita que Windows instale por su cuenta apps promocionadas. Las apps que instalaste no se tocan.",
    disable_feedback_requests:
      "Detiene las encuestas de opinión emergentes. El Centro de opiniones sigue funcionando cuando lo abres.",
    disable_tailored_experiences:
      "Windows deja de usar los datos de diagnóstico para personalizar anuncios y consejos. Todas las funciones siguen disponibles.",
    reset_advertising_id:
      "Las apps ya no pueden usar tu identificador de publicidad para crear tu perfil. Ninguna lo necesita para funcionar.",
    disable_startup_delay:
      "Las apps de inicio arrancan justo después de iniciar sesión, sin la espera integrada de Windows.",
    menu_show_delay:
      "Los menús se abren sin la pausa predeterminada de 400 ms. Solo cambia el tiempo.",
    disable_windows_suggestions:
      "Desactiva los consejos, las pantallas de bienvenida y las notificaciones sugeridas de Windows. No se elimina ninguna función.",
    block_oem_device_apps:
      "Evita que las apps de los fabricantes se instalen solas al conectar un dispositivo. Los controladores se instalan igual.",
  },
  alertTitleOne: "Una actualización de Windows cambió 1 de tus ajustes",
  alertTitleMany: "Una actualización de Windows cambió {count} de tus ajustes",
  alertBody:
    "Desde la actualización a {patch}, estos ajustes que aplicaste con PC Tweaker ya no están activos. Restaurar vuelve a poner lo que elegiste y se puede deshacer en el Historial de cambios.",
  alertRestoreOne: "Restaurar 1 ajuste",
  alertRestoreMany: "Restaurar {count} ajustes",
  alertNotNow: "Ahora no",
  alertRestoring: "Restaurando…",
  alertRestoredOne: "Ajuste restaurado.",
  alertRestoredMany: "{count} ajustes restaurados.",
  alertProHint:
    "Con Pro, PC Tweaker te avisa en cuanto termina una actualización, incluso cuando está cerrado.",
  alertToggleTitle: "Aviso de Windows Update",
  alertToggleBody:
    "Una notificación de Windows en cuanto una actualización cambia ajustes que aplicaste, incluso con PC Tweaker cerrado. Solo lee: restaurar siempre es decisión tuya.",
};

const de: Copy = {
  measuring: "Dein PC wird gemessen",
  idle: "Lass den PC etwa eine halbe Minute ruhen – dieselben Tests laufen vor und nach der Änderung.",
  stepBefore: "Vorher messen",
  stepApply: "Änderungen anwenden",
  stepAfter: "Nachher messen",
  adminHint: "Wenn Windows nach Administratorrechten fragt, wähle Ja, um fortzufahren.",
  title: "Gemessenes Ergebnis",
  sourceSafe: "Sicher optimieren",
  sourceScan: "Systemscan · Alles beheben",
  sourceProfile: "Profil · {name}",
  measuredOn: "Auf diesem PC gemessen · {date}",
  heroNone: "Kein messbarer Unterschied",
  heroNoneBody:
    "Jeder Wert unten blieb innerhalb seiner normalen Schwankung zwischen zwei Messungen, also wird kein Gewinn behauptet. Viele Einstellungen entfernen Werbung, Hinweise oder Wartezeiten – das sehen diese Tests nicht.",
  heroWorse: "Diesmal keine messbare Verbesserung",
  heroWorseBody:
    "Ein ausgelasteter Moment (Updates, Indizierung, eine offene App) kann eine einzelne Messung verschieben. Miss erneut unter PC-Zustand → Vorher und nachher.",
  healthName: "Zustandsbewertung",
  healthImpact: "Punkte mehr bei der Zustandsbewertung",
  gridCaption:
    "Vorher → nachher auf diesem PC. Ein Wert ohne Kennzeichnung hat sich nicht signifikant geändert.",
  changed: "Was sich geändert hat ({count})",
  nothingChanged: "Es gab nichts zu ändern: Jede Einstellung war bereits gesetzt.",
  failures: "Nicht angewendet: {count}. Details findest du im Änderungsverlauf.",
  notMeasured: "Die Messung konnte nicht laufen ({error}). Die Änderungen unten wurden angewendet.",
  laterNote:
    "Manche Einstellungen wirken erst nach einer erneuten Anmeldung vollständig. Miss dann erneut unter PC-Zustand → Vorher und nachher.",
  restoreCreated: "Wiederherstellungspunkt erstellt · {time}",
  restoreReused:
    "Windows hat seinen Wiederherstellungspunkt von {time} behalten (es erstellt höchstens einen pro Tag).",
  restoreFailed: "Kein neuer Wiederherstellungspunkt: {reason}",
  restoreSkipped: "Kein Wiederherstellungspunkt: Du hast ohne einen fortgefahren.",
  save: "Als PNG speichern",
  saved: "Ergebnis gespeichert.",
  done: "Fertig",
  close: "Schließen",
  failed: "Konnte nicht abgeschlossen werden: {error}",
  pngFooter:
    "Auf diesem PC vor und nach der Änderung gemessen. Zeitmessungen: Median aus mindestens 7 Durchläufen; ein Unterschied innerhalb der normalen Schwankung zählt als keine Änderung.",
  safeEyebrow: "MIT EINEM KLICK",
  safeTitle: "Sicher optimieren",
  safeBody:
    "{count} Einstellungen mit geringem Risiko für diesen PC. Zuerst ein Wiederherstellungspunkt, dann der gemessene Nachweis, was sich geändert hat.",
  safeButton: "Sicher optimieren",
  safeBusy: "Wird optimiert…",
  safeReview: "Was geändert wird",
  safeAllSet: "Alle sicheren Einstellungen sind auf diesem PC bereits gesetzt.",
  safeProMore: "+{count} mit Pro",
  safeDeclined:
    "Es wurde nichts geändert. Sicher optimieren beginnt mit einem Wiederherstellungspunkt, und dafür sind Administratorrechte nötig.",
  safeContinue: "Ohne Wiederherstellungspunkt fortfahren",
  safeUndo: "Jede Änderung lässt sich im Änderungsverlauf rückgängig machen.",
  safeReasons: {
    disable_start_suggestions:
      "Entfernt Werbung und beworbene Apps aus Start. Deine angehefteten Apps und die Suche bleiben, wie sie sind.",
    disable_suggested_apps:
      "Verhindert, dass Windows beworbene Apps von selbst installiert. Von dir installierte Apps bleiben unberührt.",
    disable_feedback_requests:
      "Stoppt eingeblendete Feedback-Umfragen. Der Feedback-Hub funktioniert weiter, wenn du ihn öffnest.",
    disable_tailored_experiences:
      "Windows nutzt Diagnosedaten nicht mehr, um Werbung und Tipps anzupassen. Alle Funktionen bleiben verfügbar.",
    reset_advertising_id:
      "Apps können deine Werbe-ID nicht mehr nutzen, um ein Profil von dir zu erstellen. Keine App braucht sie zum Funktionieren.",
    disable_startup_delay:
      "Autostart-Apps starten direkt nach der Anmeldung statt nach der eingebauten Wartezeit von Windows.",
    menu_show_delay:
      "Menüs öffnen sich ohne die Standardpause von 400 ms. Nur das Timing ändert sich.",
    disable_windows_suggestions:
      "Schaltet Tipps, Willkommensbildschirme und vorgeschlagene Benachrichtigungen von Windows aus. Keine Funktion wird entfernt.",
    block_oem_device_apps:
      "Verhindert, dass sich Hersteller-Apps beim Anschließen eines Geräts selbst installieren. Treiber werden weiterhin installiert.",
  },
  alertTitleOne: "Ein Windows-Update hat 1 deiner Einstellungen geändert",
  alertTitleMany: "Ein Windows-Update hat {count} deiner Einstellungen geändert",
  alertBody:
    "Seit dem Update auf {patch} sind diese Einstellungen, die du mit PC Tweaker angewendet hast, nicht mehr aktiv. „Wiederherstellen“ setzt deine Auswahl zurück – im Änderungsverlauf jederzeit rückgängig zu machen.",
  alertRestoreOne: "1 Einstellung wiederherstellen",
  alertRestoreMany: "{count} Einstellungen wiederherstellen",
  alertNotNow: "Nicht jetzt",
  alertRestoring: "Wird wiederhergestellt…",
  alertRestoredOne: "Einstellung wiederhergestellt.",
  alertRestoredMany: "{count} Einstellungen wiederhergestellt.",
  alertProHint:
    "Mit Pro sagt dir PC Tweaker Bescheid, sobald ein Update fertig ist – auch wenn es geschlossen ist.",
  alertToggleTitle: "Windows-Update-Hinweis",
  alertToggleBody:
    "Eine Windows-Benachrichtigung, sobald ein Update von dir angewendete Einstellungen ändert, auch bei geschlossenem PC Tweaker. Es wird nur gelesen; das Wiederherstellen ist immer dein Klick.",
};

const pt: Copy = {
  measuring: "A medir o seu PC",
  idle: "Deixe o PC em repouso durante cerca de meio minuto: os mesmos testes correm antes e depois da alteração.",
  stepBefore: "Medir antes",
  stepApply: "Aplicar alterações",
  stepAfter: "Medir depois",
  adminHint: "Se o Windows pedir permissão de administrador, escolha Sim para continuar.",
  title: "Resultado medido",
  sourceSafe: "Otimização segura",
  sourceScan: "Análise · Corrigir tudo",
  sourceProfile: "Perfil · {name}",
  measuredOn: "Medido neste PC · {date}",
  heroNone: "Sem diferença mensurável",
  heroNoneBody:
    "Todos os valores abaixo ficaram dentro da variação normal entre medições, por isso não se anuncia nenhum ganho. Muitas definições removem anúncios, avisos ou esperas, que estes testes não veem.",
  heroWorse: "Sem melhoria mensurável desta vez",
  heroWorseBody:
    "Um momento de atividade (atualizações, indexação, uma aplicação aberta) pode alterar uma medição isolada. Volte a medir em Saúde do PC → Antes e depois.",
  healthName: "Pontuação de saúde",
  healthImpact: "pontos a mais de saúde",
  gridCaption: "Antes → depois neste PC. Um valor sem etiqueta não mudou de forma significativa.",
  changed: "O que mudou ({count})",
  nothingChanged: "Não havia nada a alterar: todas as definições já estavam aplicadas.",
  failures: "Não aplicadas: {count}. Os detalhes estão no Histórico de alterações.",
  notMeasured: "Não foi possível medir ({error}). As alterações abaixo foram aplicadas.",
  laterNote:
    "Algumas definições só têm efeito completo depois de voltar a iniciar sessão. Volte a medir nessa altura em Saúde do PC → Antes e depois.",
  restoreCreated: "Ponto de restauro criado · {time}",
  restoreReused: "O Windows manteve o ponto de restauro das {time} (cria no máximo um por dia).",
  restoreFailed: "Nenhum ponto de restauro novo: {reason}",
  restoreSkipped: "Sem ponto de restauro: optou por continuar sem ele.",
  save: "Guardar como PNG",
  saved: "Resultado guardado.",
  done: "Concluído",
  close: "Fechar",
  failed: "Não foi possível concluir: {error}",
  pngFooter:
    "Medido neste PC antes e depois da alteração. Testes cronometrados: mediana de 7 ou mais execuções; uma diferença dentro da variação normal conta como sem alteração.",
  safeEyebrow: "NUM CLIQUE",
  safeTitle: "Otimização segura",
  safeBody:
    "{count} definições de baixo risco para este PC. Primeiro um ponto de restauro, depois a prova medida do que mudou.",
  safeButton: "Otimizar em segurança",
  safeBusy: "A otimizar…",
  safeReview: "O que altera",
  safeAllSet: "Todas as definições seguras já estão aplicadas neste PC.",
  safeProMore: "+{count} com o Pro",
  safeDeclined:
    "Nada foi alterado. A otimização segura começa com um ponto de restauro, que precisa de permissão de administrador.",
  safeContinue: "Continuar sem ponto de restauro",
  safeUndo: "Cada alteração pode ser anulada no Histórico de alterações.",
  safeReasons: {
    disable_start_suggestions:
      "Retira os anúncios e as aplicações promovidas do menu Iniciar. As aplicações afixadas e a pesquisa ficam como estão.",
    disable_suggested_apps:
      "Impede o Windows de instalar sozinho aplicações promovidas. As aplicações que instalou não são tocadas.",
    disable_feedback_requests:
      "Acaba com os inquéritos de opinião que aparecem no ecrã. O Hub de Comentários continua a funcionar quando o abre.",
    disable_tailored_experiences:
      "O Windows deixa de usar os dados de diagnóstico para personalizar anúncios e sugestões. Todas as funcionalidades continuam disponíveis.",
    reset_advertising_id:
      "As aplicações deixam de poder usar o seu ID de publicidade para traçar o seu perfil. Nenhuma precisa dele para funcionar.",
    disable_startup_delay:
      "As aplicações de arranque iniciam logo após o início de sessão, sem a espera predefinida do Windows.",
    menu_show_delay:
      "Os menus abrem sem a pausa predefinida de 400 ms. Só muda o tempo de abertura.",
    disable_windows_suggestions:
      "Desativa as sugestões, os ecrãs de boas-vindas e as notificações sugeridas do Windows. Nenhuma funcionalidade é removida.",
    block_oem_device_apps:
      "Impede que as aplicações dos fabricantes se instalem sozinhas quando liga um dispositivo. Os drivers continuam a ser instalados.",
  },
  alertTitleOne: "Uma atualização do Windows alterou 1 das suas definições",
  alertTitleMany: "Uma atualização do Windows alterou {count} das suas definições",
  alertBody:
    "Desde a atualização para {patch}, estas definições que aplicou com o PC Tweaker já não estão ativas. Repor volta a colocar o que escolheu, sempre anulável no Histórico de alterações.",
  alertRestoreOne: "Repor 1 definição",
  alertRestoreMany: "Repor {count} definições",
  alertNotNow: "Agora não",
  alertRestoring: "A repor…",
  alertRestoredOne: "Definição reposta.",
  alertRestoredMany: "{count} definições repostas.",
  alertProHint:
    "Com o Pro, o PC Tweaker avisa-o assim que uma atualização termina, mesmo quando está fechado.",
  alertToggleTitle: "Alerta do Windows Update",
  alertToggleBody:
    "Uma notificação do Windows assim que uma atualização altera definições que aplicou, mesmo com o PC Tweaker fechado. Apenas lê; repor é sempre uma decisão sua.",
};

export const PROOF_COPY: Record<Lang, Copy> = { en, it, fr, es, de, pt };
