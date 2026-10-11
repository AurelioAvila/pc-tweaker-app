import type { Lang } from "../i18n";

/** Text for one measured quantity: its name, what it measures, and how a
 *  measured improvement reads in the impact summary (after the number). */
type MetricCopy = { name: string; help: string; impact: string };

type Copy = {
  title: string;
  subtitle: string;
  stepBefore: string;
  stepChange: string;
  stepAfter: string;
  runBefore: string;
  runAfter: string;
  runAgain: string;
  startOver: string;
  running: string;
  emptyIntro: string;
  beforeTaken: string;
  nextHint: string;
  changesBetween: string;
  changesNone: string;
  changesMore: string;
  undone: string;
  impactTitle: string;
  impactNoneTitle: string;
  impactNoneBody: string;
  impactNoneNote: string;
  impactWorseTitle: string;
  impactAlso: string;
  colBefore: string;
  colAfter: string;
  better: string;
  same: string;
  inconclusive: string;
  slower: string;
  higher: string;
  lower: string;
  worseHint: string;
  spread: string;
  medianOf: string;
  reading: string;
  confirmed: string;
  measuredAt: string;
  save: string;
  saved: string;
  failed: string;
  method: string;
  methodBody: string[];
  reportTitle: string;
  reportFooter: string;
  bootTitle: string;
  bootHelp: string;
  bootRead: string;
  bootReading: string;
  bootNone: string;
  bootCounts: string;
  bootNeedMore: string;
  metrics: Record<string, MetricCopy>;
};

const en: Copy = {
  title: "Before & After",
  subtitle:
    "Measure, make your changes, measure again. A difference is reported only when it is larger than the normal variation between runs.",
  stepBefore: "Measure before",
  stepChange: "Apply your changes",
  stepAfter: "Measure after",
  runBefore: "Measure before",
  runAfter: "Measure after",
  runAgain: "Measure again",
  startOver: "New before",
  running: "Measuring, about 10 seconds. Leave the PC idle until it finishes.",
  emptyIntro:
    "Run this before you change anything. It takes about 10 seconds and changes nothing on your PC.",
  beforeTaken: "Before measured {time}",
  nextHint:
    "Now apply the tweaks you want. If one asks for a restart, restart first. Then measure after.",
  changesBetween: "Changed between the two measurements",
  changesNone: "Nothing was changed with PC Tweaker between the two measurements.",
  changesMore: "+{count} more",
  undone: "undone",
  impactTitle: "Measured impact",
  impactNoneTitle: "No significant change",
  impactNoneBody: "Your PC was already well configured for these tests.",
  impactNoneNote: "Every difference stayed within the normal variation between runs.",
  impactWorseTitle: "No measurable improvement this time",
  impactAlso: "Every other test stayed within the normal variation between runs.",
  colBefore: "Before",
  colAfter: "After",
  better: "Improved",
  same: "No significant change",
  inconclusive: "Not enough data",
  slower: "Slower this time",
  higher: "Higher this time",
  lower: "Lower this time",
  worseHint:
    "Updates, indexing or an open app can affect a single measurement. Measure again to check.",
  spread: "±{pct}% typical variation",
  medianOf: "median of {count}",
  reading: "single reading",
  confirmed: "Confirmed in {count} of {total} measurements",
  measuredAt: "{before} → {after}",
  save: "Save as image",
  saved: "Report saved.",
  failed: "The measurement could not finish: {error}",
  method: "How this is measured",
  methodBody: [
    "Each timed test runs at least 7 times and the middle value (the median) is shown. “±x% typical variation” means half of the runs landed within that distance of the median.",
    "A timed test counts as changed only when the two sets of runs are clearly apart (exact rank test, p < 0.01), the medians differ by at least 5% and both point the same way.",
    "Processes, startup apps, memory in use and free space are read once. Small swings (3 processes, 250 MB of memory, 100 MB of disk space) count as no change.",
    "Results are compared only with this PC and stay on it. Nothing is uploaded.",
  ],
  reportTitle: "PC Tweaker · Before & After",
  reportFooter:
    "Median of at least 7 runs per timed test; a change is reported only when p < 0.01 and at least 5%. Measured on this PC; nothing was uploaded.",
  bootTitle: "Startup time",
  bootHelp:
    "The boot times Windows records itself, from power-on to a usable desktop. Reading them needs administrator permission.",
  bootRead: "Read startup times",
  bootReading: "Reading…",
  bootNone: "Windows has not recorded any startup times on this PC.",
  bootCounts: "{before} restarts before · {after} after",
  bootNeedMore: "A comparison needs at least 4 restarts on each side of the before measurement.",
  metrics: {
    boot_ms: {
      name: "Startup time",
      help: "From power-on to a usable desktop, as recorded by Windows. Median of the restarts on each side.",
      impact: "faster startup",
    },
    cpu: {
      name: "Processor work rate",
      help: "The same fixed calculation, 7 runs of 0.3 seconds. Shown relative to the before measurement; higher is better.",
      impact: "more processor work per second",
    },
    launch_ms: {
      name: "Program start",
      help: "Time for Windows to start a small program and close it again (the command processor), 11 times. Lower is better.",
      impact: "less time to start a program",
    },
    memory_touch_ms: {
      name: "Memory allocation",
      help: "Time to reserve and fill 256 MB of memory, 7 times. Lower is better.",
      impact: "less time to allocate memory",
    },
    disk_write_ms: {
      name: "Disk write",
      help: "Time to write 16 MB to the system drive and flush it to disk, 7 times. Lower is better.",
      impact: "less time to write to disk",
    },
    disk_read_us: {
      name: "Disk response",
      help: "Average time to read one 4 KB block straight from the system drive, past the cache, 7 times. Lower is better.",
      impact: "less time per disk read",
    },
    processes: {
      name: "Running processes",
      help: "Processes running when the measurement started. Fewer usually means less background work.",
      impact: "fewer running processes",
    },
    startup_apps: {
      name: "Apps starting with Windows",
      help: "Startup entries that are switched on. Fewer means less to load at sign-in.",
      impact: "fewer apps starting with Windows",
    },
    memory_used_mb: {
      name: "Memory in use",
      help: "Memory in use when the measurement started. It depends on which apps are open, so compare with the same apps open.",
      impact: "less memory in use",
    },
    disk_free_mb: {
      name: "Free space on the system drive",
      help: "Space available on the drive Windows is installed on.",
      impact: "more free space",
    },
  },
};

