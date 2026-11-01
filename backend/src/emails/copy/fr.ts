import type { Copy } from "./index";

/** Français : vouvoiement, comme les applications ; libellés identiques à l'interface. */
const named = (lead: string, n: string, end = ".") => (n ? `${lead}, ${n}${end}` : `${lead}${end}`);

export const fr: Copy = {
  tag: "fr",
  dateLocale: "fr-FR",

  shell: {
    writeTo: (address: string) => `Écrivez à ${address} ou répondez à cet e-mail.`,
    expectation: "Nous lisons tout et répondons en général sous un jour ouvré.",
    neverSend: "N’envoyez jamais de mot de passe ni de numéro de carte par e-mail.",
    questions: "Des questions ?",
    family: "Un seul compte pour PC Tweaker, PC Tweaker Uninstaller et Tweaky Driver.",
    support: "Assistance",
    privacy: "Confidentialité",
    terms: "Conditions",
    linkFallback: "Si le bouton ne s’ouvre pas, copiez cette adresse dans votre navigateur :",
    ifYou: "Si c’était vous :",
    ifNot: "Si ce n’était pas vous :",
    unsubscribe: "Se désabonner",
  },

  plans: { monthly: "Pro, mensuel", annual: "Pro, annuel", lifetime: "Pro, à vie" },

  verify: {
    subject: (b: string) => `Confirmez votre adresse e-mail pour ${b}`,
    preheader: "Un clic confirme cette adresse. Le lien est valable 24 heures.",
    eyebrow: "Confirmez votre e-mail",
    headline: (n: string) => named("Plus qu’une étape", n),
    intro: (b: string) =>
      `Vous avez créé un compte ${b} avec cette adresse. Confirmez-la et le compte est actif. C’est le compte qui transporte une offre Pro d’un PC à l’autre, et c’est le seul moyen de vous envoyer plus tard une réinitialisation du mot de passe.`,
    button: "Confirmer mon e-mail",
    stepsTitle: "Après la confirmation",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "Revenez dans l’Uninstaller et connectez-vous depuis le panneau <strong>Compte</strong>. L’application vérifie le compte à la connexion, il n’y a donc rien à actualiser à la main.",
            "Rien de ce que vous avez supprimé ne change. Les désinstallations simples, la recherche des restes et le Registre des suppressions n’ont jamais demandé de compte.",
            "Le paiement d’Uninstaller Pro ne s’ouvre qu’une fois l’adresse confirmée. Une offre PC Tweaker sur le même compte débloque le prix fidélité.",
          ]
        : [
            "Revenez dans PC Tweaker et connectez-vous depuis le bouton <strong>Compte</strong>. L’application vérifie le compte à la connexion, il n’y a donc rien à actualiser à la main.",
            "Rien de ce que vous avez déjà appliqué ne change. Free n’a jamais demandé de compte : les réglages Free, l’Analyse et votre Historique des modifications restent tels que vous les avez laissés.",
            "Le paiement de Pro ne s’ouvre qu’une fois l’adresse confirmée. Une licence Pro est signée pour le compte, pas pour la machine : il suffit de vous connecter sur un autre PC pour l’y utiliser.",
          ],
    noteHtml: (b: string) =>
      `Le lien est valable 24 heures, une seule fois. S’il a expiré, ouvrez le menu du compte dans l’application et choisissez <strong>Renvoyer</strong>. Si vous n’avez pas créé de compte ${b}, ignorez cet e-mail : rien ne se passe sans le clic.`,
    helpTitle: "Le lien n’arrive pas, ou arrive en double ?",
    helpText: "Vérifiez d’abord le dossier des indésirables, puis indiquez-nous l’adresse avec laquelle vous vous êtes inscrit.",
    why: (b: string) => `Vous recevez cet e-mail parce qu’un compte ${b} a été créé avec cette adresse.`,
  },

  welcome: {
    subject: (b: string) => `Votre compte ${b} est prêt`,
    preheader: (u: boolean) =>
      u ? "Trois choses à essayer d’abord, et ce qu’ajoute Pro." : "Trois réglages à essayer d’abord, et comment chaque modification s’annule.",
    eyebrow: "Compte prêt",
    headline: (n: string) => named("C’est parti", n),
    intro: (u: boolean, free: number) =>
      u
        ? "Votre adresse est confirmée et le compte est actif. Connectez-vous depuis le panneau Compte de l’Uninstaller et tout ce qui suit est à vous sans rien payer. Voici par où commencer."
        : `Votre adresse est confirmée et le compte est actif. Connectez-vous depuis le bouton Compte de l’application et les ${free} réglages Free, l’Analyse, le Score de santé et l’Historique des modifications sont à vous sans rien payer. Voici par où commencer.`,
    stepsTitle: "Trois choses à essayer d’abord",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "<strong>Applications installées.</strong> Chaque programme du PC, applications du Microsoft Store comprises, avec sa taille et son éditeur.",
            "<strong>Détails, puis Désinstaller.</strong> Chaque programme affiche un niveau de confiance et un résumé de la suppression avant que quoi que ce soit ne s’exécute, et un point de restauration est tenté d’abord pour les programmes installés pour toute la machine.",
            "<strong>La recherche des restes.</strong> Après une désinstallation, l’application cherche les fichiers et clés de registre laissés par le programme, et le Registre des suppressions note ce qui a été retiré et l’espace libéré.",
          ]
        : [
            "<strong>Analyse, puis Lancer l’analyse du système.</strong> Des vérifications sur le démarrage, le stockage, la mémoire, la confidentialité, les performances et les mises à jour. Les modifications recommandées et facultatives sont séparées, et rien n’est appliqué sans votre accord. Tout corriger affiche d’abord les réglages exacts puis vérifie chacun ensuite.",
            "<strong>Démarrage.</strong> Les éléments lancés avec Windows, avec l’éditeur à côté de chacun. En désactiver deux ou trois que vous n’utilisez jamais est le changement que la plupart remarquent au démarrage suivant, et chaque élément a sa propre restauration.",
            "<strong>Profils.</strong> Jeu, Études et Travail sont inclus dans Free. Ouvrez-en un, lisez les compromis sur chaque carte, décochez ce que vous ne voulez pas et appliquez le reste en un clic. Un profil ajoute ses réglages sans annuler vos autres modifications.",
          ],
    noteHtml: (u: boolean, guideLink: (label: string) => string) =>
      u
        ? "Le nettoyage des restes, la suppression par lots et le retrait des entrées cassées font partie d’Uninstaller Pro. Si le même compte a une offre PC Tweaker, Pro coûte moins cher : le prix figure dans Offres et tarifs."
        : `Avant d’écrire quoi que ce soit, PC Tweaker enregistre la valeur précédente, et chaque carte de réglage propose <strong>Ce que cela modifie, exactement</strong>. Restaurez depuis le réglage lui-même, ou ouvrez l’Historique des modifications et utilisez <strong>Restaurer les réglages actifs</strong>. Le nettoyage envoyé à la Corbeille reste récupérable tant que vous ne la videz pas ; les mises à jour de pilotes, les réparations et les réglages matériels ont leurs propres étapes de récupération. Détails : ${guideLink("comment annuler des réglages Windows")}.`,
    button: (b: string) => `Ouvrir ${b}`,
    helpTitle: "Quelque chose ne fonctionne pas comme décrit ?",
    helpText: "Indiquez-nous la version de l’application et ce sur quoi vous avez cliqué.",
    why: (b: string) => `Vous recevez cet e-mail parce que vous avez confirmé un compte ${b} avec cette adresse. Il n’est envoyé qu’une fois.`,
  },

  reset: {
    subject: (b: string) => `Réinitialisez votre mot de passe ${b}`,
    preheader: "Le lien est valable une fois, pendant une heure. Rien ne change tant que vous ne l’utilisez pas.",
    eyebrow: "Réinitialisation du mot de passe",
    headline: "Choisissez un nouveau mot de passe.",
    intro: (b: string) =>
      `Quelqu’un a demandé à réinitialiser le mot de passe du compte ${b} associé à cette adresse. Si c’était vous, le bouton ci-dessous ouvre une page où en choisir un nouveau. Rien n’a encore changé.`,
    button: "Choisir un nouveau mot de passe",
    rows: [
      ["Lien valable", "Une heure, une seule fois"],
      ["Nouveau mot de passe", "Au moins 8 caractères, jusqu’à 72 octets"],
      ["S’applique à", "PC Tweaker, PC Tweaker Uninstaller et Tweaky Driver"],
      ["Après le changement", "Chaque PC connecté est déconnecté"],
    ],
    after:
      "Une fois le nouveau mot de passe enregistré, reconnectez-vous sur chaque PC où vous utilisez les applications. Réglages appliqués, historique et éventuelle offre Pro sont liés au compte et à la machine, pas au mot de passe : rien n’y change.",
    note:
      "Vous n’avez rien demandé ? Ignorez cet e-mail : le lien est valable une heure, une seule fois, et votre mot de passe reste exactement le même. Si ces demandes continuent, écrivez-nous et nous chercherons d’où elles viennent.",
    helpTitle: "Lien expiré, ou la page indique qu’il n’est pas valable ?",
    helpTextHtml:
      "Demandez-en un nouveau via <strong>Mot de passe oublié ?</strong> sur l’écran de connexion et utilisez l’e-mail le plus récent.",
    why: (b: string) => `Vous recevez cet e-mail parce qu’une réinitialisation du mot de passe a été demandée pour le compte ${b} associé à cette adresse.`,
  },

  changed: {
    subject: (b: string) => `Votre mot de passe ${b} a été modifié`,
    preheader: (when: string) => `Modifié le ${when}. Les autres PC connectés ont été déconnectés. Si ce n’était pas vous, lisez la suite.`,
    eyebrow: "Avis de sécurité",
    headline: (n: string) => named("Votre mot de passe a été modifié", n),
    intro: (b: string, when: string) =>
      `Le mot de passe de votre compte ${b} a été modifié le ${when}. Chaque appareil connecté a été déconnecté, dans PC Tweaker, PC Tweaker Uninstaller et Tweaky Driver.`,
    ifYou: "reconnectez-vous sur chaque PC et c’est terminé. Réglages appliqués, historique et offre restent intacts.",
    ifNot: "quelqu’un d’autre a défini ce mot de passe et l’ancien ne fonctionne plus. Faites ces trois choses, dans cet ordre.",
    stepsTitle: "Si ce n’était pas vous",
    stepsHtml: [
      "Ouvrez l’application, choisissez <strong>Mot de passe oublié ?</strong> sur l’écran de connexion et demandez une réinitialisation vers cette adresse. Le lien reçu n’appartient qu’à vous, et l’utiliser déconnecte l’autre personne.",
      "Choisissez un mot de passe que vous n’utilisez nulle part ailleurs. Si cette boîte mail partage l’ancien mot de passe, changez-le aussi : c’est par ce compte qu’un attaquant serait passé.",
      "Répondez à cet e-mail pour que nous vérifiions aussi le compte de notre côté.",
    ],
    button: "Contacter l’assistance",
    noteHtml:
      "Cet e-mail ne contient volontairement ni lien qui modifie quoi que ce soit ni code : un bouton de réinitialisation dans un message &quot;était-ce vous ?&quot; est exactement ce que proposerait un faux e-mail. Nous ne vous demanderons jamais votre mot de passe par e-mail.",
    helpTitle: "Vous voulez que nous examinions le compte ?",
    helpText: "Les messages de sécurité sont lus en priorité.",
    expectation: "Vous aurez en général une réponse sous un jour ouvré.",
    why: (b: string) => `Cet avis est envoyé chaque fois que le mot de passe d’un compte ${b} change. Il ne peut pas être désactivé.`,
  },

  emailChange: {
    subject: (b: string) => `Confirmez votre nouvelle adresse e-mail pour ${b}`,
    preheader: "Un clic transfère votre compte vers cette adresse. Le lien est valable 24 heures.",
    eyebrow: "Confirmer la nouvelle adresse",
    headline: (n: string) => named("Confirmez cette adresse", n),
    intro:
      "Vous avez demandé à transférer vers cette adresse le compte utilisé par PC Tweaker, PC Tweaker Uninstaller et Tweaky Driver. Confirmez-la et vous vous connecterez désormais avec cette adresse ; la précédente ne servira plus à la connexion.",
    button: "Confirmer la nouvelle adresse",
    note: "Le lien est valable 24 heures, une seule fois. Tant que vous ne confirmez pas, rien ne change. Après le transfert, chaque PC connecté est déconnecté.",
    helpTitle: "Vous n’avez rien demandé ?",
    helpText: "Ignorez cet e-mail : le compte reste sur son adresse actuelle.",
    why: "Vous recevez cet e-mail parce que quelqu’un s’est connecté à un compte PC Tweaker et a demandé à le transférer vers cette adresse.",
  },

  emailChanged: {
    subject: (b: string) => `L’adresse e-mail de votre compte ${b} a été modifiée`,
    preheader: (masked: string) => `Le compte utilise désormais ${masked}. Si ce n’était pas vous, lisez la suite.`,
    eyebrow: "Avis de sécurité",
    headline: (n: string) => named("L’adresse de votre compte a été modifiée", n),
    intro: (masked: string, when: string) =>
      `Le ${when}, le compte utilisé par PC Tweaker, PC Tweaker Uninstaller et Tweaky Driver est passé de cette adresse à ${masked}. Chaque PC connecté a été déconnecté ; la connexion utilise maintenant la nouvelle adresse.`,
    ifYou: "rien d’autre à faire. Offres, réglages et historique ont suivi le compte.",
    ifNot:
      "quelqu’un qui connaissait votre mot de passe a transféré le compte. Répondez tout de suite à cet e-mail : nous pouvons le rétablir et le bloquer pendant la vérification. Changez ensuite ce mot de passe partout où vous l’utilisiez.",
    button: "Contacter l’assistance",
    note: "Cet e-mail ne contient volontairement aucun lien qui modifie quoi que ce soit. Nous ne vous demanderons jamais votre mot de passe par e-mail.",
    helpTitle: "Vous voulez que nous examinions le compte ?",
    helpText: "Les messages de sécurité sont lus en priorité.",
    why: (b: string) => `Cet avis est envoyé à l’adresse précédente chaque fois que l’e-mail d’un compte ${b} change. Il ne peut pas être désactivé.`,
  },

  signIn: {
    subject: (b: string) => `Nouvelle connexion à votre compte ${b}`,
    preheader: (device: string, when: string) => `Connexion depuis ${device} le ${when}. Si c’était vous, rien à faire.`,
    eyebrow: "Nouvelle connexion",
    aPc: "un PC Windows",
    headline: (device: string) => `Nouvelle connexion depuis ${device}.`,
    intro: (b: string) =>
      `Votre compte ${b} a été utilisé depuis un PC ou un réseau que nous n’avions jamais vu sur ce compte. Nous l’envoyons une fois par nouveau PC, et uniquement pour des connexions avec le bon mot de passe ; un mot de passe erroné ne déclenche jamais cet e-mail.`,
    rows: { device: "PC", when: "Quand", account: "Compte" },
    ifYou: "rien à faire, par exemple un second PC, une réinstallation ou un nouveau réseau. Une offre Pro suit le compte.",
    ifNotHtml:
      "changez votre mot de passe tout de suite via <strong>Mot de passe oublié ?</strong> sur l’écran de connexion. Un nouveau mot de passe déconnecte tous les PC d’un coup, y compris celui-ci. Répondez ensuite à cet e-mail pour que nous examinions le compte.",
    note:
      "Cet e-mail ne contient volontairement aucun lien de déconnexion : un lien « sécuriser mon compte » dans une alerte de sécurité est exactement la forme qu’aurait un faux message. La seule action sûre est la réinitialisation que vous lancez vous-même dans l’application. Nous ne vous demanderons jamais votre mot de passe par e-mail.",
    helpTitle: "Pas sûr que ce soit vous ?",
    helpText: "Considérez que ce n’était pas vous et prévenez-nous. Les messages de sécurité sont lus en priorité.",
    why: (b: string) => `Cet avis est envoyé la première fois qu’un nouveau PC ou un nouveau réseau se connecte à un compte ${b}. Il ne peut pas être désactivé.`,
  },

  receipt: {
    subject: (u: boolean, lifetime: boolean) =>
      u
        ? lifetime
          ? "Votre achat de PC Tweaker Uninstaller Pro est confirmé"
          : "Votre abonnement PC Tweaker Uninstaller Pro est actif"
        : lifetime
          ? "Votre licence PC Tweaker Pro Lifetime est active"
          : "Votre abonnement PC Tweaker Pro est actif",
    rows: {
      plan: "Offre",
      charged: "Débité",
      renewsOn: "Renouvellement le",
      access: "Accès",
      neverExpires: "N’expire jamais",
      renewal: "Renouvellement",
      renewalNone: "Aucun. Plus rien n’est débité.",
      included: "Inclus",
      includedValue: "12 mois de PC Tweaker Uninstaller Pro",
      account: "Compte",
      shared: (email: string) => `${email} (partagé avec PC Tweaker)`,
    },
    eyebrowPro: "Pro activé",
    eyebrowLifetime: "Licence Lifetime",
    buttonPct: "Ouvrir PC Tweaker",
    buttonUn: "Ouvrir Uninstaller",
    help: {
      title: "Payé mais toujours pas Pro, ou débité d’un montant inattendu ?",
      text: "Indiquez-nous l’adresse du compte et la date figurant sur le reçu Stripe.",
      expectation: "Les réponses sur la facturation partent en général sous un jour ouvré.",
    },
    sub: {
      headline: (n: string) => named("Pro est actif sur votre compte", n),
      preheader: (plan: string, price: string, renews: string) =>
        `${plan}, ${price}, renouvellement le ${renews}. Comment gérer l’offre et utiliser Pro sur un second PC.`,
      intro: (email: string, total: number, free: number, pro: number) =>
        `Stripe a confirmé le paiement et la licence de ${email} est signée. Les ${total} réglages sont disponibles maintenant : les ${free} que vous aviez avec Free plus les ${pro} réglages Pro, Game Sessions et le préréglage Turbo Gaming compris. L’application actualise sa licence quand vous revenez du paiement en ligne, Pro devrait donc déjà s’afficher.`,
      stepsTitle: "Bon à savoir dès le premier jour",
      stepsHtml: (who: string, renews: string) => [
        `<strong>Gérer l’offre.</strong> Ouvrez Offres et tarifs dans l’application. Elle affiche l’offre et ouvre le portail de facturation Stripe, où vous changez de carte ou résiliez. Une offre résiliée reste Pro jusqu’au ${renews} et n’est plus débitée.`,
        `<strong>Un second PC.</strong> Installez-y PC Tweaker et connectez-vous avec ${who}. La licence est signée pour le compte, pas pour la machine : elle est Pro sur les deux. Les réglages appliqués et l’Historique des modifications restent propres à chaque machine.`,
        "<strong>Après une réinstallation de Windows ou un nouveau matériel.</strong> Reconnectez-vous et Pro revient de lui-même. L’Historique des modifications ne suit pas, réappliquez donc un profil plutôt que de chercher une restauration.",
        "<strong>Par où commencer avec Pro.</strong> Jeu, puis Game Sessions : enregistrez un jeu et les réglages turbo s’activent à son lancement et s’annulent à sa fermeture.",
      ],
      note: "Stripe envoie la facture et le reçu de paiement séparément, depuis sa propre adresse ; conservez-les pour vos dossiers. Si l’application affiche encore Free après quelques minutes, déconnectez-vous puis reconnectez-vous : la licence est relue à la connexion.",
      why: "Vous recevez cet e-mail parce qu’un abonnement PC Tweaker Pro a été souscrit sur le compte associé à cette adresse.",
    },
    lifetime: {
      headline: (n: string) => named("Pro, pour de bon. Merci", n),
      preheader: (price: string) =>
        `Un seul paiement de ${price}, sans renouvellement. Inclut 12 mois d’Uninstaller Pro, activés à la première connexion.`,
      intro: (email: string, total: number) =>
        `Vous avez payé une fois et c’est la dernière fois que ce compte est débité. La licence Lifetime de ${email} est signée et les ${total} réglages, Game Sessions et le préréglage Turbo Gaming sont disponibles maintenant.`,
      stepsTitle: "Ce que Lifetime signifie en pratique",
      stepsHtml: (who: string, uninstallerLink: string) => [
        `<strong>Tous vos PC.</strong> Connectez-vous avec ${who} sur n’importe quel PC sous Windows 10 ou 11 et il est Pro. Aucune activation à compter, aucune clé de licence à saisir : la clé, c’est le compte.`,
        `<strong>Uninstaller Pro pendant un an.</strong> Installez PC Tweaker Uninstaller depuis ${uninstallerLink} et connectez-vous avec le même compte. Les 12 mois commencent à votre première connexion là-bas, pas aujourd’hui. C’est un avantage séparé et limité dans le temps, pas une licence Lifetime d’Uninstaller.`,
        "<strong>Réinstallations et nouveau matériel.</strong> Rien à transférer. Après un Windows neuf, installez PC Tweaker, connectez-vous, et Pro revient. L’Historique des modifications appartient à l’ancienne installation : partez d’un profil plutôt que d’attendre le retour des anciens réglages.",
        "<strong>Mises à jour.</strong> PC Tweaker cherche lui-même les mises à jour, et Lifetime couvre toutes les mises à jour de PC Tweaker Pro.",
      ],
      note: "Stripe envoie la facture séparément. Si vous voyez un jour un débit mensuel de notre part après cet achat, écrivez-nous tout de suite : un compte Lifetime ne doit plus jamais être débité, et nous corrigerons.",
      why: "Vous recevez cet e-mail parce qu’une licence PC Tweaker Pro Lifetime a été achetée sur le compte associé à cette adresse.",
    },
    un: {
      headline: (n: string) => named("Pro est actif", n, ". À vous de supprimer les restes."),
      preheader: (plan: string, price: string, renews: string | null) =>
        `${plan}, ${price}, ${renews ? `renouvellement le ${renews}` : "sans renouvellement"}. Nettoyage des restes, suppression par lots et entrées cassées sont actifs.`,
      intro: (email: string) =>
        `Stripe a confirmé le paiement et la licence Uninstaller Pro de ${email} est signée. Trois choses changent dans l’application : la recherche des restes peut maintenant nettoyer ce qu’elle trouve, plusieurs programmes peuvent être mis en file et supprimés en une fois, et les entrées dont le programme de désinstallation a disparu peuvent aussi être retirées. Tout ce que vous aviez avec Free, y compris le niveau de confiance et le Registre des suppressions, reste exactement pareil.`,
      stepsTitle: "Une première suppression propre avec Pro",
      stepsHtml: (lifetime: boolean, who: string, renews: string) => [
        "Choisissez un programme jugé <strong>Sûr</strong> et lisez son résumé de suppression : la commande exacte, si c’est Windows Installer ou le programme de désinstallation du logiciel qui s’exécute, les autorisations demandées et la taille indiquée. Rien ne s’exécute avant votre confirmation.",
        "Après la désinstallation, la recherche des restes liste les dossiers, raccourcis et clés de registre laissés par le programme. Avec Pro, vous pouvez les supprimer depuis le même écran. Les fichiers vont à la Corbeille, une erreur reste donc récupérable tant que vous ne la videz pas ; les valeurs de registre sont conservées dans le Registre des suppressions.",
        "Pour un grand ménage, cochez plusieurs programmes et lancez une suppression par lots. Les programmes protégés n’entrent jamais dans un lot, la vérification des programmes liés avertit toujours avant qu’un programme principal n’emporte ses extensions, et un point de restauration est tenté avant les suppressions avec élévation, avec le résultat enregistré.",
        ...(lifetime
          ? []
          : [
              `<strong>Gérer l’offre.</strong> Offres et tarifs, dans la barre du haut, affiche le compte et l’offre et ouvre le portail de facturation Stripe pour la carte ou une résiliation. Une offre résiliée reste Pro jusqu’au ${renews}. En vous connectant avec ${who} sur un autre PC, il devient Pro lui aussi.`,
            ]),
      ],
      note: (lifetime: boolean) =>
        `${lifetime ? "Cet achat ne se renouvelle pas. " : ""}Un compte, deux licences : une licence PC Tweaker Pro ne débloque pas Uninstaller et celle-ci ne débloque pas PC Tweaker ; chaque application vérifie la sienne. Stripe envoie la facture séparément. Si Uninstaller affiche encore Free après quelques minutes, déconnectez-vous puis reconnectez-vous depuis Offres et tarifs.`,
      help: {
        title: "Payé mais toujours pas Pro, ou une suppression qui ne s’est pas passée comme le disait le résumé ?",
        text: "Indiquez-nous la version de l’application et l’entrée du Registre des suppressions (exportable en CSV).",
        expectation: "Nous répondons en général sous un jour ouvré.",
      },
      why: (lifetime: boolean) =>
        lifetime
          ? "Vous recevez cet e-mail parce que PC Tweaker Uninstaller Pro a été acheté sur le compte PC Tweaker associé à cette adresse."
          : "Vous recevez cet e-mail parce qu’un abonnement Uninstaller Pro a été souscrit sur le compte PC Tweaker associé à cette adresse.",
    },
  },

  reversal: {
    subject: (u: boolean) =>
      u ? "Votre paiement PC Tweaker Uninstaller Pro a été annulé" : "Votre paiement PC Tweaker Pro a été annulé",
    eyebrow: "Paiement annulé",
    headline: (n: string) => named("Votre paiement a été annulé", n),
    rows: {
      amount: "Montant annulé",
      plan: "Offre",
      proAccess: "Accès Pro",
      ended: "Terminé",
      account: "Votre compte",
      accountValue: "Ouvert, en Free",
      unPro: "Uninstaller Pro",
      unFree: "Toujours à vous en Free",
      unFreeValue: "Désinstallations simples, niveau de confiance, résumé de suppression, recherche des restes, Registre des suppressions",
    },
    pct: {
      lead: (amount: string | null) =>
        `${amount ? `Votre paiement de ${amount}` : "Votre paiement"} pour PC Tweaker Pro a été annulé par votre prestataire de paiement.`,
      preheaderTail: "L’accès Pro a pris fin ; les fonctions gratuites continuent de fonctionner.",
      introTail:
        "Stripe nous l’a signalé, et l’accès Pro lié à ce paiement a pris fin sur votre compte. Cet e-mail consigne ce qui a changé ; il ne vous demande rien.",
      ended: "L’accès Pro lié à ce paiement a pris fin. Votre compte et les fonctions gratuites continuent de fonctionner.",
      endedTail: "L’application repasse en Free à la prochaine vérification de la licence, en général au prochain démarrage ou à la prochaine connexion.",
      stopRenewal: "Si l’abonnement lui-même est encore actif, résiliez-le depuis Offres et tarifs pour qu’il ne se renouvelle pas.",
      oneOff: "Il s’agissait d’un achat unique : il n’y a donc aucun abonnement à résilier.",
      mistake: "Si vous pensez qu’il s’agit d’une erreur, répondez à cet e-mail et nous examinerons avec vous le dossier Stripe.",
    },
    un: {
      preheader: (amount: string | null) =>
        `${amount ?? "Votre paiement"} a été annulé par votre prestataire de paiement. Pro a pris fin ; désinstallations simples, résumé de suppression et Registre des suppressions continuent de fonctionner.`,
      intro: (amount: string | null) =>
        `Votre prestataire de paiement a annulé ${amount ? `le paiement de ${amount}` : "votre paiement"} pour PC Tweaker Uninstaller Pro, et Stripe nous l’a signalé. L’accès Pro lié à ce paiement a pris fin. Votre compte reste ouvert, tout comme sa partie PC Tweaker : cette annulation ne concerne qu’Uninstaller.`,
      stops:
        "Ce qui s’arrête : le nettoyage des restes, la suppression par lots et le retrait des entrées cassées. Ce qui ne change pas : ce qui a été supprimé le reste, le Registre des suppressions garde chaque reçu, et les fichiers envoyés à la Corbeille y restent tant que vous ne la videz pas.",
      stopRenewal:
        "Si l’abonnement apparaît encore comme actif chez Stripe, résiliez-le depuis Offres et tarifs dans la barre du haut pour qu’il ne tente pas un nouveau débit.",
      oneOff: "Il s’agissait d’un accès unique : il n’y a donc rien à résilier.",
      origin:
        "Cette annulation vient de votre banque ou de l’émetteur de votre carte, pas de nous. Si vous ne l’avez pas demandée à votre banque, répondez à cet e-mail avec la date et le montant de votre relevé et nous reprendrons avec vous le dossier Stripe.",
    },
    helpTitle: "Des questions sur cette annulation ?",
    helpText: "Indiquez-nous la date et le montant figurant sur votre relevé bancaire.",
    why: (u: boolean) =>
      u
        ? "Vous recevez cet e-mail parce qu’un paiement pour Uninstaller Pro sur le compte PC Tweaker associé à cette adresse a été annulé."
        : "Vous recevez cet e-mail parce qu’un paiement pour PC Tweaker Pro sur le compte associé à cette adresse a été annulé.",
  },

  ending: {
    subject: (b: string, ends: string) => `Votre offre ${b} Pro prend fin le ${ends}`,
    preheader: (ends: string) => `Pro reste actif jusqu’au ${ends}, puis le compte repasse en Free. Rien n’est supprimé.`,
    eyebrow: "Fin de l’offre",
    headline: (n: string, ends: string) => named(`Pro reste actif jusqu’au ${ends}`, n),
    intro: (b: string, failed: boolean, ends: string) =>
      failed
        ? `Stripe n’a pas pu encaisser le renouvellement de votre abonnement ${b} Pro. Pro continue de fonctionner pendant que Stripe retente le paiement ; s’il ne peut pas être encaissé d’ici le ${ends}, le compte repasse en Free.`
        : `Votre abonnement ${b} Pro a été résilié, comme demandé. Il n’y aura plus de débit. Tout ce qui est Pro fonctionne jusqu’à la fin de la période déjà payée, puis le compte repasse en Free.`,
    rows: { plan: "Offre", until: "Pro jusqu’au", next: "Prochain débit", nextValue: "Aucun", after: "Ensuite" },
    afterValue: (u: boolean, free: number) =>
      u ? "Free : désinstallations simples, recherche des restes, Registre des suppressions" : `Free : ${free} réglages, Analyse, Score de santé, Historique des modifications`,
    stepsTitle: (ends: string) => `Avant le ${ends}`,
    steps: (u: boolean, failed: boolean) => [
      u
        ? "Le nettoyage des restes et la suppression par lots s’arrêtent à la fin de Pro. Ce qui a été supprimé le reste, et le Registre des suppressions garde chaque reçu."
        : "Les réglages appliqués avec des réglages Pro ne sont pas annulés à la fin de Pro ; Windows les conserve. Si vous voulez en remettre certains par défaut, faites-le maintenant depuis la carte du réglage ou depuis l’Historique des modifications, où la restauration fonctionne aussi en Free.",
      u
        ? "Les fichiers envoyés à la Corbeille par un nettoyage Pro y restent tant que vous ne la videz pas, avec ou sans Pro."
        : "À la fin de Pro, Game Sessions cesse d’activer les réglages turbo au lancement des jeux. Rien ne reste appliqué d’une session déjà terminée, car chaque session est annulée à la sortie.",
      failed
        ? "Mettez la carte à jour depuis Offres et tarifs, puis Gérer l’abonnement. Stripe retente lui-même le renouvellement ; dès qu’il aboutit, Pro continue sans interruption."
        : "Vous avez changé d’avis ? Ouvrez Offres et tarifs, puis Gérer l’abonnement : jusqu’à la date de fin, Stripe vous permet de reprendre la même offre sans nouveau paiement.",
    ],
    button: (b: string) => `Ouvrir ${b}`,
    note: "Rien n’est supprimé à la fin de Pro : le compte, son historique et chaque réglage appliqué restent exactement où ils sont. Stripe envoie séparément son propre avis sur l’abonnement.",
    helpTitle: "Vous n’avez pas résilié, ou la date semble fausse ?",
    helpText: "Dites-le-nous et nous examinerons avec vous le dossier Stripe.",
    why: (b: string) => `Vous recevez cet e-mail parce que l’abonnement ${b} Pro du compte associé à cette adresse a changé d’état.`,
  },

  bonus: {
    subject: "Vos 12 mois d’Uninstaller Pro ont commencé",
    preheader: (ends: string) => `Inclus avec votre licence PC Tweaker Lifetime, actif jusqu’au ${ends}. Rien à payer, rien à résilier.`,
    eyebrow: "Avantage Lifetime",
    headline: (n: string) => named("Votre année d’Uninstaller Pro a commencé aujourd’hui", n),
    intro: (ends: string) =>
      `Vous vous êtes connecté à PC Tweaker Uninstaller avec le compte qui détient votre licence PC Tweaker Lifetime, et c’est cette première connexion qui lance les 12 mois d’Uninstaller Pro inclus. Aucune carte n’a été débitée et aucun abonnement n’est derrière ; cela dure jusqu’au ${ends} puis s’arrête simplement.`,
    rows: {
      entitlement: "Droit",
      entitlementValue: "Uninstaller Pro, avantage Lifetime de 12 mois",
      started: "Début",
      ends: "Fin",
      charged: "Débité",
      chargedValue: "Rien. Sans renouvellement.",
    },
    stepsTitle: "Ce que Pro ajoute pour l’année",
    stepsHtml: [
      "<strong>Nettoyage des restes.</strong> La recherche après chaque désinstallation listait déjà ce qui restait ; vous pouvez maintenant supprimer ces dossiers, raccourcis et clés de registre depuis le même écran. Les fichiers vont à la Corbeille, les valeurs de registre sont conservées dans le Registre des suppressions.",
      "<strong>Suppression par lots.</strong> Cochez plusieurs programmes et laissez-les se suivre dans un ordre sûr. Les programmes protégés sont exclus, et un point de restauration est tenté d’abord pour les suppressions avec élévation.",
      "<strong>Entrées cassées.</strong> Les programmes dont le programme de désinstallation a disparu, qui restent d’ordinaire dans la liste pour toujours, peuvent être retirés.",
    ],
    button: "Ouvrir Uninstaller",
    note: (ends: string) =>
      `À la fin de l’année, Uninstaller repasse en Free de lui-même : désinstallations simples, niveau de confiance, recherche des restes et Registre des suppressions restent, et rien de ce qui a été supprimé ne revient. Votre licence PC Tweaker Lifetime n’est pas touchée. Si vous voulez Pro après le ${ends}, c’est depuis Offres et tarifs qu’une offre Uninstaller payante commencerait ; il n’y a aucune conversion automatique.`,
    helpTitle: "Pro ne s’affiche pas dans Uninstaller ?",
    helpText: "Déconnectez-vous puis reconnectez-vous une fois ; chaque application lit sa propre licence à la connexion.",
    why: "Vous recevez cet e-mail parce que l’avantage Lifetime a été activé sur le compte PC Tweaker associé à cette adresse. Il n’est envoyé qu’une fois.",
  },

  reminder: {
    subject: "Votre paiement PC Tweaker Lifetime",
    preheader: "Le paiement s’est fermé avant d’aboutir, rien n’a donc été débité. C’est le seul rappel.",
    eyebrow: "Paiement non finalisé",
    headline: (n: string) => named("Rien n’a été débité", n),
    intro:
      "Vous avez ouvert un paiement Lifetime pour PC Tweaker Pro et la page Stripe s’est fermée avant que le paiement n’aboutisse. Aucune carte n’a été débitée et votre compte est exactement comme avant. Si quelque chose vous a arrêté, voici ce que l’on demande en général avant de se décider.",
    rows: (total: number) => [
      ["Lifetime", "Un seul paiement. Jamais de renouvellement."],
      ["Comprend", `Les ${total} réglages, Game Sessions, toutes les mises à jour`],
      ["PC", "Chaque PC où vous vous connectez avec ce compte"],
      ["Inclus aussi", "12 mois de PC Tweaker Uninstaller Pro"],
    ],
    button: "Ouvrir PC Tweaker",
    retry:
      "Pour réessayer, ouvrez Offres et tarifs dans l’application et choisissez Lifetime. Le paiement demande une adresse e-mail confirmée ; si le bouton est grisé, c’est pour cela, et Renvoyer dans le menu du compte règle le problème. Le prix actuel figure sur la carte de l’offre et sur la page Stripe.",
    doubts:
      "Si un moyen de paiement a été refusé, Stripe en indique la raison sur sa page ; une autre carte ou un portefeuille numérique fonctionne en général. Et si vous avez décidé de ne pas le faire, c’est très bien : Free reste Free, et c’est le seul rappel que vous recevrez pour ce paiement.",
    helpTitle: "Une question avant de décider ?",
    helpText: "Une vraie personne répond.",
    why: "Vous recevez cet e-mail parce qu’un paiement Lifetime a été lancé depuis le compte PC Tweaker associé à cette adresse sans être finalisé. Un seul rappel.",
    unsubscribe: "Ne plus recevoir ce type d’e-mail.",
  },

  /** A Checkout payment that was declined or blocked (checkout-recovery.ts). */
  paymentFailed: {
    subject: (p: string) => `Votre paiement ${p} n’a pas abouti`,
    preheader: "Rien n’a été débité. Une autre carte, Apple Pay, Google Pay ou Link fonctionne en général.",
    eyebrow: "Paiement non finalisé",
    headline: (n: string) => named("Votre paiement n’a pas abouti", n),
    intro: (p: string) => `Vous avez lancé un paiement pour ${p} Pro et il a été refusé avant tout débit. Votre compte est exactement comme avant.`,
    retry:
      "Réessayez avec une autre carte, Apple Pay, Google Pay ou Link. L’émetteur de la carte ou les contrôles antifraude automatiques de Stripe refusent parfois une carte même lorsque toutes les informations sont exactes, souvent une carte prépayée ou émise à l’étranger ; une autre carte ou un portefeuille numérique passe en général.",
    button: "Reprendre le paiement",
    app: "Vous pouvez aussi ouvrir Offres et tarifs dans l’application et choisir la même offre.",
    helpTitle: "Toujours refusé ?",
    helpText: "Répondez à cet e-mail : une vraie personne vous aide à finaliser l’achat.",
    why: "Vous recevez cet e-mail parce que le paiement d’un achat lancé depuis le compte associé à cette adresse n’a pas abouti. Au plus un message de ce type par jour.",
  },

  supportAck: {
    subject: "Nous avons bien reçu votre demande d’assistance PC Tweaker",
    preheader: "Votre message est dans la file. Répondez à cet e-mail pour ajouter un détail ou une capture d’écran.",
    eyebrow: "Demande d’assistance reçue",
    headline: (n: string) => (n ? `C’est noté, ${n}. Votre demande est dans la file.` : "C’est noté. Votre demande est dans la file."),
    intro:
      "Votre message est arrivé dans la boîte d’assistance de PC Tweaker. C’est une personne qui le lit, pas un robot, et la réponse arrivera à cette adresse. La plupart des réponses partent sous un jour ouvré ; ce qui demande de reproduire le problème chez nous peut prendre un peu plus de temps, et nous vous le dirons.",
    replyTo: "Nous répondons à",
    stepsTitle: "Ce qui accélère la réponse",
    steps: [
      "Répondez à cet e-mail avec ce que vous avez oublié : la version de l’application, votre version de Windows et le réglage ou l’analyse exacts que vous avez utilisés. Un seul fil garde tout ensemble.",
      "Si un réglage se comporte mal, ouvrez l’Historique des modifications et dites-nous ce qu’indique l’entrée. Chaque réglage appliqué y figure avec la valeur définie et celle qu’elle a remplacée, ce qui suffit souvent au diagnostic.",
      "Les captures d’écran aident ; floutez d’abord tout ce qui est personnel. N’incluez jamais de mot de passe, de jeton de licence ni de données de carte, et si l’on semblait vous les demander, le message ne viendrait pas de nous.",
    ],
    wait: "En attendant : si une modification doit être annulée tout de suite, Restaurer les réglages actifs dans l’Historique des modifications rétablit chaque réglage enregistré sans nous attendre.",
    guide: (link: string) => `Le ${link} couvre les cas qu’il ne traite pas.`,
    guideLabel: "guide d’annulation",
    notYouTitle: "Vous ne nous avez pas écrit ?",
    notYou:
      "Quelqu’un a saisi cette adresse dans le formulaire d’assistance. Vous pouvez ignorer cet e-mail ; le formulaire ne modifie aucun compte. Si cela se répète, prévenez-nous et nous bloquerons la source.",
    why: "Vous recevez cet e-mail parce qu’une demande d’assistance a été envoyée à PC Tweaker depuis cette adresse.",
  },

  pages: {
    error: "Erreur",
    unavailable: "Ce service n’est pas disponible pour le moment.",
    missingToken: "Ce lien est incomplet. Ouvrez-le directement depuis l’e-mail.",
    verifiedTitle: "Adresse e-mail vérifiée",
    verified: (b: string) => `Votre adresse e-mail est vérifiée. Vous pouvez fermer cette fenêtre et revenir à ${b}.`,
    alreadyVerified: (b: string) => `Votre adresse e-mail est déjà vérifiée. Vous pouvez fermer cette fenêtre et revenir à ${b}.`,
    expiredTitle: "Lien expiré",
    verifyExpired: "Ce lien de vérification n’est pas valable ou a expiré. Demandez-en un nouveau depuis l’application.",
    failed: "Une erreur s’est produite. Réessayez plus tard.",
    resetTitle: "Choisissez un nouveau mot de passe",
    resetLead:
      "Choisissez un mot de passe que vous n’utilisez nulle part ailleurs. Il s’applique à PC Tweaker, PC Tweaker Uninstaller et Tweaky Driver, et vous serez déconnecté de vos autres appareils.",
    newPassword: "Nouveau mot de passe",
    newPasswordPlaceholder: "Au moins 8 caractères",
    passwordHint: "Utilisez au moins 8 caractères et pas plus de 72 octets UTF-8. Les lettres accentuées et les emoji peuvent occuper plusieurs octets.",
    confirmPassword: "Confirmer le mot de passe",
    confirmPlaceholder: "Saisissez-le à nouveau",
    update: "Mettre à jour le mot de passe",
    resetHint: "Ce lien est valable une seule fois et expire une heure après son envoi.",
    notValidTitle: "Lien non valable",
    notValidLead: "Cette page a besoin du lien de votre e-mail de réinitialisation. Ouvrez ce lien directement plutôt que de recharger la page.",
    passwordRule: "Le mot de passe doit comporter au moins 8 caractères et pas plus de 72 octets UTF-8.",
    mismatch: "Les deux mots de passe ne correspondent pas.",
    resetInvalid: "Ce lien de réinitialisation n’est pas valable, a déjà servi ou a expiré.",
    resetFailed: "Impossible de réinitialiser le mot de passe. Réessayez.",
    updatedTitle: "Mot de passe mis à jour",
    updated: (b: string) => `C’est fait. Revenez à ${b} et connectez-vous avec votre nouveau mot de passe.`,
    closeHint: "Vous pouvez fermer cette fenêtre.",
    emailChangedTitle: "Adresse e-mail modifiée",
    emailChanged: (b: string, email: string) => `Votre compte utilise désormais ${email}. Revenez à ${b} et connectez-vous avec cette adresse.`,
    emailChangeInvalid: "Ce lien n’est pas valable, a déjà servi ou a expiré. Redemandez la modification depuis l’application.",
    emailTaken: "Cette adresse est déjà utilisée par un autre compte. Rien n’a été modifié.",
  },

  checkout: {
    paidTitle: "Paiement effectué",
    paidBody: (app: string) =>
      `Pro est maintenant actif sur votre compte. Revenez dans ${app} : la nouvelle offre est prise en compte automatiquement à la prochaine vérification de la licence.`,
    trialTitle: "Votre essai gratuit a commencé",
    trialBody: (app: string, days: number) =>
      `Rien n’a été débité aujourd’hui et Pro est actif sur votre compte pendant ${days} jours. À la fin de l’essai, le premier paiement est prélevé automatiquement, sauf si vous résiliez avant depuis Offres et tarifs dans ${app}. Nous vous écrivons la veille.`,
    cancelTitle: "Paiement annulé",
    cancelBody: "Aucun montant n’a été débité. Si votre paiement n’a pas abouti, réessayez avec une autre carte, Apple Pay, Google Pay ou Link. Vous pouvez aussi relancer le paiement depuis l’application.",
    retry: "Réessayer",
    tipTitle: "Merci pour votre soutien",
    tipBody: "Votre pourboire finance directement les nouvelles fonctions et les mises à jour quotidiennes de PC Tweaker. Stripe vous enverra le reçu par e-mail.",
    notedTitle: "Merci de nous l’avoir dit",
    notedBody: "Cela nous aide à savoir où continuer à publier. Revenez dans l’application : votre nouvelle offre est prise en compte automatiquement.",
    ask: "Facultatif : comment avez-vous découvert PC Tweaker ?",
    sources: {
      youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook",
      search: "Moteur de recherche", friend: "Un ami", other: "Ailleurs",
    } as Record<string, string>,
    close: "Vous pouvez fermer cet onglet.",
  },
};
