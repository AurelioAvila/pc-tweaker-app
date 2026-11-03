import type { Lang } from "../i18n";
import type { AudioBus, DriverArea } from "../types";

/** The Audio page (audio.tsx) and its Scan items (scan-results.tsx). Every
 *  claim maps to a value read on this PC or to a documented Windows behaviour
 *  (AUDIO-SPEC 8.4): no "HD audio", no loudness promises, Equalizer APO always
 *  named as third-party. */
type AudioCopy = {
  subtitle: string;
  heroTitle: string;
  statDevices: string;
  statFindings: string;
  /** The "to review" tile when there is nothing to review. */
  statClear: string;
  statFixes: string;
  crackleWait: string;
  cracklePeak: string;
  crackleLimit: string;
  crackleTimesOver: string;
  crackleLegend: string;
  micro: string;
  devicesTitle: string;
  output: string;
  input: string;
  defaultLabel: string;
  commsLabel: string;
  bus: Record<AudioBus, string>;
  rate: string;
  bits: string;
  float: string;
  stereo: string;
  mono: string;
  channels: string;
  effectsOn: string;
  effectsOff: string;
  spatialOn: string;
  spatialOff: string;
  eqActive: string;
  eqBypassed: string;
  deviceSettings: string;
  noDevices: string;
  findingsTitle: string;
  noFindings: string;
  callModeTitle: string;
  callModeBody: string;
  soundSettings: string;
  micMuted: string;
  micLow: string;
  micBody: string;
  effectsOffTitle: string;
  effectsOffBody: string;
  eapoBypassedTitle: string;
  eapoBypassedBody: string;
  eapoInactiveTitle: string;
  eapoInactiveBody: string;
  eapoStale: string;
  openSelector: string;
  fixesTitle: string;
  fixesLead: string;
  idleName: string;
  /** Short card titles; the device's full name is the card's first line. */
  idleHdmi: string;
  idleChip: string;
  powerShort: string;
  idleBody: string;
  idleApplied: string;
  idleRestartNote: string;
  restartDevice: string;
  restarting: string;
  restarted: string;
  powerName: string;
  powerBody: string;
  powerApplied: string;
  modernStandby: string;
  noDeviceFixes: string;
  crackleTitle: string;
  crackleBody: string;
  crackleRun: string;
  crackleRunning: string;
  crackleOk: string;
  crackleOver: string;
  crackleAudible: string;
  crackleNote: string;
  unattributed: string;
  areas: Record<DriverArea, [label: string, advice: string]>;
  eapoTitle: string;
  eapoAbout: string;
  eapoInstalled: string;
  eapoVersion: string;
  eapoOnDevice: string;
  eapoStateActive: string;
  eapoStateBypassed: string;
  eapoStateNone: string;
  eapoSelectorNote: string;
  eapoSelectorMissing: string;
  readError: string;
  retry: string;
  scanDevicesTitle: string;
  scanDevicesBody: string;
  none: string;
  duckingMute: string;
  duckingPercent: string;
  duckingBody: string;
  scanIdleTitle: string;
  scanIdleLocked: string;
  scanPowerTitle: string;
  scanPowerLocked: string;
  scanBtTitle: string;
  scanBtBody: string;
  openAudio: string;
};