const it: Copy = {
  title: "Prima e dopo",
  subtitle:
    "Misura, applica le modifiche, misura di nuovo. Una differenza viene indicata solo se supera la normale variazione tra una misurazione e l'altra.",
  stepBefore: "Misura il prima",
  stepChange: "Applica le modifiche",
  stepAfter: "Misura il dopo",
  runBefore: "Misura il prima",
  runAfter: "Misura il dopo",
  runAgain: "Misura di nuovo",
  startOver: "Nuovo prima",
  running: "Misurazione in corso, circa 10 secondi. Non usare il PC finché non termina.",
  emptyIntro:
    "Eseguila prima di cambiare qualsiasi cosa. Richiede circa 10 secondi e non modifica nulla sul PC.",
  beforeTaken: "Prima misurato {time}",
  nextHint:
    "Ora applica i tweak che vuoi. Se uno richiede il riavvio, riavvia prima. Poi misura il dopo.",
  changesBetween: "Modifiche tra le due misurazioni",
  changesNone: "Tra le due misurazioni non è stato modificato nulla con PC Tweaker.",
  changesMore: "+{count} altre",
  undone: "annullato",
  impactTitle: "Impatto misurato",
  impactNoneTitle: "Nessuna variazione significativa",
  impactNoneBody: "Il tuo PC era già ben configurato per questi test.",
  impactNoneNote: "Ogni differenza è rimasta entro la normale variazione tra le misurazioni.",
  impactWorseTitle: "Nessun miglioramento misurabile questa volta",
  impactAlso: "Tutti gli altri test sono rimasti entro la normale variazione tra le misurazioni.",
  colBefore: "Prima",
  colAfter: "Dopo",
  better: "Migliorato",
  same: "Nessuna variazione significativa",
  inconclusive: "Dati insufficienti",
  slower: "Più lento questa volta",
  higher: "Più alto questa volta",
  lower: "Più basso questa volta",
  worseHint:
    "Aggiornamenti, indicizzazione o un'app aperta possono influire su una singola misurazione. Misura di nuovo per verificare.",
  spread: "±{pct}% di variazione tipica",
  medianOf: "mediana di {count}",
  reading: "lettura singola",
  confirmed: "Confermato in {count} misurazioni su {total}",
  measuredAt: "{before} → {after}",
  save: "Salva come immagine",
  saved: "Rapporto salvato.",
  failed: "La misurazione non è stata completata: {error}",
  method: "Come viene misurato",
  methodBody: [
    "Ogni test a tempo viene eseguito almeno 7 volte e si mostra il valore centrale (la mediana). «±x% di variazione tipica» significa che metà delle esecuzioni è rimasta entro quella distanza dalla mediana.",
    "Un test a tempo risulta cambiato solo se le due serie sono nettamente separate (test esatto dei ranghi, p < 0,01), le mediane differiscono almeno del 5% ed entrambe indicano la stessa direzione.",
    "Processi, app all'avvio, memoria in uso e spazio libero vengono letti una volta. Piccole oscillazioni (3 processi, 250 MB di memoria, 100 MB di disco) non contano come variazione.",
    "I risultati si confrontano solo con questo PC e restano qui. Non viene caricato nulla.",
  ],
  reportTitle: "PC Tweaker · Prima e dopo",
  reportFooter:
    "Mediana di almeno 7 esecuzioni per test a tempo; una variazione è indicata solo con p < 0,01 e almeno il 5%. Misurato su questo PC; non è stato caricato nulla.",
  bootTitle: "Tempo di avvio",
  bootHelp:
    "I tempi di avvio che Windows registra da sé, dall'accensione al desktop utilizzabile. Per leggerli servono i permessi di amministratore.",
  bootRead: "Leggi i tempi di avvio",
  bootReading: "Lettura in corso…",
  bootNone: "Windows non ha registrato tempi di avvio su questo PC.",
  bootCounts: "{before} riavvii prima · {after} dopo",
  bootNeedMore: "Per un confronto servono almeno 4 riavvii prima e 4 dopo la misurazione iniziale.",
  metrics: {
    boot_ms: {
      name: "Tempo di avvio",
      help: "Dall'accensione al desktop utilizzabile, come registrato da Windows. Mediana dei riavvii prima e dopo.",
      impact: "di avvio più rapido",
    },
    cpu: {
      name: "Capacità di calcolo",
      help: "Lo stesso calcolo fisso, 7 esecuzioni da 0,3 secondi. Mostrato rispetto alla misurazione iniziale; più alto è meglio.",
      impact: "di lavoro in più del processore al secondo",
    },
    launch_ms: {
      name: "Avvio di un programma",
      help: "Tempo che Windows impiega ad avviare e chiudere un piccolo programma (il prompt dei comandi), 11 volte. Più basso è meglio.",
      impact: "di tempo in meno per avviare un programma",
    },
    memory_touch_ms: {
      name: "Allocazione della memoria",
      help: "Tempo per riservare e riempire 256 MB di memoria, 7 volte. Più basso è meglio.",
      impact: "di tempo in meno per allocare memoria",
    },
    disk_write_ms: {
      name: "Scrittura su disco",
      help: "Tempo per scrivere 16 MB sull'unità di sistema e salvarli su disco, 7 volte. Più basso è meglio.",
      impact: "di tempo in meno per scrivere su disco",
    },
    disk_read_us: {
      name: "Risposta del disco",
      help: "Tempo medio per leggere un blocco da 4 KB direttamente dall'unità di sistema, senza cache, 7 volte. Più basso è meglio.",
      impact: "di tempo in meno per ogni lettura",
    },
    processes: {
      name: "Processi attivi",
      help: "Processi in esecuzione all'inizio della misurazione. Meno processi di solito significano meno lavoro in background.",
      impact: "processi attivi in meno",
    },
    startup_apps: {
      name: "App all'avvio di Windows",
      help: "Voci di avvio attive. Meno voci significano meno da caricare all'accesso.",
      impact: "app all'avvio in meno",
    },
    memory_used_mb: {
      name: "Memoria in uso",
      help: "Memoria in uso all'inizio della misurazione. Dipende dalle app aperte: confronta con le stesse app aperte.",
      impact: "di memoria in uso in meno",
    },
    disk_free_mb: {
      name: "Spazio libero sull'unità di sistema",
      help: "Spazio disponibile sull'unità in cui è installato Windows.",
      impact: "di spazio libero in più",
    },
  },
};

