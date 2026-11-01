import type { Lang } from "../i18n";

/** "Unlock with Telegram" in the account menu (backend src/telegram.ts). The bonus only lengthens a
 *  running free trial, so no string may promise days to an account without one. */
type TelegramCopy = {
  menu: string;
  waiting: string;
  granted: string;
  linked: string;
  already: string;
  notMember: string;
  rejected: string;
  expired: string;
  failed: string;
};

export const TELEGRAM_COPY: Record<Lang, TelegramCopy> = {
  en: {
    menu: "Unlock with Telegram: +4 trial days",
    waiting: "Finish in Telegram…",
    granted: "4 days added to your free trial.",
    linked: "Telegram linked. The 4 extra days apply while a free trial is running.",
    already: "This account has already received the Telegram bonus.",
    notMember: "Join the channel in Telegram, then tap “I've joined”.",
    rejected: "This Telegram account is linked to a different PC Tweaker account.",
    expired: "The Telegram link expired. Try again.",
    failed: "Telegram unlock is unavailable right now. Try again later.",
  },
  it: {
    menu: "Sblocca con Telegram: +4 giorni di prova",
    waiting: "Completa in Telegram…",
    granted: "4 giorni aggiunti alla tua prova gratuita.",
    linked: "Telegram collegato. I 4 giorni in più valgono mentre è attiva una prova gratuita.",
    already: "Questo account ha già ricevuto il bonus Telegram.",
    notMember: "Iscriviti al canale in Telegram, poi tocca “I've joined”.",
    rejected: "Questo account Telegram è collegato a un altro account PC Tweaker.",
    expired: "Il link di Telegram è scaduto. Riprova.",
    failed: "Lo sblocco con Telegram ora non è disponibile. Riprova più tardi.",
  },
  fr: {
    menu: "Débloquer avec Telegram : +4 jours d'essai",
    waiting: "Terminez dans Telegram…",
    granted: "4 jours ajoutés à votre essai gratuit.",
    linked:
      "Telegram est lié. Les 4 jours supplémentaires s'appliquent pendant un essai gratuit en cours.",
    already: "Ce compte a déjà reçu le bonus Telegram.",
    notMember: "Rejoignez la chaîne dans Telegram, puis touchez « I've joined ».",
    rejected: "Ce compte Telegram est lié à un autre compte PC Tweaker.",
    expired: "Le lien Telegram a expiré. Réessayez.",
    failed: "Le déblocage avec Telegram n'est pas disponible pour le moment. Réessayez plus tard.",
  },
  es: {
    menu: "Desbloquear con Telegram: +4 días de prueba",
    waiting: "Termina en Telegram…",
    granted: "Se han añadido 4 días a tu prueba gratuita.",
    linked:
      "Telegram vinculado. Los 4 días extra se aplican mientras haya una prueba gratuita en curso.",
    already: "Esta cuenta ya ha recibido el bono de Telegram.",
    notMember: "Únete al canal en Telegram y luego toca «I've joined».",
    rejected: "Esta cuenta de Telegram está vinculada a otra cuenta de PC Tweaker.",
    expired: "El enlace de Telegram ha caducado. Inténtalo de nuevo.",
    failed: "El desbloqueo con Telegram no está disponible ahora. Inténtalo más tarde.",
  },
  de: {
    menu: "Mit Telegram freischalten: +4 Testtage",
    waiting: "In Telegram abschließen…",
    granted: "4 Tage wurden Ihrem kostenlosen Test hinzugefügt.",
    linked:
      "Telegram verknüpft. Die 4 zusätzlichen Tage gelten während eines laufenden kostenlosen Tests.",
    already: "Dieses Konto hat den Telegram-Bonus bereits erhalten.",
    notMember: "Treten Sie dem Kanal in Telegram bei und tippen Sie dann auf „I've joined“.",
    rejected: "Dieses Telegram-Konto ist mit einem anderen PC Tweaker-Konto verknüpft.",
    expired: "Der Telegram-Link ist abgelaufen. Bitte erneut versuchen.",
    failed:
      "Die Freischaltung mit Telegram ist gerade nicht verfügbar. Bitte später erneut versuchen.",
  },
  pt: {
    menu: "Desbloquear com o Telegram: +4 dias de avaliação",
    waiting: "Conclua no Telegram…",
    granted: "Foram adicionados 4 dias à sua avaliação gratuita.",
    linked:
      "Telegram associado. Os 4 dias extra aplicam-se durante uma avaliação gratuita em curso.",
    already: "Esta conta já recebeu o bónus do Telegram.",
    notMember: "Adira ao canal no Telegram e depois toque em «I've joined».",
    rejected: "Esta conta do Telegram está associada a outra conta do PC Tweaker.",
    expired: "A ligação do Telegram expirou. Tente novamente.",
    failed: "O desbloqueio com o Telegram não está disponível de momento. Tente mais tarde.",
  },
};
