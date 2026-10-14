import type { Lang } from "../i18n";

/** Free-trial wording for Plans & pricing, the account menu and the notice
 *  shown on return. German follows the app's "Sie"; the price lines avoid a
 *  pronoun so they sit next to the plans' existing copy either way. */
type TrialCopy = {
  start: string;
  subscribeNow: string;
  subscribe: string;
  subscribeNowNote: string;
  thenMonth: string;
  thenYear: string;
  thenMonthPromo: string;
  thenYearPromo: string;
  used: string;
  trial: string;
  leftDays: string;
  leftHours: string;
  leftMinutes: string;
  firstCharge: string;
  noCharge: string;
  paymentFailed: string;
  paymentFailedHint: string;
  updatePayment: string;
  ended: string;
  trialUsed: string;
  pausedTitle: string;
  pausedBody: string;
  trialEndedTitle: string;
  endedTitle: string;
  endedBody: string;
  converted: string;
  seePlans: string;
};

export const TRIAL_COPY: Record<Lang, TrialCopy> = {
  en: {
    start: "Start {days}-day free trial",
    subscribeNow: "Subscribe now",
    subscribe: "Subscribe",
    subscribeNowNote: "Or subscribe now: {price} charged today, no trial.",
    thenMonth:
      "Then {price} a month, first charge on {date}. Cancel anytime from the billing portal.",
    thenYear:
      "Then {price} a year, first charge on {date}. Cancel anytime from the billing portal.",
    thenMonthPromo:
      "Then {price} for the first month, charged on {date}, and {regular} a month after that. Cancel anytime from the billing portal.",
    thenYearPromo:
      "Then {price} for the first year, charged on {date}, and {regular} a year after that. Cancel anytime from the billing portal.",
    used: "This account has already used its free trial. The plan starts as a paid subscription straight away.",
    trial: "Free trial",
    leftDays: "{days} d {hours} h left",
    leftHours: "{hours} h {minutes} min left",
    leftMinutes: "{minutes} min left",
    firstCharge: "First charge on {date}",
    noCharge: "Canceled: ends on {date}, no charge",
    paymentFailed: "Payment failed",
    paymentFailedHint: "Update your payment method to turn Pro back on.",
    updatePayment: "Update payment method",
    ended: "Ended",
    trialUsed: "Free trial used",
    pausedTitle: "Pro is paused",
    pausedBody:
      "The latest payment didn't go through, so Pro tools are locked until it does. Everything you already changed stays as it is, and you can still undo it at any time with Restore.",
    trialEndedTitle: "Your free trial has ended",
    endedTitle: "Your Pro plan has ended",
    endedBody:
      "Pro tools are locked now. Everything you already changed stays as it is, and you can still undo it at any time with Restore.",
    converted: "Your free trial is now a Pro subscription. Thank you!",
    seePlans: "See plans",
  },
  it: {
    start: "Inizia {days} giorni di prova gratuita",
    subscribeNow: "Abbonati subito",
    subscribe: "Abbonati",
    subscribeNowNote: "Oppure abbonati subito: {price} addebitati oggi, senza prova.",
    thenMonth:
      "Poi {price} ogni mese, primo addebito il {date}. Disdici quando vuoi dal portale di pagamento.",
    thenYear:
      "Poi {price} ogni anno, primo addebito il {date}. Disdici quando vuoi dal portale di pagamento.",
    thenMonthPromo:
      "Poi {price} il primo mese, addebitati il {date}, e {regular} al mese in seguito. Disdici quando vuoi dal portale di pagamento.",
    thenYearPromo:
      "Poi {price} il primo anno, addebitati il {date}, e {regular} all'anno in seguito. Disdici quando vuoi dal portale di pagamento.",
    used: "Questo account ha già usato la sua prova gratuita. Il piano parte subito come abbonamento a pagamento.",
    trial: "Prova gratuita",
    leftDays: "Mancano {days} g {hours} h",
    leftHours: "Mancano {hours} h {minutes} min",
    leftMinutes: "Mancano {minutes} min",
    firstCharge: "Primo addebito il {date}",
    noCharge: "Disdetta: termina il {date}, nessun addebito",
    paymentFailed: "Pagamento non riuscito",
    paymentFailedHint: "Aggiorna il metodo di pagamento per riattivare Pro.",
    updatePayment: "Aggiorna il metodo di pagamento",
    ended: "Terminato",
    trialUsed: "Prova gratuita già usata",
    pausedTitle: "Pro è in pausa",
    pausedBody:
      "L'ultimo pagamento non è andato a buon fine, quindi gli strumenti Pro restano bloccati finché non riesce. Tutte le modifiche già applicate restano come sono e puoi sempre annullarle con Ripristina.",
    trialEndedTitle: "La prova gratuita è terminata",
    endedTitle: "Il tuo piano Pro è terminato",
    endedBody:
      "Gli strumenti Pro ora sono bloccati. Tutte le modifiche già applicate restano come sono e puoi sempre annullarle con Ripristina.",
    converted: "La prova gratuita ora è un abbonamento Pro. Grazie!",
    seePlans: "Vedi i piani",
  },
  fr: {
    start: "Commencer l'essai gratuit de {days} jours",
    subscribeNow: "S'abonner maintenant",
    subscribe: "S'abonner",
    subscribeNowNote: "Ou abonnez-vous maintenant : {price} prélevés aujourd'hui, sans essai.",
    thenMonth:
      "Ensuite {price} par mois, premier prélèvement le {date}. Résiliable à tout moment depuis le portail de facturation.",
    thenYear:
      "Ensuite {price} par an, premier prélèvement le {date}. Résiliable à tout moment depuis le portail de facturation.",
    thenMonthPromo:
      "Ensuite {price} le premier mois, prélevés le {date}, puis {regular} par mois. Résiliable à tout moment depuis le portail de facturation.",
    thenYearPromo:
      "Ensuite {price} la première année, prélevés le {date}, puis {regular} par an. Résiliable à tout moment depuis le portail de facturation.",
    used: "Ce compte a déjà utilisé son essai gratuit. L'offre démarre directement en abonnement payant.",
    trial: "Essai gratuit",
    leftDays: "Encore {days} j {hours} h",
    leftHours: "Encore {hours} h {minutes} min",
    leftMinutes: "Encore {minutes} min",
    firstCharge: "Premier prélèvement le {date}",
    noCharge: "Résilié : fin le {date}, aucun prélèvement",
    paymentFailed: "Paiement refusé",
    paymentFailedHint: "Mettez à jour votre moyen de paiement pour réactiver Pro.",
    updatePayment: "Mettre à jour le moyen de paiement",
    ended: "Terminé",
    trialUsed: "Essai gratuit déjà utilisé",
    pausedTitle: "Pro est en pause",
    pausedBody:
      "Le dernier paiement n'a pas abouti : les outils Pro restent verrouillés jusqu'à ce qu'il réussisse. Les modifications déjà appliquées restent en place et vous pouvez toujours les annuler avec Restaurer.",
    trialEndedTitle: "Votre essai gratuit est terminé",
    endedTitle: "Votre offre Pro est terminée",
    endedBody:
      "Les outils Pro sont maintenant verrouillés. Les modifications déjà appliquées restent en place et vous pouvez toujours les annuler avec Restaurer.",
    converted: "Votre essai gratuit est devenu un abonnement Pro. Merci !",
    seePlans: "Voir les offres",
  },
  es: {
    start: "Empezar la prueba gratuita de {days} días",
    subscribeNow: "Suscribirse ahora",
    subscribe: "Suscribirse",
    subscribeNowNote: "O suscríbete ahora: {price} con cargo hoy, sin prueba.",
    thenMonth:
      "Después, {price} al mes, con el primer cargo el {date}. Cancela cuando quieras desde el portal de pagos.",
    thenYear:
      "Después, {price} al año, con el primer cargo el {date}. Cancela cuando quieras desde el portal de pagos.",
    thenMonthPromo:
      "Después, {price} el primer mes, con cargo el {date}, y {regular} al mes a partir de entonces. Cancela cuando quieras desde el portal de pagos.",
    thenYearPromo:
      "Después, {price} el primer año, con cargo el {date}, y {regular} al año a partir de entonces. Cancela cuando quieras desde el portal de pagos.",
    used: "Esta cuenta ya ha usado su prueba gratuita. El plan empieza directamente como suscripción de pago.",
    trial: "Prueba gratuita",
    leftDays: "Quedan {days} d {hours} h",
    leftHours: "Quedan {hours} h {minutes} min",
    leftMinutes: "Quedan {minutes} min",
    firstCharge: "Primer cargo el {date}",
    noCharge: "Cancelada: termina el {date}, sin cargo",
    paymentFailed: "Pago rechazado",
    paymentFailedHint: "Actualiza tu método de pago para volver a activar Pro.",
    updatePayment: "Actualizar método de pago",
    ended: "Terminado",
    trialUsed: "Prueba gratuita ya usada",
    pausedTitle: "Pro está en pausa",
    pausedBody:
      "El último pago no se ha completado, así que las herramientas Pro quedan bloqueadas hasta que se complete. Todo lo que ya cambiaste sigue igual y puedes deshacerlo cuando quieras con Restaurar.",
    trialEndedTitle: "Tu prueba gratuita ha terminado",
    endedTitle: "Tu plan Pro ha terminado",
    endedBody:
      "Las herramientas Pro ya están bloqueadas. Todo lo que ya cambiaste sigue igual y puedes deshacerlo cuando quieras con Restaurar.",
    converted: "Tu prueba gratuita ya es una suscripción Pro. ¡Gracias!",
    seePlans: "Ver planes",
  },
  de: {
    start: "{days} Tage kostenlos testen",
    subscribeNow: "Jetzt abonnieren",
    subscribe: "Abonnieren",
    subscribeNowNote: "Oder jetzt abonnieren: {price} werden heute abgebucht, ohne Testphase.",
    thenMonth:
      "Danach {price} pro Monat, erste Abbuchung am {date}. Jederzeit im Kundenportal kündbar.",
    thenYear:
      "Danach {price} pro Jahr, erste Abbuchung am {date}. Jederzeit im Kundenportal kündbar.",
    thenMonthPromo:
      "Danach {price} für den ersten Monat, abgebucht am {date}, anschließend {regular} pro Monat. Jederzeit im Kundenportal kündbar.",
    thenYearPromo:
      "Danach {price} für das erste Jahr, abgebucht am {date}, anschließend {regular} pro Jahr. Jederzeit im Kundenportal kündbar.",
    used: "Dieses Konto hat seine kostenlose Testphase bereits genutzt. Der Tarif startet sofort als kostenpflichtiges Abonnement.",
    trial: "Kostenlose Testphase",
    leftDays: "Noch {days} T. {hours} Std.",
    leftHours: "Noch {hours} Std. {minutes} Min.",
    leftMinutes: "Noch {minutes} Min.",
    firstCharge: "Erste Abbuchung am {date}",
    noCharge: "Gekündigt: endet am {date}, keine Abbuchung",
    paymentFailed: "Zahlung fehlgeschlagen",
    paymentFailedHint: "Aktualisieren Sie Ihre Zahlungsmethode, um Pro wieder freizuschalten.",
    updatePayment: "Zahlungsmethode aktualisieren",
    ended: "Beendet",
    trialUsed: "Kostenlose Testphase bereits genutzt",
    pausedTitle: "Pro ist pausiert",
    pausedBody:
      "Die letzte Zahlung ist nicht durchgegangen, daher bleiben die Pro-Werkzeuge gesperrt, bis sie gelingt. Alle bereits vorgenommenen Änderungen bleiben bestehen, und Sie können sie jederzeit mit „Zurücksetzen“ rückgängig machen.",
    trialEndedTitle: "Ihre kostenlose Testphase ist beendet",
    endedTitle: "Ihr Pro-Tarif ist beendet",
    endedBody:
      "Die Pro-Werkzeuge sind jetzt gesperrt. Alle bereits vorgenommenen Änderungen bleiben bestehen, und Sie können sie jederzeit mit „Zurücksetzen“ rückgängig machen.",
    converted: "Ihre kostenlose Testphase ist jetzt ein Pro-Abo. Vielen Dank!",
    seePlans: "Tarife ansehen",
  },
  pt: {
    start: "Experimentar {days} dias grátis",
    subscribeNow: "Subscrever agora",
    subscribe: "Subscrever",
    subscribeNowNote: "Ou subscreva agora: {price} cobrados hoje, sem avaliação gratuita.",
    thenMonth:
      "Depois, {price} por mês, com a primeira cobrança a {date}. Pode cancelar quando quiser no portal de faturação.",
    thenYear:
      "Depois, {price} por ano, com a primeira cobrança a {date}. Pode cancelar quando quiser no portal de faturação.",
    thenMonthPromo:
      "Depois, {price} no primeiro mês, cobrados a {date}, e {regular} por mês a seguir. Pode cancelar quando quiser no portal de faturação.",
    thenYearPromo:
      "Depois, {price} no primeiro ano, cobrados a {date}, e {regular} por ano a seguir. Pode cancelar quando quiser no portal de faturação.",
    used: "Esta conta já utilizou a sua avaliação gratuita. O plano começa de imediato como subscrição paga.",
    trial: "Avaliação gratuita",
    leftDays: "Faltam {days} d {hours} h",
    leftHours: "Faltam {hours} h {minutes} min",
    leftMinutes: "Faltam {minutes} min",
    firstCharge: "Primeira cobrança a {date}",
    noCharge: "Cancelada: termina a {date}, sem cobrança",
    paymentFailed: "Pagamento recusado",
    paymentFailedHint: "Atualize o método de pagamento para reativar o Pro.",
    updatePayment: "Atualizar método de pagamento",
    ended: "Terminado",
    trialUsed: "Avaliação gratuita já utilizada",
    pausedTitle: "O Pro está em pausa",
    pausedBody:
      "O último pagamento não foi concluído, por isso as ferramentas Pro ficam bloqueadas até que seja. Todas as alterações já aplicadas mantêm-se e pode sempre anulá-las com Restaurar.",
    trialEndedTitle: "A sua avaliação gratuita terminou",
    endedTitle: "O seu plano Pro terminou",
    endedBody:
      "As ferramentas Pro estão agora bloqueadas. Todas as alterações já aplicadas mantêm-se e pode sempre anulá-las com Restaurar.",
    converted: "A sua avaliação gratuita passou a ser uma subscrição Pro. Obrigado!",
    seePlans: "Ver planos",
  },
};