const fr: Copy = {
  title: "Avant / après",
  subtitle:
    "Mesurez, appliquez vos modifications, mesurez à nouveau. Une différence n'est signalée que si elle dépasse la variation normale d'une mesure à l'autre.",
  stepBefore: "Mesurer l'avant",
  stepChange: "Appliquer vos modifications",
  stepAfter: "Mesurer l'après",
  runBefore: "Mesurer l'avant",
  runAfter: "Mesurer l'après",
  runAgain: "Mesurer à nouveau",
  startOver: "Nouvel avant",
  running: "Mesure en cours, environ 10 secondes. N'utilisez pas le PC avant la fin.",
  emptyIntro:
    "Lancez-la avant de modifier quoi que ce soit. Elle dure environ 10 secondes et ne change rien sur votre PC.",
  beforeTaken: "Avant mesuré {time}",
  nextHint:
    "Appliquez maintenant les réglages voulus. Si l'un d'eux demande un redémarrage, redémarrez d'abord. Puis mesurez l'après.",
  changesBetween: "Modifié entre les deux mesures",
  changesNone: "Rien n'a été modifié avec PC Tweaker entre les deux mesures.",
  changesMore: "+{count} autres",
  undone: "annulé",
  impactTitle: "Impact mesuré",
  impactNoneTitle: "Aucun changement significatif",
  impactNoneBody: "Votre PC était déjà bien configuré pour ces tests.",
  impactNoneNote:
    "Toutes les différences sont restées dans la variation normale entre les mesures.",
  impactWorseTitle: "Aucune amélioration mesurable cette fois",
  impactAlso: "Tous les autres tests sont restés dans la variation normale entre les mesures.",
  colBefore: "Avant",
  colAfter: "Après",
  better: "Amélioré",
  same: "Aucun changement significatif",
  inconclusive: "Données insuffisantes",
  slower: "Plus lent cette fois",
  higher: "Plus élevé cette fois",
  lower: "Plus bas cette fois",
  worseHint:
    "Une mise à jour, l'indexation ou une application ouverte peuvent influencer une mesure isolée. Mesurez à nouveau pour vérifier.",
  spread: "±{pct} % de variation habituelle",
  medianOf: "médiane de {count}",
  reading: "lecture unique",
  confirmed: "Confirmé dans {count} mesures sur {total}",
  measuredAt: "{before} → {after}",
  save: "Enregistrer en image",
  saved: "Rapport enregistré.",
  failed: "La mesure n'a pas pu aboutir : {error}",
  method: "Comment c'est mesuré",
  methodBody: [
    "Chaque test chronométré est exécuté au moins 7 fois et la valeur centrale (la médiane) est affichée. « ±x % de variation habituelle » signifie que la moitié des exécutions est restée à cette distance de la médiane.",
    "Un test chronométré n'est considéré comme modifié que si les deux séries sont nettement séparées (test exact des rangs, p < 0,01), si les médianes diffèrent d'au moins 5 % et si les deux vont dans le même sens.",
    "Les processus, les applications au démarrage, la mémoire utilisée et l'espace libre sont lus une fois. Les petites variations (3 processus, 250 Mo de mémoire, 100 Mo de disque) ne comptent pas.",
    "Les résultats ne sont comparés qu'avec ce PC et y restent. Rien n'est envoyé.",
  ],
  reportTitle: "PC Tweaker · Avant / après",
  reportFooter:
    "Médiane d'au moins 7 exécutions par test chronométré ; un changement n'est signalé qu'avec p < 0,01 et au moins 5 %. Mesuré sur ce PC ; rien n'a été envoyé.",
  bootTitle: "Temps de démarrage",
  bootHelp:
    "Les temps de démarrage que Windows enregistre lui-même, de la mise sous tension au bureau utilisable. Leur lecture demande les droits d'administrateur.",
  bootRead: "Lire les temps de démarrage",
  bootReading: "Lecture…",
  bootNone: "Windows n'a enregistré aucun temps de démarrage sur ce PC.",
  bootCounts: "{before} redémarrages avant · {after} après",
  bootNeedMore:
    "Une comparaison demande au moins 4 redémarrages de chaque côté de la mesure de l'avant.",
  metrics: {
    boot_ms: {
      name: "Temps de démarrage",
      help: "De la mise sous tension au bureau utilisable, tel qu'enregistré par Windows. Médiane des redémarrages de chaque côté.",
      impact: "de démarrage plus rapide",
    },
    cpu: {
      name: "Débit du processeur",
      help: "Le même calcul fixe, 7 exécutions de 0,3 seconde. Affiché par rapport à la mesure de l'avant ; plus haut, c'est mieux.",
      impact: "de travail en plus par seconde pour le processeur",
    },
    launch_ms: {
      name: "Lancement d'un programme",
      help: "Temps que met Windows à lancer puis fermer un petit programme (l'invite de commandes), 11 fois. Plus bas, c'est mieux.",
      impact: "de temps en moins pour lancer un programme",
    },
    memory_touch_ms: {
      name: "Allocation de mémoire",
      help: "Temps pour réserver et remplir 256 Mo de mémoire, 7 fois. Plus bas, c'est mieux.",
      impact: "de temps en moins pour allouer la mémoire",
    },
    disk_write_ms: {
      name: "Écriture disque",
      help: "Temps pour écrire 16 Mo sur le lecteur système et les vider sur le disque, 7 fois. Plus bas, c'est mieux.",
      impact: "de temps en moins pour écrire sur le disque",
    },
    disk_read_us: {
      name: "Réactivité du disque",
      help: "Temps moyen pour lire un bloc de 4 Ko directement sur le lecteur système, sans le cache, 7 fois. Plus bas, c'est mieux.",
      impact: "de temps en moins par lecture",
    },
    processes: {
      name: "Processus en cours",
      help: "Processus en cours au début de la mesure. Moins de processus signifie en général moins de travail en arrière-plan.",
      impact: "processus en cours en moins",
    },
    startup_apps: {
      name: "Applications au démarrage de Windows",
      help: "Entrées de démarrage activées. Moins d'entrées, c'est moins à charger à l'ouverture de session.",
      impact: "applications au démarrage en moins",
    },
    memory_used_mb: {
      name: "Mémoire utilisée",
      help: "Mémoire utilisée au début de la mesure. Elle dépend des applications ouvertes : comparez avec les mêmes applications ouvertes.",
      impact: "de mémoire utilisée en moins",
    },
    disk_free_mb: {
      name: "Espace libre sur le lecteur système",
      help: "Espace disponible sur le lecteur où Windows est installé.",
      impact: "d'espace libre en plus",
    },
  },
};