export const AUDIO_COPY: Record<Lang, AudioCopy> = {
  en: {
    subtitle: "See what Windows does with your sound and fix what gets in the way.",
    heroTitle: "Sound on this PC",
    statDevices: "Devices in use",
    statFindings: "To review",
    statClear: "All clear",
    statFixes: "Fixes on",
    crackleWait:
      "Measuring for 10 seconds. Use the PC as you normally do; if you hear crackles, play some sound now.",
    cracklePeak: "{kind} peak",
    crackleLimit: "Microsoft's limit: {value}",
    crackleTimesOver: "Times exceeded: {count}",
    crackleLegend:
      "Each bar is a driver's longest routine during the check; the tick marks Microsoft's limit.",
    micro: "{value} µs",
    devicesTitle: "Your devices",
    output: "Output",
    input: "Microphone",
    defaultLabel: "Default",
    commsLabel: "Calls",
    bus: { bluetooth: "Bluetooth", usb: "USB", internal: "Built-in", other: "Other" },
    rate: "{rate} kHz",
    bits: "{bits}-bit",
    float: "{bits}-bit float",
    stereo: "stereo",
    mono: "mono",
    channels: "{count} channels",
    effectsOn: "Effects on",
    effectsOff: "Effects off",
    spatialOn: "Spatial sound on",
    spatialOff: "Spatial sound off",
    eqActive: "Equalizer APO active",
    eqBypassed: "Equalizer APO bypassed",
    deviceSettings: "Windows settings for this device",
    noDevices: "Windows reports no active output or microphone.",
    findingsTitle: "Findings",
    noFindings: "Nothing to report on your audio devices.",
    callModeTitle: "{device} is in call mode",
    callModeBody:
      "{process} is using its microphone, so Windows has switched the headset to its call profile and playback drops to call quality. Choose another microphone in that app to get full quality back.",
    soundSettings: "Sound settings",
    micMuted: "Your default microphone is muted",
    micLow: "Your default microphone is at {level}%",
    micBody:
      "{name}. PC Tweaker never changes this on its own: a low or muted microphone can be deliberate.",
    effectsOffTitle: "Effects are turned off on {name}",
    effectsOffBody:
      "Windows reports audio enhancements off for this device. Windows also turns them off by itself when an effect keeps failing to load.",
    eapoBypassedTitle: "Equalizer APO is bypassed on {name}",
    eapoBypassedBody:
      "Equalizer APO is set up on this device, but Windows has effects turned off for it, so the equalizer does not run.",
    eapoInactiveTitle: "Equalizer APO is installed but not active on {name}",
    eapoInactiveBody:
      "It only works on devices you tick in its Device Selector, and a driver or Windows update can give a device a new ID.",
    eapoStale:
      "Old setups for devices that no longer exist: {count}. A driver or Windows update can give a device a new ID; turn Equalizer APO on for it again in the Device Selector.",
    openSelector: "Open Equalizer APO Device Selector",
    fixesTitle: "Fixes",
    fixesLead: "Each change is recorded and can be restored with one click.",
    idleName: "Keep {device} awake on mains power",
    idleHdmi: "Keep HDMI audio awake",
    idleChip: "Keep the sound chip awake",
    powerShort: "Keep USB audio powered",
    idleBody:
      "Windows switches this device off after {seconds} s of silence on mains power. Can help if the start of a sound is cut off or you hear a pop when sound starts. The battery timer is unchanged.",
    idleApplied: "Stays awake on mains power. The battery timer is unchanged.",
    idleRestartNote: "Takes effect when the device restarts: at the next Windows restart, or now.",
    restartDevice: "Restart this audio device now",
    restarting: "Restarting…",
    restarted: "{device} restarted. Sound may have stopped for a moment.",
    powerName: "Stop Windows powering down {device}",
    powerBody:
      "Windows may switch this USB audio device off to save power (Device Manager, Power Management tab). Can help if it drops out or reconnects after silence.",
    powerApplied: "Windows no longer switches this device off to save power.",
    modernStandby:
      "This PC uses Modern Standby. Microsoft advises against changing this setting on such PCs: it can drain the battery significantly.",
    noDeviceFixes: "No audio device on this PC is switched off by Windows after silence.",
    crackleTitle: "Check for crackles",
    crackleBody:
      "Measures for 10 seconds how long each driver keeps the processor busy, against Microsoft's limits (DPC 100 µs, ISR 25 µs), grouped by the hardware it serves. Needs administrator rights.",
    crackleRun: "Check for crackles (10 s)",
    crackleRunning: "Measuring for 10 s…",
    crackleOk: "No driver ran longer than Microsoft's limits during the check.",
    crackleOver: "Drivers that ran longer than Microsoft's limits: {count}",
    crackleAudible: "May be audible",
    crackleNote:
      "Running past the limit makes a driver a suspect, not the proven source: test by updating it, or by disabling the device it serves, then check again.",
    unattributed: "Unattributed",
    areas: {
      audio: ["Audio", "Update the audio driver from your PC or motherboard maker."],
      graphics: ["Graphics", "Update or clean-install the graphics driver."],
      network: ["Network", "Update the network driver, then check again with Wi-Fi off."],
      storage: ["Storage", "Update the storage driver and the drive's firmware."],
      usb: ["USB", "Move the USB audio device to another port or controller."],
      bluetooth: ["Bluetooth", "Update the Bluetooth driver."],
      platform: [
        "Platform",
        "Update the BIOS and the chipset driver. On laptops, battery polling can show up here.",
      ],
      ambiguous: [
        "Windows framework",
        "A Windows framework or the kernel: the real driver runs behind it.",
      ],
      other: ["Other", "Find the device this driver belongs to and update its driver."],
    },
    eapoTitle: "Equalizer APO",
    eapoAbout:
      "Free, open-source equalizer by Jonas Thedering. Third-party software, not made by or affiliated with PC Tweaker, which only reads its state.",
    eapoInstalled: "Installed",
    eapoVersion: "Installed, version {version}",
    eapoOnDevice: "{name}: {state}",
    eapoStateActive: "active",
    eapoStateBypassed: "bypassed, effects are off",
    eapoStateNone: "not active",
    eapoSelectorNote: "The Device Selector asks for administrator rights itself.",
    eapoSelectorMissing: "Its Device Selector was not found in the installation folder.",
    readError: "Your audio devices could not be read.",
    retry: "Try again",
    scanDevicesTitle: "Your audio devices",
    scanDevicesBody: "Output: {output}. Microphone: {input}.",
    none: "none",
    duckingMute: "Windows mutes other sounds during calls",
    duckingPercent: "Windows lowers other sounds by {percent}% during calls",
    duckingBody:
      "While a call app uses the microphone, your game and music get quieter. Turning it off applies from your next call; apps such as Discord keep their own setting.",
    scanIdleTitle: "{device} switches off after {seconds} s of silence",
    scanIdleLocked:
      "keep {device} awake, now switching off after {seconds} s of silence on this PC",
    scanPowerTitle: "Windows may power down {device}",
    scanPowerLocked: "stop Windows powering down {device}",
    scanBtTitle: "Bluetooth volume not working properly?",
    scanBtBody:
      "Turning off Absolute Volume can help when the Bluetooth volume does not respond, stays too low or jumps. It applies to every Bluetooth device, so it is never part of Fix all.",
    openAudio: "Open Audio",
  },
  it: {
    subtitle: "Scopri cosa fa Windows con il tuo audio e correggi ciò che ti ostacola.",
    heroTitle: "L'audio di questo PC",
    statDevices: "Dispositivi in uso",
    statFindings: "Da controllare",
    statClear: "Tutto a posto",
    statFixes: "Correzioni attive",
    crackleWait:
      "Misurazione di 10 secondi in corso. Usa il PC come sempre; se senti crepitii, fai partire un suono adesso.",
    cracklePeak: "Picco {kind}",
    crackleLimit: "Limite di Microsoft: {value}",
    crackleTimesOver: "Superamenti: {count}",
    crackleLegend:
      "Ogni barra è la routine più lunga di un driver durante il controllo; la tacca segna il limite di Microsoft.",
    micro: "{value} µs",
    devicesTitle: "I tuoi dispositivi",
    output: "Uscita",
    input: "Microfono",
    defaultLabel: "Predefinito",
    commsLabel: "Chiamate",
    bus: { bluetooth: "Bluetooth", usb: "USB", internal: "Integrato", other: "Altro" },
    rate: "{rate} kHz",
    bits: "{bits} bit",
    float: "{bits} bit in virgola mobile",
    stereo: "stereo",
    mono: "mono",
    channels: "{count} canali",
    effectsOn: "Effetti attivi",
    effectsOff: "Effetti disattivati",
    spatialOn: "Audio spaziale attivo",
    spatialOff: "Audio spaziale disattivato",
    eqActive: "Equalizer APO attivo",
    eqBypassed: "Equalizer APO escluso",
    deviceSettings: "Impostazioni di Windows per questo dispositivo",
    noDevices: "Windows non segnala uscite o microfoni attivi.",
    findingsTitle: "Risultati",
    noFindings: "Niente da segnalare sui tuoi dispositivi audio.",
    callModeTitle: "{device} è in modalità chiamata",
    callModeBody:
      "{process} sta usando il suo microfono, quindi Windows ha passato le cuffie al profilo per le chiamate e la riproduzione scende alla qualità di una chiamata. Scegli un altro microfono in quell'app per tornare alla qualità piena.",
    soundSettings: "Impostazioni audio",
    micMuted: "Il microfono predefinito è disattivato",
    micLow: "Il microfono predefinito è al {level}%",
    micBody:
      "{name}. PC Tweaker non lo cambia mai da solo: un microfono basso o disattivato può essere voluto.",
    effectsOffTitle: "Gli effetti sono disattivati su {name}",
    effectsOffBody:
      "Windows segnala i miglioramenti audio disattivati per questo dispositivo. Windows li disattiva anche da solo quando un effetto continua a non caricarsi.",
    eapoBypassedTitle: "Equalizer APO è escluso su {name}",
    eapoBypassedBody:
      "Equalizer APO è configurato su questo dispositivo, ma Windows ha gli effetti disattivati, quindi l'equalizzatore non funziona.",
    eapoInactiveTitle: "Equalizer APO è installato ma non attivo su {name}",
    eapoInactiveBody:
      "Funziona solo sui dispositivi che spunti nel suo Device Selector, e un aggiornamento dei driver o di Windows può dare a un dispositivo un nuovo ID.",
    eapoStale:
      "Configurazioni rimaste da dispositivi che non esistono più: {count}. Un aggiornamento dei driver o di Windows può dare al dispositivo un nuovo ID: riattiva Equalizer APO dal Device Selector.",
    openSelector: "Apri il Device Selector di Equalizer APO",
    fixesTitle: "Correzioni",
    fixesLead: "Ogni modifica viene registrata e si ripristina con un clic.",
    idleName: "Tieni attivo {device} con l'alimentazione da rete",
    idleHdmi: "Tieni attivo l'audio HDMI",
    idleChip: "Tieni attivo il chip audio",
    powerShort: "Tieni acceso l'audio USB",
    idleBody:
      "Con l'alimentazione da rete Windows spegne questo dispositivo dopo {seconds} s di silenzio. Può aiutare se l'inizio di un suono viene tagliato o senti uno schiocco quando parte l'audio. Il timer a batteria non cambia.",
    idleApplied: "Resta attivo con l'alimentazione da rete. Il timer a batteria non cambia.",
    idleRestartNote:
      "Ha effetto quando il dispositivo si riavvia: al prossimo riavvio di Windows, oppure subito.",
    restartDevice: "Riavvia ora questo dispositivo audio",
    restarting: "Riavvio in corso…",
    restarted: "{device} riavviato. L'audio potrebbe essersi fermato per un istante.",
    powerName: "Impedisci a Windows di spegnere {device}",
    powerBody:
      "Windows può spegnere questo dispositivo audio USB per risparmiare energia (Gestione dispositivi, scheda Risparmio energia). Può aiutare se si scollega o si ricollega dopo un silenzio.",
    powerApplied: "Windows non spegne più questo dispositivo per risparmiare energia.",
    modernStandby:
      "Questo PC usa lo standby moderno. Microsoft sconsiglia di cambiare questa impostazione su questi PC: può scaricare molto la batteria.",
    noDeviceFixes:
      "Su questo PC nessun dispositivo audio viene spento da Windows dopo un silenzio.",
    crackleTitle: "Controlla i crepitii",
    crackleBody:
      "Misura per 10 secondi quanto ogni driver tiene occupato il processore, rispetto ai limiti di Microsoft (DPC 100 µs, ISR 25 µs), raggruppando per l'hardware che serve. Servono i diritti di amministratore.",
    crackleRun: "Controlla i crepitii (10 s)",
    crackleRunning: "Misurazione per 10 s…",
    crackleOk: "Durante il controllo nessun driver ha superato i limiti di Microsoft.",
    crackleOver: "Driver che hanno superato i limiti di Microsoft: {count}",
    crackleAudible: "Potrebbe sentirsi",
    crackleNote:
      "Superare il limite rende un driver sospetto, non la causa provata: prova ad aggiornarlo o a disattivare il dispositivo che serve, poi ripeti il controllo.",
    unattributed: "Non attribuito",
    areas: {
      audio: ["Audio", "Aggiorna il driver audio dal produttore del PC o della scheda madre."],
      graphics: ["Grafica", "Aggiorna o reinstalla da zero il driver grafico."],
      network: ["Rete", "Aggiorna il driver di rete, poi ripeti il controllo con il Wi-Fi spento."],
      storage: ["Archiviazione", "Aggiorna il driver di archiviazione e il firmware dell'unità."],
      usb: ["USB", "Sposta il dispositivo audio USB su un'altra porta o un altro controller."],
      bluetooth: ["Bluetooth", "Aggiorna il driver Bluetooth."],
      platform: [
        "Piattaforma",
        "Aggiorna il BIOS e il driver del chipset. Sui portatili qui può comparire il controllo della batteria.",
      ],
      ambiguous: [
        "Componenti di Windows",
        "Un componente di Windows o il kernel: il driver vero lavora dietro.",
      ],
      other: [
        "Altro",
        "Trova il dispositivo a cui appartiene questo driver e aggiornane il driver.",
      ],
    },
    eapoTitle: "Equalizer APO",
    eapoAbout:
      "Equalizzatore gratuito e open source di Jonas Thedering. Software di terze parti, non realizzato da PC Tweaker né collegato a PC Tweaker, che ne legge solo lo stato.",
    eapoInstalled: "Installato",
    eapoVersion: "Installato, versione {version}",
    eapoOnDevice: "{name}: {state}",
    eapoStateActive: "attivo",
    eapoStateBypassed: "escluso, gli effetti sono disattivati",
    eapoStateNone: "non attivo",
    eapoSelectorNote: "Il Device Selector chiede da solo i diritti di amministratore.",
    eapoSelectorMissing: "Il suo Device Selector non si trova nella cartella di installazione.",
    readError: "Non è stato possibile leggere i dispositivi audio.",
    retry: "Riprova",
    scanDevicesTitle: "I tuoi dispositivi audio",
    scanDevicesBody: "Uscita: {output}. Microfono: {input}.",
    none: "nessuno",
    duckingMute: "Windows silenzia gli altri suoni durante le chiamate",
    duckingPercent: "Windows abbassa gli altri suoni del {percent}% durante le chiamate",
    duckingBody:
      "Mentre un'app di chiamata usa il microfono, il gioco e la musica si abbassano. Disattivarlo vale dalla prossima chiamata; app come Discord mantengono la propria impostazione.",
    scanIdleTitle: "{device} si spegne dopo {seconds} s di silenzio",
    scanIdleLocked:
      "tieni attivo {device}, che ora su questo PC si spegne dopo {seconds} s di silenzio",
    scanPowerTitle: "Windows può spegnere {device}",
    scanPowerLocked: "impedisci a Windows di spegnere {device}",
    scanBtTitle: "Il volume Bluetooth non funziona bene?",
    scanBtBody:
      "Disattivare il volume assoluto può aiutare quando il volume Bluetooth non risponde, resta troppo basso o salta. Vale per tutti i dispositivi Bluetooth, quindi non fa mai parte di Correggi tutto.",
    openAudio: "Apri Audio",
  },
  fr: {
    subtitle: "Voyez ce que Windows fait de votre son et corrigez ce qui vous gêne.",
    heroTitle: "Le son de ce PC",
    statDevices: "Appareils utilisés",
    statFindings: "À vérifier",
    statClear: "Rien à signaler",
    statFixes: "Correctifs actifs",
    crackleWait:
      "Mesure en cours pendant 10 secondes. Utilisez le PC comme d'habitude ; si vous entendez des grésillements, lancez un son maintenant.",
    cracklePeak: "Pic {kind}",
    crackleLimit: "Limite de Microsoft : {value}",
    crackleTimesOver: "Dépassements : {count}",
    crackleLegend:
      "Chaque barre montre la routine la plus longue d'un pilote pendant la mesure ; le repère indique la limite de Microsoft.",
    micro: "{value} µs",
    devicesTitle: "Vos appareils",
    output: "Sortie",
    input: "Micro",
    defaultLabel: "Par défaut",
    commsLabel: "Appels",
    bus: { bluetooth: "Bluetooth", usb: "USB", internal: "Intégré", other: "Autre" },
    rate: "{rate} kHz",
    bits: "{bits} bits",
    float: "{bits} bits à virgule flottante",
    stereo: "stéréo",
    mono: "mono",
    channels: "{count} canaux",
    effectsOn: "Effets activés",
    effectsOff: "Effets désactivés",
    spatialOn: "Son spatial activé",
    spatialOff: "Son spatial désactivé",
    eqActive: "Equalizer APO actif",
    eqBypassed: "Equalizer APO contourné",
    deviceSettings: "Paramètres Windows de cet appareil",
    noDevices: "Windows ne signale aucune sortie ni aucun micro actif.",
    findingsTitle: "Constats",
    noFindings: "Rien à signaler sur vos appareils audio.",
    callModeTitle: "{device} est en mode appel",
    callModeBody:
      "{process} utilise son micro : Windows a donc passé le casque sur son profil d'appel et la lecture tombe à la qualité d'un appel. Choisissez un autre micro dans cette application pour retrouver la qualité complète.",
    soundSettings: "Paramètres du son",
    micMuted: "Votre micro par défaut est coupé",
    micLow: "Votre micro par défaut est à {level} %",
    micBody:
      "{name}. PC Tweaker ne le modifie jamais de lui-même : un micro bas ou coupé peut être voulu.",
    effectsOffTitle: "Les effets sont désactivés sur {name}",
    effectsOffBody:
      "Windows indique que les améliorations audio sont désactivées pour cet appareil. Windows les désactive aussi de lui-même quand un effet échoue sans cesse au chargement.",
    eapoBypassedTitle: "Equalizer APO est contourné sur {name}",
    eapoBypassedBody:
      "Equalizer APO est configuré sur cet appareil, mais Windows y a désactivé les effets : l'égaliseur ne s'exécute donc pas.",
    eapoInactiveTitle: "Equalizer APO est installé mais inactif sur {name}",
    eapoInactiveBody:
      "Il ne fonctionne que sur les appareils cochés dans son Device Selector, et une mise à jour de pilote ou de Windows peut attribuer un nouvel identifiant à un appareil.",
    eapoStale:
      "Anciennes configurations d'appareils qui n'existent plus : {count}. Une mise à jour du pilote ou de Windows peut donner un nouvel identifiant à l'appareil ; réactivez Equalizer APO dans le Device Selector.",
    openSelector: "Ouvrir le Device Selector d'Equalizer APO",
    fixesTitle: "Corrections",
    fixesLead: "Chaque modification est enregistrée et se restaure en un clic.",
    idleName: "Garder {device} actif sur secteur",
    idleHdmi: "Garder l'audio HDMI actif",
    idleChip: "Garder la puce audio active",
    powerShort: "Garder l'audio USB alimenté",
    idleBody:
      "Sur secteur, Windows éteint cet appareil après {seconds} s de silence. Peut aider si le début d'un son est coupé ou si vous entendez un claquement quand le son démarre. Le minuteur sur batterie ne change pas.",
    idleApplied: "Reste actif sur secteur. Le minuteur sur batterie ne change pas.",
    idleRestartNote:
      "Prend effet au redémarrage de l'appareil : au prochain redémarrage de Windows, ou maintenant.",
    restartDevice: "Redémarrer cet appareil audio maintenant",
    restarting: "Redémarrage…",
    restarted: "{device} a redémarré. Le son a pu s'interrompre un instant.",
    powerName: "Empêcher Windows d'éteindre {device}",
    powerBody:
      "Windows peut éteindre cet appareil audio USB pour économiser l'énergie (Gestionnaire de périphériques, onglet Gestion de l'alimentation). Peut aider s'il se coupe ou se reconnecte après un silence.",
    powerApplied: "Windows n'éteint plus cet appareil pour économiser l'énergie.",
    modernStandby:
      "Ce PC utilise la veille moderne. Microsoft déconseille de modifier ce réglage sur ces PC : cela peut fortement vider la batterie.",
    noDeviceFixes: "Sur ce PC, Windows n'éteint aucun appareil audio après un silence.",
    crackleTitle: "Rechercher les grésillements",
    crackleBody:
      "Mesure pendant 10 secondes combien de temps chaque pilote occupe le processeur, par rapport aux limites de Microsoft (DPC 100 µs, ISR 25 µs), regroupé par matériel desservi. Nécessite les droits d'administrateur.",
    crackleRun: "Rechercher les grésillements (10 s)",
    crackleRunning: "Mesure pendant 10 s…",
    crackleOk: "Aucun pilote n'a dépassé les limites de Microsoft pendant la mesure.",
    crackleOver: "Pilotes ayant dépassé les limites de Microsoft : {count}",
    crackleAudible: "Peut s'entendre",
    crackleNote:
      "Dépasser la limite fait d'un pilote un suspect, pas la source prouvée : testez en le mettant à jour ou en désactivant l'appareil qu'il dessert, puis mesurez de nouveau.",
    unattributed: "Non attribué",
    areas: {
      audio: [
        "Audio",
        "Mettez à jour le pilote audio depuis le site du fabricant du PC ou de la carte mère.",
      ],
      graphics: ["Graphique", "Mettez à jour ou réinstallez proprement le pilote graphique."],
      network: [
        "Réseau",
        "Mettez à jour le pilote réseau, puis mesurez de nouveau avec le Wi-Fi coupé.",
      ],
      storage: ["Stockage", "Mettez à jour le pilote de stockage et le firmware du disque."],
      usb: ["USB", "Branchez l'appareil audio USB sur un autre port ou un autre contrôleur."],
      bluetooth: ["Bluetooth", "Mettez à jour le pilote Bluetooth."],
      platform: [
        "Plateforme",
        "Mettez à jour le BIOS et le pilote du chipset. Sur les portables, l'interrogation de la batterie peut apparaître ici.",
      ],
      ambiguous: [
        "Composants Windows",
        "Un composant de Windows ou le noyau : le vrai pilote agit derrière.",
      ],
      other: [
        "Autre",
        "Trouvez l'appareil auquel ce pilote appartient et mettez son pilote à jour.",
      ],
    },
    eapoTitle: "Equalizer APO",
    eapoAbout:
      "Égaliseur gratuit et open source de Jonas Thedering. Logiciel tiers, ni conçu par PC Tweaker ni affilié à PC Tweaker, qui se contente de lire son état.",
    eapoInstalled: "Installé",
    eapoVersion: "Installé, version {version}",
    eapoOnDevice: "{name} : {state}",
    eapoStateActive: "actif",
    eapoStateBypassed: "contourné, les effets sont désactivés",
    eapoStateNone: "inactif",
    eapoSelectorNote: "Le Device Selector demande lui-même les droits d'administrateur.",
    eapoSelectorMissing: "Son Device Selector est introuvable dans le dossier d'installation.",
    readError: "Impossible de lire vos appareils audio.",
    retry: "Réessayer",
    scanDevicesTitle: "Vos appareils audio",
    scanDevicesBody: "Sortie : {output}. Micro : {input}.",
    none: "aucun",
    duckingMute: "Windows coupe les autres sons pendant les appels",
    duckingPercent: "Windows baisse les autres sons de {percent} % pendant les appels",
    duckingBody:
      "Quand une application d'appel utilise le micro, votre jeu et votre musique baissent. La désactivation s'applique dès votre prochain appel ; les applications comme Discord gardent leur propre réglage.",
    scanIdleTitle: "{device} s'éteint après {seconds} s de silence",
    scanIdleLocked:
      "garder {device} actif, qui s'éteint aujourd'hui après {seconds} s de silence sur ce PC",
    scanPowerTitle: "Windows peut éteindre {device}",
    scanPowerLocked: "empêcher Windows d'éteindre {device}",
    scanBtTitle: "Le volume Bluetooth fonctionne mal ?",
    scanBtBody:
      "Désactiver le volume absolu peut aider quand le volume Bluetooth ne réagit pas, reste trop bas ou fait des sauts. Cela s'applique à tous les appareils Bluetooth, donc ce n'est jamais inclus dans Tout corriger.",
    openAudio: "Ouvrir Audio",
  },
  es: {
    subtitle: "Mira lo que hace Windows con tu sonido y corrige lo que te estorba.",
    heroTitle: "El sonido de este PC",
    statDevices: "Dispositivos en uso",
    statFindings: "Por revisar",
    statClear: "Todo en orden",
    statFixes: "Correcciones activas",
    crackleWait:
      "Midiendo durante 10 segundos. Usa el PC como siempre; si oyes chasquidos, reproduce algún sonido ahora.",
    cracklePeak: "Pico {kind}",
    crackleLimit: "Límite de Microsoft: {value}",
    crackleTimesOver: "Veces superado: {count}",
    crackleLegend:
      "Cada barra es la rutina más larga de un controlador durante la medición; la marca indica el límite de Microsoft.",
    micro: "{value} µs",
    devicesTitle: "Tus dispositivos",
    output: "Salida",
    input: "Micrófono",
    defaultLabel: "Predeterminado",
    commsLabel: "Llamadas",
    bus: { bluetooth: "Bluetooth", usb: "USB", internal: "Integrado", other: "Otro" },
    rate: "{rate} kHz",
    bits: "{bits} bits",
    float: "{bits} bits de coma flotante",
    stereo: "estéreo",
    mono: "mono",
    channels: "{count} canales",
    effectsOn: "Efectos activados",
    effectsOff: "Efectos desactivados",
    spatialOn: "Sonido espacial activado",
    spatialOff: "Sonido espacial desactivado",
    eqActive: "Equalizer APO activo",
    eqBypassed: "Equalizer APO omitido",
    deviceSettings: "Configuración de Windows de este dispositivo",
    noDevices: "Windows no indica ninguna salida ni micrófono activos.",
    findingsTitle: "Hallazgos",
    noFindings: "Nada que señalar en tus dispositivos de audio.",
    callModeTitle: "{device} está en modo llamada",
    callModeBody:
      "{process} está usando su micrófono, así que Windows ha pasado los auriculares a su perfil de llamada y la reproducción baja a calidad de llamada. Elige otro micrófono en esa app para recuperar la calidad completa.",
    soundSettings: "Configuración de sonido",
    micMuted: "Tu micrófono predeterminado está silenciado",
    micLow: "Tu micrófono predeterminado está al {level} %",
    micBody:
      "{name}. PC Tweaker nunca lo cambia por su cuenta: un micrófono bajo o silenciado puede ser intencionado.",
    effectsOffTitle: "Los efectos están desactivados en {name}",
    effectsOffBody:
      "Windows indica que las mejoras de audio están desactivadas para este dispositivo. Windows también las desactiva por sí solo cuando un efecto falla una y otra vez al cargarse.",
    eapoBypassedTitle: "Equalizer APO está omitido en {name}",
    eapoBypassedBody:
      "Equalizer APO está configurado en este dispositivo, pero Windows tiene los efectos desactivados, así que el ecualizador no se ejecuta.",
    eapoInactiveTitle: "Equalizer APO está instalado pero no activo en {name}",
    eapoInactiveBody:
      "Solo funciona en los dispositivos que marcas en su Device Selector, y una actualización de controladores o de Windows puede dar a un dispositivo un ID nuevo.",
    eapoStale:
      "Configuraciones antiguas de dispositivos que ya no existen: {count}. Una actualización del controlador o de Windows puede dar al dispositivo un nuevo identificador; vuelve a activar Equalizer APO en el Device Selector.",
    openSelector: "Abrir el Device Selector de Equalizer APO",
    fixesTitle: "Correcciones",
    fixesLead: "Cada cambio queda registrado y se restaura con un clic.",
    idleName: "Mantener {device} activo con corriente",
    idleHdmi: "Mantener activo el audio HDMI",
    idleChip: "Mantener activo el chip de sonido",
    powerShort: "Mantener encendido el audio USB",
    idleBody:
      "Conectado a la corriente, Windows apaga este dispositivo tras {seconds} s de silencio. Puede ayudar si el inicio de un sonido se corta o oyes un chasquido cuando empieza el audio. El temporizador con batería no cambia.",
    idleApplied: "Sigue activo con corriente. El temporizador con batería no cambia.",
    idleRestartNote:
      "Se aplica cuando el dispositivo se reinicia: en el próximo reinicio de Windows, o ahora.",
    restartDevice: "Reiniciar ahora este dispositivo de audio",
    restarting: "Reiniciando…",
    restarted: "{device} se ha reiniciado. El sonido puede haberse detenido un instante.",
    powerName: "Impedir que Windows apague {device}",
    powerBody:
      "Windows puede apagar este dispositivo de audio USB para ahorrar energía (Administrador de dispositivos, pestaña Administración de energía). Puede ayudar si se corta o se vuelve a conectar tras un silencio.",
    powerApplied: "Windows ya no apaga este dispositivo para ahorrar energía.",
    modernStandby:
      "Este PC usa el modo de espera moderno. Microsoft desaconseja cambiar este ajuste en estos PC: puede agotar mucho la batería.",
    noDeviceFixes: "En este PC, Windows no apaga ningún dispositivo de audio tras un silencio.",
    crackleTitle: "Buscar chasquidos",
    crackleBody:
      "Mide durante 10 segundos cuánto tiempo ocupa cada controlador el procesador, frente a los límites de Microsoft (DPC 100 µs, ISR 25 µs), agrupado por el hardware al que sirve. Requiere permisos de administrador.",
    crackleRun: "Buscar chasquidos (10 s)",
    crackleRunning: "Midiendo durante 10 s…",
    crackleOk: "Ningún controlador superó los límites de Microsoft durante la medición.",
    crackleOver: "Controladores que superaron los límites de Microsoft: {count}",
    crackleAudible: "Puede oírse",
    crackleNote:
      "Superar el límite convierte a un controlador en sospechoso, no en la causa probada: pruébalo actualizándolo o desactivando el dispositivo al que sirve, y vuelve a medir.",
    unattributed: "Sin atribuir",
    areas: {
      audio: [
        "Audio",
        "Actualiza el controlador de audio desde el fabricante del PC o de la placa base.",
      ],
      graphics: ["Gráficos", "Actualiza o reinstala desde cero el controlador gráfico."],
      network: ["Red", "Actualiza el controlador de red y vuelve a medir con el Wi-Fi apagado."],
      storage: [
        "Almacenamiento",
        "Actualiza el controlador de almacenamiento y el firmware de la unidad.",
      ],
      usb: ["USB", "Conecta el dispositivo de audio USB a otro puerto u otro controlador."],
      bluetooth: ["Bluetooth", "Actualiza el controlador Bluetooth."],
      platform: [
        "Plataforma",
        "Actualiza la BIOS y el controlador del chipset. En portátiles, aquí puede aparecer la consulta de la batería.",
      ],
      ambiguous: [
        "Componentes de Windows",
        "Un componente de Windows o el kernel: el controlador real trabaja detrás.",
      ],
      other: ["Otro", "Busca a qué dispositivo pertenece este controlador y actualízalo."],
    },
    eapoTitle: "Equalizer APO",
    eapoAbout:
      "Ecualizador gratuito y de código abierto de Jonas Thedering. Software de terceros, no creado por PC Tweaker ni vinculado a PC Tweaker, que solo lee su estado.",
    eapoInstalled: "Instalado",
    eapoVersion: "Instalado, versión {version}",
    eapoOnDevice: "{name}: {state}",
    eapoStateActive: "activo",
    eapoStateBypassed: "omitido, los efectos están desactivados",
    eapoStateNone: "no activo",
    eapoSelectorNote: "El Device Selector pide por sí mismo permisos de administrador.",
    eapoSelectorMissing: "Su Device Selector no está en la carpeta de instalación.",
    readError: "No se han podido leer tus dispositivos de audio.",
    retry: "Reintentar",
    scanDevicesTitle: "Tus dispositivos de audio",
    scanDevicesBody: "Salida: {output}. Micrófono: {input}.",
    none: "ninguno",
    duckingMute: "Windows silencia los demás sonidos durante las llamadas",
    duckingPercent: "Windows baja un {percent} % los demás sonidos durante las llamadas",
    duckingBody:
      "Mientras una app de llamadas usa el micrófono, el juego y la música bajan. Desactivarlo se aplica desde tu próxima llamada; apps como Discord mantienen su propio ajuste.",
    scanIdleTitle: "{device} se apaga tras {seconds} s de silencio",
    scanIdleLocked:
      "mantén {device} activo, que ahora en este PC se apaga tras {seconds} s de silencio",
    scanPowerTitle: "Windows puede apagar {device}",
    scanPowerLocked: "impide que Windows apague {device}",
    scanBtTitle: "¿El volumen Bluetooth no funciona bien?",
    scanBtBody:
      "Desactivar el volumen absoluto puede ayudar cuando el volumen Bluetooth no responde, se queda demasiado bajo o da saltos. Se aplica a todos los dispositivos Bluetooth, así que nunca forma parte de Corregir todo.",
    openAudio: "Abrir Audio",
  },
  de: {
    subtitle: "Sieh, was Windows mit deinem Ton macht, und behebe, was stört.",
    heroTitle: "Sound auf diesem PC",
    statDevices: "Genutzte Geräte",
    statFindings: "Zu prüfen",
    statClear: "Alles in Ordnung",
    statFixes: "Aktive Korrekturen",
    crackleWait:
      "Misst 10 Sekunden lang. Nutze den PC wie gewohnt – wenn du Knacken hörst, spiel jetzt etwas ab.",
    cracklePeak: "{kind}-Spitze",
    crackleLimit: "Microsofts Grenze: {value}",
    crackleTimesOver: "Überschreitungen: {count}",
    crackleLegend:
      "Jeder Balken zeigt die längste Routine eines Treibers während der Messung, die Markierung Microsofts Grenze.",
    micro: "{value} µs",
    devicesTitle: "Deine Geräte",
    output: "Ausgabe",
    input: "Mikrofon",
    defaultLabel: "Standard",
    commsLabel: "Anrufe",
    bus: { bluetooth: "Bluetooth", usb: "USB", internal: "Eingebaut", other: "Sonstige" },
    rate: "{rate} kHz",
    bits: "{bits} Bit",
    float: "{bits} Bit Gleitkomma",
    stereo: "Stereo",
    mono: "Mono",
    channels: "{count} Kanäle",
    effectsOn: "Effekte an",
    effectsOff: "Effekte aus",
    spatialOn: "Raumklang an",
    spatialOff: "Raumklang aus",
    eqActive: "Equalizer APO aktiv",
    eqBypassed: "Equalizer APO umgangen",
    deviceSettings: "Windows-Einstellungen für dieses Gerät",
    noDevices: "Windows meldet keine aktive Ausgabe und kein aktives Mikrofon.",
    findingsTitle: "Befunde",
    noFindings: "Nichts zu melden bei deinen Audiogeräten.",
    callModeTitle: "{device} ist im Anrufmodus",
    callModeBody:
      "{process} nutzt sein Mikrofon, daher hat Windows das Headset auf sein Anrufprofil umgestellt und die Wiedergabe fällt auf Anrufqualität. Wähle in dieser App ein anderes Mikrofon, um die volle Qualität zurückzubekommen.",
    soundSettings: "Soundeinstellungen",
    micMuted: "Dein Standardmikrofon ist stummgeschaltet",
    micLow: "Dein Standardmikrofon steht auf {level} %",
    micBody:
      "{name}. PC Tweaker ändert das nie von selbst: Ein leises oder stummes Mikrofon kann gewollt sein.",
    effectsOffTitle: "Effekte sind auf {name} ausgeschaltet",
    effectsOffBody:
      "Windows meldet die Audioverbesserungen für dieses Gerät als ausgeschaltet. Windows schaltet sie auch selbst aus, wenn ein Effekt wiederholt nicht geladen werden kann.",
    eapoBypassedTitle: "Equalizer APO wird auf {name} umgangen",
    eapoBypassedBody:
      "Equalizer APO ist auf diesem Gerät eingerichtet, aber Windows hat die Effekte dafür ausgeschaltet, deshalb läuft der Equalizer nicht.",
    eapoInactiveTitle: "Equalizer APO ist installiert, aber auf {name} nicht aktiv",
    eapoInactiveBody:
      "Es wirkt nur auf Geräten, die du in seinem Device Selector anhakst, und ein Treiber- oder Windows-Update kann einem Gerät eine neue ID geben.",
    eapoStale:
      "Alte Einrichtungen für Geräte, die es nicht mehr gibt: {count}. Ein Treiber- oder Windows-Update kann einem Gerät eine neue ID geben; schalte Equalizer APO im Device Selector wieder ein.",
    openSelector: "Device Selector von Equalizer APO öffnen",
    fixesTitle: "Korrekturen",
    fixesLead: "Jede Änderung wird aufgezeichnet und lässt sich mit einem Klick zurücksetzen.",
    idleName: "{device} im Netzbetrieb wach halten",
    idleHdmi: "HDMI-Audio wach halten",
    idleChip: "Soundchip wach halten",
    powerShort: "USB-Audio eingeschaltet lassen",
    idleBody:
      "Im Netzbetrieb schaltet Windows dieses Gerät nach {seconds} s Stille ab. Kann helfen, wenn der Anfang eines Tons abgeschnitten wird oder es beim Start der Wiedergabe knackt. Der Akku-Timer bleibt unverändert.",
    idleApplied: "Bleibt im Netzbetrieb wach. Der Akku-Timer bleibt unverändert.",
    idleRestartNote:
      "Wirkt, wenn das Gerät neu startet: beim nächsten Windows-Neustart oder jetzt.",
    restartDevice: "Dieses Audiogerät jetzt neu starten",
    restarting: "Neustart …",
    restarted: "{device} wurde neu gestartet. Der Ton kann kurz ausgesetzt haben.",
    powerName: "Windows daran hindern, {device} abzuschalten",
    powerBody:
      "Windows darf dieses USB-Audiogerät zum Energiesparen abschalten (Geräte-Manager, Registerkarte Energieverwaltung). Kann helfen, wenn es nach Stille aussetzt oder sich neu verbindet.",
    powerApplied: "Windows schaltet dieses Gerät nicht mehr zum Energiesparen ab.",
    modernStandby:
      "Dieser PC nutzt Modern Standby. Microsoft rät davon ab, diese Einstellung auf solchen PCs zu ändern: Der Akku kann sich deutlich schneller leeren.",
    noDeviceFixes: "Auf diesem PC schaltet Windows kein Audiogerät nach Stille ab.",
    crackleTitle: "Auf Knacken prüfen",
    crackleBody:
      "Misst 10 Sekunden lang, wie lange jeder Treiber den Prozessor belegt, gemessen an Microsofts Grenzen (DPC 100 µs, ISR 25 µs), gruppiert nach der Hardware, die er bedient. Benötigt Administratorrechte.",
    crackleRun: "Auf Knacken prüfen (10 s)",
    crackleRunning: "Misst 10 s …",
    crackleOk: "Kein Treiber hat während der Messung Microsofts Grenzen überschritten.",
    crackleOver: "Treiber über Microsofts Grenzen: {count}",
    crackleAudible: "Kann hörbar sein",
    crackleNote:
      "Wer die Grenze überschreitet, ist verdächtig, aber nicht als Ursache bewiesen: Teste, indem du den Treiber aktualisierst oder das Gerät deaktivierst, das er bedient, und miss dann erneut.",
    unattributed: "Nicht zugeordnet",
    areas: {
      audio: ["Audio", "Aktualisiere den Audiotreiber vom Hersteller deines PCs oder Mainboards."],
      graphics: ["Grafik", "Aktualisiere den Grafiktreiber oder installiere ihn sauber neu."],
      network: [
        "Netzwerk",
        "Aktualisiere den Netzwerktreiber und miss dann mit ausgeschaltetem WLAN erneut.",
      ],
      storage: ["Speicher", "Aktualisiere den Speichertreiber und die Firmware des Laufwerks."],
      usb: ["USB", "Schließe das USB-Audiogerät an einen anderen Anschluss oder Controller an."],
      bluetooth: ["Bluetooth", "Aktualisiere den Bluetooth-Treiber."],
      platform: [
        "Plattform",
        "Aktualisiere das BIOS und den Chipsatztreiber. Bei Laptops kann hier die Akkuabfrage auftauchen.",
      ],
      ambiguous: [
        "Windows-Komponenten",
        "Eine Windows-Komponente oder der Kernel: Der eigentliche Treiber arbeitet dahinter.",
      ],
      other: [
        "Sonstige",
        "Finde heraus, zu welchem Gerät dieser Treiber gehört, und aktualisiere ihn.",
      ],
    },
    eapoTitle: "Equalizer APO",
    eapoAbout:
      "Kostenloser Open-Source-Equalizer von Jonas Thedering. Software eines Drittanbieters, weder von PC Tweaker entwickelt noch mit PC Tweaker verbunden; PC Tweaker liest nur seinen Zustand.",
    eapoInstalled: "Installiert",
    eapoVersion: "Installiert, Version {version}",
    eapoOnDevice: "{name}: {state}",
    eapoStateActive: "aktiv",
    eapoStateBypassed: "umgangen, Effekte sind aus",
    eapoStateNone: "nicht aktiv",
    eapoSelectorNote: "Der Device Selector fragt selbst nach Administratorrechten.",
    eapoSelectorMissing: "Sein Device Selector wurde im Installationsordner nicht gefunden.",
    readError: "Deine Audiogeräte konnten nicht gelesen werden.",
    retry: "Erneut versuchen",
    scanDevicesTitle: "Deine Audiogeräte",
    scanDevicesBody: "Ausgabe: {output}. Mikrofon: {input}.",
    none: "keins",
    duckingMute: "Windows schaltet andere Töne bei Anrufen stumm",
    duckingPercent: "Windows senkt andere Töne bei Anrufen um {percent} %",
    duckingBody:
      "Während eine Anruf-App das Mikrofon nutzt, werden Spiel und Musik leiser. Das Ausschalten gilt ab deinem nächsten Anruf; Apps wie Discord behalten ihre eigene Einstellung.",
    scanIdleTitle: "{device} schaltet nach {seconds} s Stille ab",
    scanIdleLocked:
      "{device} wach halten, das auf diesem PC jetzt nach {seconds} s Stille abschaltet",
    scanPowerTitle: "Windows darf {device} abschalten",
    scanPowerLocked: "Windows daran hindern, {device} abzuschalten",
    scanBtTitle: "Bluetooth-Lautstärke funktioniert nicht richtig?",
    scanBtBody:
      "Die absolute Lautstärke auszuschalten kann helfen, wenn die Bluetooth-Lautstärke nicht reagiert, zu leise bleibt oder springt. Das gilt für alle Bluetooth-Geräte, deshalb ist es nie Teil von Alles beheben.",
    openAudio: "Audio öffnen",
  },
  pt: {
    subtitle: "Veja o que o Windows faz com o som e corrija o que atrapalha.",
    heroTitle: "O som deste PC",
    statDevices: "Dispositivos em uso",
    statFindings: "A rever",
    statClear: "Tudo em ordem",
    statFixes: "Correções ativas",
    crackleWait:
      "A medir durante 10 segundos. Use o PC como habitualmente; se ouvir estalidos, reproduza algum som agora.",
    cracklePeak: "Pico {kind}",
    crackleLimit: "Limite da Microsoft: {value}",
    crackleTimesOver: "Vezes excedido: {count}",
    crackleLegend:
      "Cada barra é a rotina mais longa de um driver durante a medição; a marca indica o limite da Microsoft.",
    micro: "{value} µs",
    devicesTitle: "Os seus dispositivos",
    output: "Saída",
    input: "Microfone",
    defaultLabel: "Predefinido",
    commsLabel: "Chamadas",
    bus: { bluetooth: "Bluetooth", usb: "USB", internal: "Integrado", other: "Outro" },
    rate: "{rate} kHz",
    bits: "{bits} bits",
    float: "{bits} bits de vírgula flutuante",
    stereo: "estéreo",
    mono: "mono",
    channels: "{count} canais",
    effectsOn: "Efeitos ativados",
    effectsOff: "Efeitos desativados",
    spatialOn: "Som espacial ativado",
    spatialOff: "Som espacial desativado",
    eqActive: "Equalizer APO ativo",
    eqBypassed: "Equalizer APO ignorado",
    deviceSettings: "Definições do Windows para este dispositivo",
    noDevices: "O Windows não indica nenhuma saída nem microfone ativos.",
    findingsTitle: "Resultados",
    noFindings: "Nada a assinalar nos seus dispositivos de áudio.",
    callModeTitle: "{device} está em modo de chamada",
    callModeBody:
      "{process} está a usar o microfone, por isso o Windows passou os auscultadores para o perfil de chamada e a reprodução desce para qualidade de chamada. Escolha outro microfone nessa aplicação para recuperar a qualidade total.",
    soundSettings: "Definições de som",
    micMuted: "O microfone predefinido está sem som",
    micLow: "O microfone predefinido está a {level}%",
    micBody:
      "{name}. O PC Tweaker nunca o altera por iniciativa própria: um microfone baixo ou sem som pode ser intencional.",
    effectsOffTitle: "Os efeitos estão desativados em {name}",
    effectsOffBody:
      "O Windows indica que as melhorias de áudio estão desativadas para este dispositivo. O Windows também as desativa sozinho quando um efeito falha repetidamente ao carregar.",
    eapoBypassedTitle: "O Equalizer APO está ignorado em {name}",
    eapoBypassedBody:
      "O Equalizer APO está configurado neste dispositivo, mas o Windows tem os efeitos desativados, por isso o equalizador não funciona.",
    eapoInactiveTitle: "O Equalizer APO está instalado mas não ativo em {name}",
    eapoInactiveBody:
      "Só funciona nos dispositivos que assinalar no respetivo Device Selector, e uma atualização de controladores ou do Windows pode dar um novo ID a um dispositivo.",
    eapoStale:
      "Configurações antigas de dispositivos que já não existem: {count}. Uma atualização do driver ou do Windows pode dar ao dispositivo um novo identificador; volte a ativar o Equalizer APO no Device Selector.",
    openSelector: "Abrir o Device Selector do Equalizer APO",
    fixesTitle: "Correções",
    fixesLead: "Cada alteração fica guardada e pode ser reposta com um clique.",
    idleName: "Manter {device} ativo com corrente",
    idleHdmi: "Manter o áudio HDMI ativo",
    idleChip: "Manter o chip de som ativo",
    powerShort: "Manter o áudio USB ligado",
    idleBody:
      "Ligado à corrente, o Windows desliga este dispositivo após {seconds} s de silêncio. Pode ajudar se o início de um som for cortado ou se ouvir um estalido quando o som começa. O temporizador com bateria não muda.",
    idleApplied: "Fica ativo com corrente. O temporizador com bateria não muda.",
    idleRestartNote:
      "Tem efeito quando o dispositivo reinicia: no próximo reinício do Windows, ou agora.",
    restartDevice: "Reiniciar agora este dispositivo de áudio",
    restarting: "A reiniciar…",
    restarted: "{device} foi reiniciado. O som pode ter parado por um instante.",
    powerName: "Impedir o Windows de desligar {device}",
    powerBody:
      "O Windows pode desligar este dispositivo de áudio USB para poupar energia (Gestor de Dispositivos, separador Gestão de energia). Pode ajudar se falhar ou voltar a ligar-se após um silêncio.",
    powerApplied: "O Windows já não desliga este dispositivo para poupar energia.",
    modernStandby:
      "Este PC usa o Modern Standby. A Microsoft desaconselha alterar esta definição nestes PC: pode gastar muito a bateria.",
    noDeviceFixes: "Neste PC, o Windows não desliga nenhum dispositivo de áudio após um silêncio.",
    crackleTitle: "Procurar estalidos",
    crackleBody:
      "Mede durante 10 segundos quanto tempo cada driver ocupa o processador, face aos limites da Microsoft (DPC 100 µs, ISR 25 µs), agrupado pelo hardware que serve. Requer direitos de administrador.",
    crackleRun: "Procurar estalidos (10 s)",
    crackleRunning: "A medir durante 10 s…",
    crackleOk: "Nenhum driver excedeu os limites da Microsoft durante a medição.",
    crackleOver: "Drivers que excederam os limites da Microsoft: {count}",
    crackleAudible: "Pode ouvir-se",
    crackleNote:
      "Exceder o limite torna um driver suspeito, não a causa comprovada: teste atualizando-o ou desativando o dispositivo que serve, e volte a medir.",
    unattributed: "Sem atribuição",
    areas: {
      audio: [
        "Áudio",
        "Atualize o driver de áudio a partir do fabricante do PC ou da placa principal.",
      ],
      graphics: ["Gráficos", "Atualize ou reinstale de raiz o driver gráfico."],
      network: ["Rede", "Atualize o driver de rede e volte a medir com o Wi-Fi desligado."],
      storage: ["Armazenamento", "Atualize o driver de armazenamento e o firmware da unidade."],
      usb: ["USB", "Ligue o dispositivo de áudio USB a outra porta ou a outro controlador."],
      bluetooth: ["Bluetooth", "Atualize o driver Bluetooth."],
      platform: [
        "Plataforma",
        "Atualize a BIOS e o driver do chipset. Nos portáteis, a consulta da bateria pode aparecer aqui.",
      ],
      ambiguous: [
        "Componentes do Windows",
        "Um componente do Windows ou o kernel: o driver real trabalha por trás.",
      ],
      other: ["Outro", "Descubra a que dispositivo pertence este driver e atualize-o."],
    },
    eapoTitle: "Equalizer APO",
    eapoAbout:
      "Equalizador gratuito e de código aberto de Jonas Thedering. Software de terceiros, não criado pelo PC Tweaker nem associado ao PC Tweaker, que apenas lê o seu estado.",
    eapoInstalled: "Instalado",
    eapoVersion: "Instalado, versão {version}",
    eapoOnDevice: "{name}: {state}",
    eapoStateActive: "ativo",
    eapoStateBypassed: "ignorado, os efeitos estão desativados",
    eapoStateNone: "não ativo",
    eapoSelectorNote: "O Device Selector pede ele próprio direitos de administrador.",
    eapoSelectorMissing: "O Device Selector não foi encontrado na pasta de instalação.",
    readError: "Não foi possível ler os dispositivos de áudio.",
    retry: "Tentar novamente",
    scanDevicesTitle: "Os seus dispositivos de áudio",
    scanDevicesBody: "Saída: {output}. Microfone: {input}.",
    none: "nenhum",
    duckingMute: "O Windows silencia os outros sons durante as chamadas",
    duckingPercent: "O Windows reduz os outros sons em {percent}% durante as chamadas",
    duckingBody:
      "Enquanto uma aplicação de chamadas usa o microfone, o jogo e a música ficam mais baixos. Desativar aplica-se a partir da próxima chamada; aplicações como o Discord mantêm a sua própria definição.",
    scanIdleTitle: "{device} desliga-se após {seconds} s de silêncio",
    scanIdleLocked:
      "manter {device} ativo, que neste PC se desliga agora após {seconds} s de silêncio",
    scanPowerTitle: "O Windows pode desligar {device}",
    scanPowerLocked: "impedir o Windows de desligar {device}",
    scanBtTitle: "O volume Bluetooth não funciona bem?",
    scanBtBody:
      "Desativar o volume absoluto pode ajudar quando o volume Bluetooth não responde, fica demasiado baixo ou dá saltos. Aplica-se a todos os dispositivos Bluetooth, por isso nunca faz parte de Corrigir tudo.",
    openAudio: "Abrir Áudio",
  },
};
