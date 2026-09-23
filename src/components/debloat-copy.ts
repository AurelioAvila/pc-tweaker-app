import type { Lang } from "../i18n";

const en = {
  title: "Debloat with control",
  intro: "Choose optional Windows apps to remove from this account.",
  apps: "Windows apps",
  suggestions: "Suggestions & privacy",
  history: "History & recovery",
  scanning: "Checking installed apps…",
  scan: "Scan again",
  scanError: "The app list could not be read. Your selection was not changed.",
  empty: "No removable apps from this curated list are installed for this account.",
  noMatch: "No apps match your search.",
  search: "Search installed apps",
  selected: "selected",
  installed: "Installed",
  unavailable: "Unavailable",
  removable: "Removable",
  all: "All",
  filterLabel: "Filter apps",
  details: "Details",
  elevatedTitle: "App removal needs a normal session",
  publisherMismatch: "Publisher or signature does not match the verified Microsoft app.",
  protectedPackage: "Windows identifies this as a shared or protected package.",
  dependency: "Another installed app depends on this package.",
  nonRemovable: "Windows marks this package as non-removable.",
  unverifiedRemovability: "Windows could not verify whether this package can be removed.",
  requiresStandardUser:
    "Reopen PC Tweaker normally, without Run as administrator, to remove apps for your account.",
  currentUser: "Current Windows user only",
  scope:
    "Only this account is affected. Apps installed for other users and packages provisioned for new users stay as they are.",
  protectedTitle: "Core Windows components stay protected",
  protected:
    "Store, App Installer, frameworks, shell, security components, WebView2, and gaming services are excluded. OneDrive and system-wide removal need separate workflows.",
  choose: "Choose apps",
  preview: "Review removal",
  previewTitle: "Review exact packages",
  previewIntro:
    "These apps will be removed for the current Windows user. This can erase app settings or local data. Close the apps before continuing.",
  identity: "Package identity",
  cancel: "Cancel",
  remove: "Remove selected apps",
  removing: "Removing and verifying…",
  resultTitle: "Removal results",
  resultNote:
    "Each result checks the exact package identity. Confirmed absence does not prove which process removed it. If the state is unknown, scan again before deciding what to do.",
  removed: "Not installed (verified)",
  failed: "Failed",
  unknown: "State unknown",
  pending: "Pending verification",
  removalError: "The removal request failed. Check history and scan again before trying manually.",
  refreshError:
    "Removal finished, but the app list could not be refreshed. Scan again to verify the current state.",
  privacyTitle: "Use the existing Windows controls",
  privacyText:
    "Suggestions and privacy settings live in their existing categories and use the same saved-value rollback. Availability and effects vary by Windows version and edition.",
  openPrivacy: "Open privacy settings",
  openProfiles: "Open profiles",
  openRollback: "Open change history",
  privacyNote:
    "Removing an app does not turn off Windows suggestions or privacy settings. Settings rollback does not reinstall apps.",
  historyEmpty: "No app removals have been recorded yet.",
  loadingHistory: "Loading removal history…",
  historyError: "Removal history could not be read.",
  reloadHistory: "Reload history",
  recovery: "Open Microsoft Store page",
  recoveryError: "The verified Store link could not be opened.",
  recoveryNone: "No verified Store page is available for this app.",
  recoveryNote:
    "A Store reinstall may restore the app, but it cannot promise the original version, provisioning, settings, or local data. Store availability may vary.",
  dateUnknown: "Date unavailable",
  solitaire:
    "Casual games. Removing it may erase local game settings or progress; synced progress depends on your Microsoft account.",
  weather: "Weather forecasts and pinned weather views may need to be set up again.",
  news: "The News app and its local preferences may be lost.",
  copilot:
    "Removes the consumer Copilot app from this account. It does not change Windows Copilot policies or other AI features.",
  clipchamp:
    "Video editor. Back up local projects and media before removal; reinstalling may not restore them.",
  outlook: "Mail and calendar app. Accounts and app settings may need to be set up again.",
};
type Copy = typeof en;
export const DEBLOAT_COPY: Record<Lang, Copy> = {
  en,
  it: {
    title: "Debloat con controllo",
    intro: "Scegli le app Windows facoltative da rimuovere da questo account.",
    apps: "App Windows",
    suggestions: "Suggerimenti e privacy",
    history: "Cronologia e recupero",
    scanning: "Controllo delle app installate…",
    scan: "Ripeti scansione",
    scanError: "Impossibile leggere l’elenco delle app. La selezione non è cambiata.",
    empty: "Nessuna app rimovibile di questo elenco selezionato è installata per l’account.",
    noMatch: "Nessuna app corrisponde alla ricerca.",
    search: "Cerca tra le app installate",
    selected: "selezionate",
    installed: "Installata",
    unavailable: "Non disponibile",
    removable: "Rimovibile",
    all: "Tutte",
    filterLabel: "Filtra le app",
    details: "Dettagli",
    elevatedTitle: "La rimozione richiede una sessione normale",
    publisherMismatch: "Publisher o firma non corrispondono all’app Microsoft verificata.",
    protectedPackage: "Windows identifica questo pacchetto come condiviso o protetto.",
    dependency: "Un’altra app installata dipende da questo pacchetto.",
    nonRemovable: "Windows indica che questo pacchetto non è rimovibile.",
    unverifiedRemovability: "Windows non ha potuto verificare se il pacchetto è rimovibile.",
    requiresStandardUser:
      "Riapri PC Tweaker normalmente, senza Esegui come amministratore, per rimuovere app dal tuo account.",
    currentUser: "Solo utente Windows corrente",
    scope:
      "Cambia solo questo account. Le app degli altri utenti e i pacchetti predisposti per nuovi account restano invariati.",
    protectedTitle: "I componenti essenziali di Windows sono protetti",
    protected:
      "Store, App Installer, framework, shell, componenti di sicurezza, WebView2 e servizi gaming sono esclusi. OneDrive e la rimozione globale richiedono procedure separate.",
    choose: "Scegli le app",
    preview: "Rivedi la rimozione",
    previewTitle: "Controlla i pacchetti esatti",
    previewIntro:
      "Queste app verranno rimosse per l’utente Windows corrente. Impostazioni o dati locali potrebbero andare persi. Chiudi le app prima di continuare.",
    identity: "Identità del pacchetto",
    cancel: "Annulla",
    remove: "Rimuovi le app selezionate",
    removing: "Rimozione e verifica…",
    resultTitle: "Risultati della rimozione",
    resultNote:
      "Ogni risultato verifica l’identità esatta del pacchetto. L’assenza confermata non prova quale processo lo abbia rimosso. Se lo stato è sconosciuto, ripeti la scansione prima di decidere.",
    removed: "Non installata (verificato)",
    failed: "Non riuscita",
    unknown: "Stato sconosciuto",
    pending: "Verifica in sospeso",
    removalError:
      "La richiesta di rimozione non è riuscita. Controlla la cronologia e ripeti la scansione prima di riprovare manualmente.",
    refreshError:
      "Rimozione terminata, ma impossibile aggiornare l’elenco. Ripeti la scansione per verificare lo stato.",
    privacyTitle: "Usa i controlli Windows già presenti",
    privacyText:
      "Suggerimenti e privacy restano nelle categorie esistenti e usano lo stesso ripristino dei valori salvati. Disponibilità ed effetti variano con versione ed edizione di Windows.",
    openPrivacy: "Apri impostazioni privacy",
    openProfiles: "Apri profili",
    openRollback: "Apri cronologia modifiche",
    privacyNote:
      "Rimuovere un’app non disattiva suggerimenti o impostazioni privacy. Il rollback delle impostazioni non reinstalla le app.",
    historyEmpty: "Nessuna rimozione registrata.",
    loadingHistory: "Caricamento cronologia rimozioni…",
    historyError: "Impossibile leggere la cronologia delle rimozioni.",
    reloadHistory: "Ricarica cronologia",
    recovery: "Apri pagina Microsoft Store",
    recoveryError: "Impossibile aprire il link Store verificato.",
    recoveryNone: "Nessuna pagina Store verificata per questa app.",
    recoveryNote:
      "La reinstallazione dallo Store può ripristinare l’app, ma non garantisce versione, provisioning, impostazioni o dati locali originali. La disponibilità può variare.",
    dateUnknown: "Data non disponibile",
    solitaire:
      "Giochi casual. Impostazioni o progressi locali possono andare persi; quelli sincronizzati dipendono dall’account Microsoft.",
    weather: "Previsioni e viste meteo fissate potrebbero richiedere una nuova configurazione.",
    news: "L’app News e le sue preferenze locali potrebbero andare perse.",
    copilot:
      "Rimuove l’app Copilot consumer da questo account. Non cambia le policy di Windows Copilot o altre funzioni AI.",
    clipchamp:
      "Editor video. Salva progetti e file multimediali locali prima della rimozione: la reinstallazione potrebbe non recuperarli.",
    outlook:
      "App di posta e calendario. Account e impostazioni potrebbero richiedere una nuova configurazione.",
  },
  fr: {
    title: "Debloat sous contrôle",
    intro: "Choisissez les applications Windows facultatives à retirer de ce compte.",
    apps: "Applications Windows",
    suggestions: "Suggestions et confidentialité",
    history: "Historique et récupération",
    scanning: "Recherche des applications installées…",
    scan: "Relancer l’analyse",
    scanError: "Impossible de lire la liste des applications. Votre sélection n’a pas changé.",
    empty: "Aucune application amovible de cette sélection n’est installée pour ce compte.",
    noMatch: "Aucune application ne correspond à la recherche.",
    search: "Rechercher des applications installées",
    selected: "sélectionnées",
    installed: "Installée",
    unavailable: "Indisponible",
    removable: "Supprimable",
    all: "Toutes",
    filterLabel: "Filtrer les applications",
    details: "Détails",
    elevatedTitle: "La suppression nécessite une session normale",
    publisherMismatch:
      "L’éditeur ou la signature ne correspond pas à l’application Microsoft vérifiée.",
    protectedPackage: "Windows considère ce package comme partagé ou protégé.",
    dependency: "Une autre application installée dépend de ce package.",
    nonRemovable: "Windows indique que ce package ne peut pas être supprimé.",
    unverifiedRemovability: "Windows n’a pas pu vérifier si ce package peut être supprimé.",
    requiresStandardUser:
      "Rouvrez PC Tweaker normalement, sans Exécuter en tant qu’administrateur, pour supprimer des applications de votre compte.",
    currentUser: "Utilisateur Windows actuel uniquement",
    scope:
      "Seul ce compte est concerné. Les applications des autres utilisateurs et les packages prévus pour les nouveaux comptes restent inchangés.",
    protectedTitle: "Les composants essentiels de Windows sont protégés",
    protected:
      "Store, App Installer, infrastructures, shell, sécurité, WebView2 et services de jeu sont exclus. OneDrive et la suppression globale exigent des procédures distinctes.",
    choose: "Choisir les applications",
    preview: "Vérifier la suppression",
    previewTitle: "Vérifier les packages exacts",
    previewIntro:
      "Ces applications seront supprimées pour l’utilisateur Windows actuel. Des paramètres ou données locales peuvent être perdus. Fermez les applications avant de continuer.",
    identity: "Identité du package",
    cancel: "Annuler",
    remove: "Supprimer les applications sélectionnées",
    removing: "Suppression et vérification…",
    resultTitle: "Résultats de la suppression",
    resultNote:
      "Chaque résultat vérifie l’identité exacte du package. Son absence confirmée ne prouve pas quel processus l’a supprimé. Si l’état est inconnu, relancez l’analyse avant de décider.",
    removed: "Absente (vérifié)",
    failed: "Échec",
    unknown: "État inconnu",
    pending: "Vérification en attente",
    removalError:
      "La demande de suppression a échoué. Consultez l’historique et relancez l’analyse avant de réessayer manuellement.",
    refreshError:
      "Suppression terminée, mais la liste n’a pas pu être actualisée. Relancez l’analyse pour vérifier l’état.",
    privacyTitle: "Utiliser les contrôles Windows existants",
    privacyText:
      "Suggestions et confidentialité restent dans leurs catégories et utilisent la même restauration des valeurs sauvegardées. Leur disponibilité et leurs effets varient selon la version et l’édition de Windows.",
    openPrivacy: "Ouvrir la confidentialité",
    openProfiles: "Ouvrir les profils",
    openRollback: "Ouvrir l’historique des modifications",
    privacyNote:
      "Supprimer une application ne désactive pas les suggestions ni les paramètres de confidentialité. Restaurer un paramètre ne réinstalle pas une application.",
    historyEmpty: "Aucune suppression enregistrée.",
    loadingHistory: "Chargement de l’historique des suppressions…",
    historyError: "Impossible de lire l’historique des suppressions.",
    reloadHistory: "Recharger l’historique",
    recovery: "Ouvrir la page Microsoft Store",
    recoveryError: "Impossible d’ouvrir le lien Store vérifié.",
    recoveryNone: "Aucune page Store vérifiée pour cette application.",
    recoveryNote:
      "Une réinstallation depuis le Store peut restaurer l’application, sans garantir sa version, son provisionnement, ses paramètres ou ses données d’origine. La disponibilité peut varier.",
    dateUnknown: "Date indisponible",
    solitaire:
      "Jeux occasionnels. Les paramètres ou progrès locaux peuvent être perdus ; les progrès synchronisés dépendent du compte Microsoft.",
    weather:
      "Les prévisions et vues météo épinglées peuvent nécessiter une nouvelle configuration.",
    news: "L’application News et ses préférences locales peuvent être perdues.",
    copilot:
      "Supprime l’application Copilot grand public de ce compte. Les stratégies Windows Copilot et les autres fonctions d’IA ne changent pas.",
    clipchamp:
      "Éditeur vidéo. Sauvegardez les projets et médias locaux avant la suppression ; une réinstallation peut ne pas les restaurer.",
    outlook:
      "Application de messagerie et calendrier. Il peut falloir reconfigurer les comptes et paramètres.",
  },
  es: {
    title: "Debloat con control",
    intro: "Elige las aplicaciones Windows opcionales que quieres quitar de esta cuenta.",
    apps: "Aplicaciones Windows",
    suggestions: "Sugerencias y privacidad",
    history: "Historial y recuperación",
    scanning: "Comprobando aplicaciones instaladas…",
    scan: "Volver a analizar",
    scanError: "No se pudo leer la lista de aplicaciones. La selección no cambió.",
    empty: "No hay aplicaciones extraíbles de esta lista seleccionada instaladas para esta cuenta.",
    noMatch: "No hay aplicaciones que coincidan con la búsqueda.",
    search: "Buscar aplicaciones instaladas",
    selected: "seleccionadas",
    installed: "Instalada",
    unavailable: "No disponible",
    removable: "Se puede quitar",
    all: "Todas",
    filterLabel: "Filtrar aplicaciones",
    details: "Detalles",
    elevatedTitle: "Para quitar apps se necesita una sesión normal",
    publisherMismatch: "El editor o la firma no coinciden con la aplicación Microsoft verificada.",
    protectedPackage: "Windows identifica este paquete como compartido o protegido.",
    dependency: "Otra aplicación instalada depende de este paquete.",
    nonRemovable: "Windows indica que este paquete no se puede eliminar.",
    unverifiedRemovability: "Windows no pudo verificar si se puede eliminar este paquete.",
    requiresStandardUser:
      "Vuelve a abrir PC Tweaker normalmente, sin Ejecutar como administrador, para eliminar aplicaciones de tu cuenta.",
    currentUser: "Solo el usuario actual de Windows",
    scope:
      "Solo afecta a esta cuenta. Las aplicaciones de otros usuarios y los paquetes preparados para cuentas nuevas siguen igual.",
    protectedTitle: "Los componentes esenciales de Windows están protegidos",
    protected:
      "Store, App Installer, marcos, shell, seguridad, WebView2 y servicios de juego están excluidos. OneDrive y la eliminación global requieren procesos aparte.",
    choose: "Elegir aplicaciones",
    preview: "Revisar eliminación",
    previewTitle: "Revisar paquetes exactos",
    previewIntro:
      "Estas aplicaciones se eliminarán para el usuario actual de Windows. Podrían perderse ajustes o datos locales. Cierra las aplicaciones antes de continuar.",
    identity: "Identidad del paquete",
    cancel: "Cancelar",
    remove: "Eliminar aplicaciones seleccionadas",
    removing: "Eliminando y verificando…",
    resultTitle: "Resultados de la eliminación",
    resultNote:
      "Cada resultado comprueba la identidad exacta del paquete. La ausencia confirmada no prueba qué proceso lo eliminó. Si el estado es desconocido, vuelve a analizar antes de decidir.",
    removed: "No instalada (verificado)",
    failed: "Error",
    unknown: "Estado desconocido",
    pending: "Verificación pendiente",
    removalError:
      "Falló la solicitud de eliminación. Comprueba el historial y vuelve a analizar antes de reintentar manualmente.",
    refreshError:
      "Terminó la eliminación, pero no se pudo actualizar la lista. Vuelve a analizar para verificar el estado.",
    privacyTitle: "Usa los controles de Windows existentes",
    privacyText:
      "Sugerencias y privacidad siguen en sus categorías y usan la misma restauración de valores guardados. La disponibilidad y los efectos varían según la versión y edición de Windows.",
    openPrivacy: "Abrir privacidad",
    openProfiles: "Abrir perfiles",
    openRollback: "Abrir historial de cambios",
    privacyNote:
      "Eliminar una aplicación no desactiva sugerencias ni ajustes de privacidad. Revertir ajustes no reinstala aplicaciones.",
    historyEmpty: "Aún no hay eliminaciones registradas.",
    loadingHistory: "Cargando el historial de eliminaciones…",
    historyError: "No se pudo leer el historial de eliminaciones.",
    reloadHistory: "Recargar historial",
    recovery: "Abrir página de Microsoft Store",
    recoveryError: "No se pudo abrir el enlace verificado de Store.",
    recoveryNone: "No hay página de Store verificada para esta aplicación.",
    recoveryNote:
      "Reinstalar desde Store puede recuperar la aplicación, pero no garantiza versión, aprovisionamiento, ajustes ni datos locales originales. La disponibilidad puede variar.",
    dateUnknown: "Fecha no disponible",
    solitaire:
      "Juegos casuales. Pueden perderse ajustes o progreso locales; el progreso sincronizado depende de la cuenta Microsoft.",
    weather:
      "Las previsiones y vistas del tiempo ancladas pueden necesitar configuración de nuevo.",
    news: "La aplicación News y sus preferencias locales pueden perderse.",
    copilot:
      "Elimina la aplicación Copilot de consumo de esta cuenta. No cambia las directivas de Windows Copilot ni otras funciones de IA.",
    clipchamp:
      "Editor de vídeo. Guarda proyectos y archivos locales antes de eliminarlo; reinstalar quizá no los recupere.",
    outlook:
      "Aplicación de correo y calendario. Puede que debas configurar de nuevo cuentas y ajustes.",
  },
  de: {
    title: "Debloat mit Kontrolle",
    intro: "Wählen Sie optionale Windows-Apps, die aus diesem Konto entfernt werden sollen.",
    apps: "Windows-Apps",
    suggestions: "Vorschläge und Datenschutz",
    history: "Verlauf und Wiederherstellung",
    scanning: "Installierte Apps werden geprüft…",
    scan: "Erneut prüfen",
    scanError: "Die App-Liste konnte nicht gelesen werden. Die Auswahl blieb unverändert.",
    empty:
      "Für dieses Konto sind keine entfernbaren Apps aus dieser kuratierten Liste installiert.",
    noMatch: "Keine Apps entsprechen der Suche.",
    search: "Installierte Apps suchen",
    selected: "ausgewählt",
    installed: "Installiert",
    unavailable: "Nicht verfügbar",
    removable: "Entfernbar",
    all: "Alle",
    filterLabel: "Apps filtern",
    details: "Einzelheiten",
    elevatedTitle: "Zum Entfernen ist eine normale Sitzung nötig",
    publisherMismatch:
      "Herausgeber oder Signatur stimmen nicht mit der geprüften Microsoft-App überein.",
    protectedPackage: "Windows erkennt dieses Paket als gemeinsam genutzt oder geschützt.",
    dependency: "Eine andere installierte App benötigt dieses Paket.",
    nonRemovable: "Windows kennzeichnet dieses Paket als nicht entfernbar.",
    unverifiedRemovability: "Windows konnte nicht prüfen, ob dieses Paket entfernt werden kann.",
    requiresStandardUser:
      "Starten Sie PC Tweaker normal, ohne Als Administrator ausführen, um Apps für Ihr Konto zu entfernen.",
    currentUser: "Nur aktueller Windows-Benutzer",
    scope:
      "Nur dieses Konto ist betroffen. Apps anderer Benutzer und für neue Konten bereitgestellte Pakete bleiben unverändert.",
    protectedTitle: "Wichtige Windows-Komponenten sind geschützt",
    protected:
      "Store, App Installer, Frameworks, Shell, Sicherheitskomponenten, WebView2 und Gaming-Dienste sind ausgeschlossen. OneDrive und systemweites Entfernen brauchen eigene Abläufe.",
    choose: "Apps auswählen",
    preview: "Entfernen prüfen",
    previewTitle: "Genaue Pakete prüfen",
    previewIntro:
      "Diese Apps werden für den aktuellen Windows-Benutzer entfernt. Einstellungen oder lokale Daten können verloren gehen. Schließen Sie die Apps zuerst.",
    identity: "Paketidentität",
    cancel: "Abbrechen",
    remove: "Ausgewählte Apps entfernen",
    removing: "Entfernen und Prüfen…",
    resultTitle: "Ergebnisse",
    resultNote:
      "Jedes Ergebnis prüft die genaue Paketidentität. Die bestätigte Abwesenheit belegt nicht, welcher Prozess es entfernt hat. Bei unbekanntem Status prüfen Sie erneut, bevor Sie entscheiden.",
    removed: "Nicht installiert (bestätigt)",
    failed: "Fehlgeschlagen",
    unknown: "Status unbekannt",
    pending: "Prüfung ausstehend",
    removalError:
      "Die Entfernungsanfrage ist fehlgeschlagen. Prüfen Sie den Verlauf und suchen Sie erneut, bevor Sie manuell wiederholen.",
    refreshError:
      "Entfernung abgeschlossen, aber die Liste konnte nicht aktualisiert werden. Prüfen Sie den Status erneut.",
    privacyTitle: "Vorhandene Windows-Einstellungen verwenden",
    privacyText:
      "Vorschläge und Datenschutz bleiben in ihren Kategorien und nutzen dieselbe Wiederherstellung gespeicherter Werte. Verfügbarkeit und Wirkung hängen von Windows-Version und Edition ab.",
    openPrivacy: "Datenschutz öffnen",
    openProfiles: "Profile öffnen",
    openRollback: "Änderungsverlauf öffnen",
    privacyNote:
      "Das Entfernen einer App deaktiviert keine Vorschläge oder Datenschutzeinstellungen. Das Zurücksetzen von Einstellungen installiert Apps nicht neu.",
    historyEmpty: "Noch keine Entfernungen erfasst.",
    loadingHistory: "Entfernungsverlauf wird geladen…",
    historyError: "Der Entfernungsverlauf konnte nicht gelesen werden.",
    reloadHistory: "Verlauf neu laden",
    recovery: "Microsoft-Store-Seite öffnen",
    recoveryError: "Der geprüfte Store-Link konnte nicht geöffnet werden.",
    recoveryNone: "Für diese App ist keine geprüfte Store-Seite verfügbar.",
    recoveryNote:
      "Eine Store-Neuinstallation kann die App zurückbringen, garantiert aber weder ursprüngliche Version und Bereitstellung noch Einstellungen und lokale Daten. Die Verfügbarkeit kann variieren.",
    dateUnknown: "Datum nicht verfügbar",
    solitaire:
      "Gelegenheitsspiele. Lokale Einstellungen oder Fortschritte können verloren gehen; synchronisierter Fortschritt hängt vom Microsoft-Konto ab.",
    weather:
      "Wettervorhersagen und angeheftete Wetteransichten müssen eventuell neu eingerichtet werden.",
    news: "Die News-App und ihre lokalen Einstellungen können verloren gehen.",
    copilot:
      "Entfernt die Copilot-App für Privatnutzer aus diesem Konto. Windows-Copilot-Richtlinien und andere KI-Funktionen bleiben unverändert.",
    clipchamp:
      "Videoeditor. Sichern Sie lokale Projekte und Medien vor dem Entfernen; eine Neuinstallation stellt sie möglicherweise nicht wieder her.",
    outlook:
      "Mail- und Kalender-App. Konten und App-Einstellungen müssen eventuell neu eingerichtet werden.",
  },
  pt: {
    title: "Debloat com controlo",
    intro: "Escolha aplicações Windows opcionais para remover desta conta.",
    apps: "Aplicações Windows",
    suggestions: "Sugestões e privacidade",
    history: "Histórico e recuperação",
    scanning: "A verificar aplicações instaladas…",
    scan: "Analisar novamente",
    scanError: "Não foi possível ler a lista de aplicações. A seleção não foi alterada.",
    empty: "Não há aplicações removíveis desta lista selecionada instaladas nesta conta.",
    noMatch: "Nenhuma aplicação corresponde à pesquisa.",
    search: "Pesquisar aplicações instaladas",
    selected: "selecionadas",
    installed: "Instalada",
    unavailable: "Indisponível",
    removable: "Removível",
    all: "Todas",
    filterLabel: "Filtrar aplicações",
    details: "Detalhes",
    elevatedTitle: "A remoção requer uma sessão normal",
    publisherMismatch:
      "O editor ou a assinatura não correspondem à aplicação Microsoft verificada.",
    protectedPackage: "O Windows identifica este pacote como partilhado ou protegido.",
    dependency: "Outra aplicação instalada depende deste pacote.",
    nonRemovable: "O Windows marca este pacote como não removível.",
    unverifiedRemovability: "O Windows não conseguiu verificar se este pacote pode ser removido.",
    requiresStandardUser:
      "Reabra o PC Tweaker normalmente, sem Executar como administrador, para remover aplicações da sua conta.",
    currentUser: "Apenas o utilizador atual do Windows",
    scope:
      "Só esta conta é afetada. As aplicações de outros utilizadores e os pacotes preparados para novas contas permanecem iguais.",
    protectedTitle: "Os componentes essenciais do Windows estão protegidos",
    protected:
      "Store, App Installer, frameworks, shell, segurança, WebView2 e serviços de jogos estão excluídos. OneDrive e a remoção global exigem processos separados.",
    choose: "Escolher aplicações",
    preview: "Rever remoção",
    previewTitle: "Rever pacotes exatos",
    previewIntro:
      "Estas aplicações serão removidas para o utilizador atual do Windows. Definições ou dados locais podem perder-se. Feche as aplicações antes de continuar.",
    identity: "Identidade do pacote",
    cancel: "Cancelar",
    remove: "Remover aplicações selecionadas",
    removing: "A remover e verificar…",
    resultTitle: "Resultados da remoção",
    resultNote:
      "Cada resultado verifica a identidade exata do pacote. A ausência confirmada não prova que processo o removeu. Se o estado for desconhecido, analise novamente antes de decidir.",
    removed: "Não instalada (verificado)",
    failed: "Falhou",
    unknown: "Estado desconhecido",
    pending: "Verificação pendente",
    removalError:
      "O pedido de remoção falhou. Consulte o histórico e analise novamente antes de repetir manualmente.",
    refreshError:
      "A remoção terminou, mas a lista não pôde ser atualizada. Analise novamente para verificar o estado.",
    privacyTitle: "Use os controlos Windows existentes",
    privacyText:
      "Sugestões e privacidade permanecem nas categorias existentes e usam o mesmo restauro dos valores guardados. A disponibilidade e os efeitos variam com a versão e edição do Windows.",
    openPrivacy: "Abrir privacidade",
    openProfiles: "Abrir perfis",
    openRollback: "Abrir histórico de alterações",
    privacyNote:
      "Remover uma aplicação não desativa sugestões nem definições de privacidade. Reverter definições não reinstala aplicações.",
    historyEmpty: "Ainda não há remoções registadas.",
    loadingHistory: "A carregar o histórico de remoções…",
    historyError: "Não foi possível ler o histórico de remoções.",
    reloadHistory: "Recarregar histórico",
    recovery: "Abrir página da Microsoft Store",
    recoveryError: "Não foi possível abrir a ligação Store verificada.",
    recoveryNone: "Não há página Store verificada para esta aplicação.",
    recoveryNote:
      "Reinstalar pela Store pode recuperar a aplicação, mas não garante a versão, o aprovisionamento, as definições ou os dados locais originais. A disponibilidade pode variar.",
    dateUnknown: "Data indisponível",
    solitaire:
      "Jogos casuais. Definições ou progresso locais podem perder-se; o progresso sincronizado depende da conta Microsoft.",
    weather: "Previsões e vistas meteorológicas afixadas podem precisar de nova configuração.",
    news: "A aplicação News e as suas preferências locais podem perder-se.",
    copilot:
      "Remove a aplicação Copilot pessoal desta conta. Não altera as políticas do Windows Copilot nem outras funções de IA.",
    clipchamp:
      "Editor de vídeo. Guarde projetos e ficheiros locais antes de remover; a reinstalação pode não os recuperar.",
    outlook:
      "Aplicação de correio e calendário. Contas e definições podem precisar de nova configuração.",
  },
};

export const DEBLOAT_IMPACT: Record<
  string,
  keyof Pick<Copy, "solitaire" | "weather" | "news" | "copilot" | "clipchamp" | "outlook">
> = {
  solitaire: "solitaire",
  weather: "weather",
  news: "news",
  copilot: "copilot",
  clipchamp: "clipchamp",
  outlook: "outlook",
};