const es: Copy = {
  title: "Antes y después",
  subtitle:
    "Mide, aplica tus cambios y vuelve a medir. Solo se indica una diferencia si supera la variación normal entre una medición y otra.",
  stepBefore: "Medir el antes",
  stepChange: "Aplicar los cambios",
  stepAfter: "Medir el después",
  runBefore: "Medir el antes",
  runAfter: "Medir el después",
  runAgain: "Volver a medir",
  startOver: "Nuevo antes",
  running: "Midiendo, unos 10 segundos. No uses el PC hasta que termine.",
  emptyIntro:
    "Ejecútala antes de cambiar nada. Tarda unos 10 segundos y no modifica nada en tu PC.",
  beforeTaken: "Antes medido {time}",
  nextHint:
    "Ahora aplica los ajustes que quieras. Si alguno pide reiniciar, reinicia primero. Después mide el después.",
  changesBetween: "Cambios entre las dos mediciones",
  changesNone: "No se cambió nada con PC Tweaker entre las dos mediciones.",
  changesMore: "+{count} más",
  undone: "deshecho",
  impactTitle: "Impacto medido",
  impactNoneTitle: "Sin cambios significativos",
  impactNoneBody: "Tu PC ya estaba bien configurado para estas pruebas.",
  impactNoneNote: "Todas las diferencias quedaron dentro de la variación normal entre mediciones.",
  impactWorseTitle: "Ninguna mejora medible esta vez",
  impactAlso: "Las demás pruebas quedaron dentro de la variación normal entre mediciones.",
  colBefore: "Antes",
  colAfter: "Después",
  better: "Mejorado",
  same: "Sin cambios significativos",
  inconclusive: "Datos insuficientes",
  slower: "Más lento esta vez",
  higher: "Más alto esta vez",
  lower: "Más bajo esta vez",
  worseHint:
    "Las actualizaciones, la indexación o una aplicación abierta pueden afectar a una medición aislada. Vuelve a medir para comprobarlo.",
  spread: "±{pct} % de variación habitual",
  medianOf: "mediana de {count}",
  reading: "lectura única",
  confirmed: "Confirmado en {count} de {total} mediciones",
  measuredAt: "{before} → {after}",
  save: "Guardar como imagen",
  saved: "Informe guardado.",
  failed: "La medición no pudo terminar: {error}",
  method: "Cómo se mide",
  methodBody: [
    "Cada prueba cronometrada se ejecuta al menos 7 veces y se muestra el valor central (la mediana). «±x % de variación habitual» significa que la mitad de las ejecuciones quedó a esa distancia de la mediana o menos.",
    "Una prueba cronometrada solo cuenta como cambiada si las dos series están claramente separadas (prueba exacta de rangos, p < 0,01), las medianas difieren al menos un 5 % y ambas apuntan en la misma dirección.",
    "Los procesos, las aplicaciones de inicio, la memoria en uso y el espacio libre se leen una vez. Las oscilaciones pequeñas (3 procesos, 250 MB de memoria, 100 MB de disco) no cuentan como cambio.",
    "Los resultados solo se comparan con este PC y se quedan en él. No se envía nada.",
  ],
  reportTitle: "PC Tweaker · Antes y después",
  reportFooter:
    "Mediana de al menos 7 ejecuciones por prueba cronometrada; solo se indica un cambio con p < 0,01 y al menos un 5 %. Medido en este PC; no se envió nada.",
  bootTitle: "Tiempo de arranque",
  bootHelp:
    "Los tiempos de arranque que registra el propio Windows, desde el encendido hasta un escritorio utilizable. Para leerlos hacen falta permisos de administrador.",
  bootRead: "Leer los tiempos de arranque",
  bootReading: "Leyendo…",
  bootNone: "Windows no ha registrado ningún tiempo de arranque en este PC.",
  bootCounts: "{before} reinicios antes · {after} después",
  bootNeedMore:
    "Para comparar hacen falta al menos 4 reinicios a cada lado de la medición del antes.",
  metrics: {
    boot_ms: {
      name: "Tiempo de arranque",
      help: "Desde el encendido hasta un escritorio utilizable, según el registro de Windows. Mediana de los reinicios de cada lado.",
      impact: "de arranque más rápido",
    },
    cpu: {
      name: "Rendimiento del procesador",
      help: "El mismo cálculo fijo, 7 ejecuciones de 0,3 segundos. Se muestra respecto a la medición del antes; más alto es mejor.",
      impact: "más de trabajo del procesador por segundo",
    },
    launch_ms: {
      name: "Inicio de un programa",
      help: "Tiempo que tarda Windows en iniciar y cerrar un programa pequeño (el símbolo del sistema), 11 veces. Más bajo es mejor.",
      impact: "menos de tiempo para iniciar un programa",
    },
    memory_touch_ms: {
      name: "Asignación de memoria",
      help: "Tiempo para reservar y llenar 256 MB de memoria, 7 veces. Más bajo es mejor.",
      impact: "menos de tiempo para asignar memoria",
    },
    disk_write_ms: {
      name: "Escritura en disco",
      help: "Tiempo para escribir 16 MB en la unidad del sistema y volcarlos al disco, 7 veces. Más bajo es mejor.",
      impact: "menos de tiempo para escribir en disco",
    },
    disk_read_us: {
      name: "Respuesta del disco",
      help: "Tiempo medio para leer un bloque de 4 KB directamente de la unidad del sistema, sin caché, 7 veces. Más bajo es mejor.",
      impact: "menos de tiempo por lectura",
    },
    processes: {
      name: "Procesos en ejecución",
      help: "Procesos en ejecución al empezar la medición. Menos procesos suele significar menos trabajo en segundo plano.",
      impact: "procesos en ejecución menos",
    },
    startup_apps: {
      name: "Aplicaciones al iniciar Windows",
      help: "Entradas de inicio activadas. Menos entradas significa menos que cargar al iniciar sesión.",
      impact: "aplicaciones de inicio menos",
    },
    memory_used_mb: {
      name: "Memoria en uso",
      help: "Memoria en uso al empezar la medición. Depende de las aplicaciones abiertas: compara con las mismas aplicaciones abiertas.",
      impact: "menos de memoria en uso",
    },
    disk_free_mb: {
      name: "Espacio libre en la unidad del sistema",
      help: "Espacio disponible en la unidad donde está instalado Windows.",
      impact: "más de espacio libre",
    },
  },
};

const de: Copy = {
  title: "Vorher und nachher",
  subtitle:
    "Messen, Änderungen vornehmen, erneut messen. Ein Unterschied wird nur gemeldet, wenn er größer ist als die normale Schwankung zwischen zwei Messungen.",
  stepBefore: "Vorher messen",
  stepChange: "Änderungen anwenden",
  stepAfter: "Nachher messen",
  runBefore: "Vorher messen",
  runAfter: "Nachher messen",
  runAgain: "Erneut messen",
  startOver: "Neues Vorher",
  running: "Messung läuft, etwa 10 Sekunden. Den PC bis zum Ende nicht benutzen.",
  emptyIntro:
    "Führe dies aus, bevor du etwas änderst. Es dauert etwa 10 Sekunden und ändert nichts an deinem PC.",
  beforeTaken: "Vorher gemessen {time}",
  nextHint:
    "Wende jetzt die gewünschten Tweaks an. Verlangt einer einen Neustart, starte zuerst neu. Miss dann nachher.",
  changesBetween: "Zwischen den beiden Messungen geändert",
  changesNone: "Zwischen den beiden Messungen wurde mit PC Tweaker nichts geändert.",
  changesMore: "+{count} weitere",
  undone: "rückgängig gemacht",
  impactTitle: "Gemessene Wirkung",
  impactNoneTitle: "Keine signifikante Änderung",
  impactNoneBody: "Dein PC war für diese Tests bereits gut eingestellt.",
  impactNoneNote:
    "Alle Unterschiede blieben innerhalb der normalen Schwankung zwischen den Messungen.",
  impactWorseTitle: "Diesmal keine messbare Verbesserung",
  impactAlso:
    "Alle anderen Tests blieben innerhalb der normalen Schwankung zwischen den Messungen.",
  colBefore: "Vorher",
  colAfter: "Nachher",
  better: "Verbessert",
  same: "Keine signifikante Änderung",
  inconclusive: "Zu wenige Daten",
  slower: "Diesmal langsamer",
  higher: "Diesmal höher",
  lower: "Diesmal niedriger",
  worseHint:
    "Updates, die Indizierung oder eine geöffnete App können eine einzelne Messung beeinflussen. Zur Prüfung erneut messen.",
  spread: "±{pct} % übliche Schwankung",
  medianOf: "Median aus {count}",
  reading: "einzelner Messwert",
  confirmed: "In {count} von {total} Messungen bestätigt",
  measuredAt: "{before} → {after}",
  save: "Als Bild speichern",
  saved: "Bericht gespeichert.",
  failed: "Die Messung konnte nicht abgeschlossen werden: {error}",
  method: "So wird gemessen",
  methodBody: [
    "Jeder Zeittest läuft mindestens 7-mal, angezeigt wird der mittlere Wert (der Median). „±x % übliche Schwankung“ heißt: Die Hälfte der Durchläufe lag höchstens so weit vom Median entfernt.",
    "Ein Zeittest gilt nur dann als verändert, wenn beide Messreihen klar getrennt sind (exakter Rangtest, p < 0,01), die Mediane um mindestens 5 % abweichen und beide in dieselbe Richtung zeigen.",
    "Prozesse, Autostart-Apps, belegter Arbeitsspeicher und freier Speicherplatz werden einmal gelesen. Kleine Schwankungen (3 Prozesse, 250 MB Arbeitsspeicher, 100 MB Speicherplatz) gelten nicht als Änderung.",
    "Die Ergebnisse werden nur mit diesem PC verglichen und bleiben auf ihm. Es wird nichts hochgeladen.",
  ],
  reportTitle: "PC Tweaker · Vorher und nachher",
  reportFooter:
    "Median aus mindestens 7 Durchläufen je Zeittest; eine Änderung wird nur bei p < 0,01 und mindestens 5 % gemeldet. Auf diesem PC gemessen; es wurde nichts hochgeladen.",
  bootTitle: "Startzeit",
  bootHelp:
    "Die Startzeiten, die Windows selbst aufzeichnet, vom Einschalten bis zum nutzbaren Desktop. Zum Lesen sind Administratorrechte nötig.",
  bootRead: "Startzeiten lesen",
  bootReading: "Wird gelesen…",
  bootNone: "Windows hat auf diesem PC keine Startzeiten aufgezeichnet.",
  bootCounts: "{before} Neustarts vorher · {after} nachher",
  bootNeedMore:
    "Für einen Vergleich sind mindestens 4 Neustarts vor und nach der Vorher-Messung nötig.",
  metrics: {
    boot_ms: {
      name: "Startzeit",
      help: "Vom Einschalten bis zum nutzbaren Desktop, wie von Windows aufgezeichnet. Median der Neustarts auf jeder Seite.",
      impact: "schnellerer Start",
    },
    cpu: {
      name: "Prozessorleistung",
      help: "Dieselbe feste Berechnung, 7 Durchläufe zu je 0,3 Sekunden. Angezeigt relativ zur Vorher-Messung; höher ist besser.",
      impact: "mehr Prozessorarbeit pro Sekunde",
    },
    launch_ms: {
      name: "Programmstart",
      help: "Zeit, die Windows braucht, um ein kleines Programm (die Eingabeaufforderung) zu starten und wieder zu schließen, 11-mal. Niedriger ist besser.",
      impact: "weniger Zeit für einen Programmstart",
    },
    memory_touch_ms: {
      name: "Speicherzuweisung",
      help: "Zeit, um 256 MB Arbeitsspeicher zu reservieren und zu füllen, 7-mal. Niedriger ist besser.",
      impact: "weniger Zeit für die Speicherzuweisung",
    },
    disk_write_ms: {
      name: "Schreiben auf den Datenträger",
      help: "Zeit, um 16 MB auf das Systemlaufwerk zu schreiben und auf den Datenträger zu übertragen, 7-mal. Niedriger ist besser.",
      impact: "weniger Zeit beim Schreiben",
    },
    disk_read_us: {
      name: "Reaktionszeit des Datenträgers",
      help: "Durchschnittliche Zeit, um einen 4-KB-Block direkt vom Systemlaufwerk zu lesen, am Cache vorbei, 7-mal. Niedriger ist besser.",
      impact: "weniger Zeit pro Lesezugriff",
    },
    processes: {
      name: "Laufende Prozesse",
      help: "Prozesse, die beim Start der Messung liefen. Weniger Prozesse bedeuten meist weniger Hintergrundarbeit.",
      impact: "laufende Prozesse weniger",
    },
    startup_apps: {
      name: "Apps beim Windows-Start",
      help: "Aktivierte Autostart-Einträge. Weniger Einträge bedeuten weniger, was bei der Anmeldung geladen wird.",
      impact: "Autostart-Apps weniger",
    },
    memory_used_mb: {
      name: "Belegter Arbeitsspeicher",
      help: "Belegter Arbeitsspeicher beim Start der Messung. Er hängt von den geöffneten Apps ab; vergleiche daher mit denselben geöffneten Apps.",
      impact: "weniger belegter Arbeitsspeicher",
    },
    disk_free_mb: {
      name: "Freier Speicher auf dem Systemlaufwerk",
      help: "Verfügbarer Platz auf dem Laufwerk, auf dem Windows installiert ist.",
      impact: "mehr freier Speicher",
    },
  },
};

const pt: Copy = {
  title: "Antes e depois",
  subtitle:
    "Meça, aplique as alterações e meça de novo. Uma diferença só é indicada quando supera a variação normal entre uma medição e outra.",
  stepBefore: "Medir o antes",
  stepChange: "Aplicar as alterações",
  stepAfter: "Medir o depois",
  runBefore: "Medir o antes",
  runAfter: "Medir o depois",
  runAgain: "Medir de novo",
  startOver: "Novo antes",
  running: "Medindo, cerca de 10 segundos. Não use o PC até terminar.",
  emptyIntro:
    "Execute antes de alterar qualquer coisa. Leva cerca de 10 segundos e não muda nada no PC.",
  beforeTaken: "Antes medido {time}",
  nextHint:
    "Agora aplique os ajustes que quiser. Se algum pedir para reiniciar, reinicie primeiro. Depois meça o depois.",
  changesBetween: "Alterado entre as duas medições",
  changesNone: "Nada foi alterado com o PC Tweaker entre as duas medições.",
  changesMore: "+{count} mais",
  undone: "desfeito",
  impactTitle: "Impacto medido",
  impactNoneTitle: "Sem alteração significativa",
  impactNoneBody: "Seu PC já estava bem configurado para estes testes.",
  impactNoneNote: "Todas as diferenças ficaram dentro da variação normal entre medições.",
  impactWorseTitle: "Nenhuma melhoria mensurável desta vez",
  impactAlso: "Os demais testes ficaram dentro da variação normal entre medições.",
  colBefore: "Antes",
  colAfter: "Depois",
  better: "Melhorado",
  same: "Sem alteração significativa",
  inconclusive: "Dados insuficientes",
  slower: "Mais lento desta vez",
  higher: "Mais alto desta vez",
  lower: "Mais baixo desta vez",
  worseHint:
    "Atualizações, a indexação ou um aplicativo aberto podem afetar uma medição isolada. Meça de novo para confirmar.",
  spread: "±{pct}% de variação habitual",
  medianOf: "mediana de {count}",
  reading: "leitura única",
  confirmed: "Confirmado em {count} de {total} medições",
  measuredAt: "{before} → {after}",
  save: "Salvar como imagem",
  saved: "Relatório salvo.",
  failed: "A medição não terminou: {error}",
  method: "Como é medido",
  methodBody: [
    "Cada teste cronometrado é executado pelo menos 7 vezes e mostra-se o valor central (a mediana). «±x% de variação habitual» significa que metade das execuções ficou a essa distância da mediana ou menos.",
    "Um teste cronometrado só conta como alterado quando as duas séries estão claramente separadas (teste exato de postos, p < 0,01), as medianas diferem pelo menos 5% e ambas apontam no mesmo sentido.",
    "Os processos, os aplicativos de inicialização, a memória em uso e o espaço livre são lidos uma vez. Pequenas oscilações (3 processos, 250 MB de memória, 100 MB de disco) não contam como alteração.",
    "Os resultados só são comparados com este PC e ficam nele. Nada é enviado.",
  ],
  reportTitle: "PC Tweaker · Antes e depois",
  reportFooter:
    "Mediana de pelo menos 7 execuções por teste cronometrado; uma alteração só é indicada com p < 0,01 e pelo menos 5%. Medido neste PC; nada foi enviado.",
  bootTitle: "Tempo de inicialização",
  bootHelp:
    "Os tempos de inicialização que o próprio Windows registra, desde o momento em que o PC é ligado até a área de trabalho ficar utilizável. Para lê-los são necessárias permissões de administrador.",
  bootRead: "Ler os tempos de inicialização",
  bootReading: "Lendo…",
  bootNone: "O Windows não registrou tempos de inicialização neste PC.",
  bootCounts: "{before} reinicializações antes · {after} depois",
  bootNeedMore:
    "Uma comparação precisa de pelo menos 4 reinicializações de cada lado da medição do antes.",
  metrics: {
    boot_ms: {
      name: "Tempo de inicialização",
      help: "Desde o momento em que o PC é ligado até a área de trabalho ficar utilizável, segundo o registro do Windows. Mediana das reinicializações de cada lado.",
      impact: "de inicialização mais rápida",
    },
    cpu: {
      name: "Rendimento do processador",
      help: "O mesmo cálculo fixo, 7 execuções de 0,3 segundos. Mostrado em relação à medição do antes; mais alto é melhor.",
      impact: "mais trabalho do processador por segundo",
    },
    launch_ms: {
      name: "Início de um programa",
      help: "Tempo que o Windows demora a iniciar e fechar um programa pequeno (o Prompt de Comando), 11 vezes. Mais baixo é melhor.",
      impact: "menos tempo para iniciar um programa",
    },
    memory_touch_ms: {
      name: "Alocação de memória",
      help: "Tempo para reservar e preencher 256 MB de memória, 7 vezes. Mais baixo é melhor.",
      impact: "menos tempo para alocar memória",
    },
    disk_write_ms: {
      name: "Escrita no disco",
      help: "Tempo para escrever 16 MB na unidade do sistema e gravá-los no disco, 7 vezes. Mais baixo é melhor.",
      impact: "menos tempo para escrever no disco",
    },
    disk_read_us: {
      name: "Resposta do disco",
      help: "Tempo médio para ler um bloco de 4 KB diretamente da unidade do sistema, sem cache, 7 vezes. Mais baixo é melhor.",
      impact: "menos tempo por leitura",
    },
    processes: {
      name: "Processos em execução",
      help: "Processos em execução no início da medição. Menos processos costumam significar menos trabalho em segundo plano.",
      impact: "processos em execução a menos",
    },
    startup_apps: {
      name: "Aplicativos na inicialização do Windows",
      help: "Entradas de inicialização ativas. Menos entradas significam menos coisas para carregar ao entrar.",
      impact: "aplicativos de inicialização a menos",
    },
    memory_used_mb: {
      name: "Memória em uso",
      help: "Memória em uso no início da medição. Depende dos aplicativos abertos: compare com os mesmos aplicativos abertos.",
      impact: "menos memória em uso",
    },
    disk_free_mb: {
      name: "Espaço livre na unidade do sistema",
      help: "Espaço disponível na unidade onde o Windows está instalado.",
      impact: "mais espaço livre",
    },
  },
};

export const BEFORE_AFTER_COPY: Record<Lang, Copy> = { it, en, fr, es, de, pt };
