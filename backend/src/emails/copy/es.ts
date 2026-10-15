import type { Copy } from "./index";

/** Español: de tú, como las aplicaciones; etiquetas idénticas a la interfaz. */
const named = (lead: string, n: string, end = ".") => (n ? `${lead}, ${n}${end}` : `${lead}${end}`);

export const es: Copy = {
  tag: "es",
  dateLocale: "es-ES",

  shell: {
    writeTo: (address: string) => `Escribe a ${address} o responde a este correo.`,
    expectation: "Lo leemos todo y normalmente contestamos en un día laborable.",
    neverSend: "Nunca envíes contraseñas ni números de tarjeta por correo.",
    questions: "¿Preguntas?",
    family: "Una sola cuenta para PC Tweaker, PC Tweaker Uninstaller y Tweaky Driver.",
    support: "Soporte",
    privacy: "Privacidad",
    terms: "Condiciones",
    linkFallback: "Si el botón no se abre, copia esta dirección en el navegador:",
    ifYou: "Si fuiste tú:",
    ifNot: "Si no fuiste tú:",
    unsubscribe: "Darse de baja",
  },

  plans: { monthly: "Pro, mensual", annual: "Pro, anual", lifetime: "Pro, de por vida" },

  verify: {
    subject: (b: string) => `Confirma tu correo para ${b}`,
    preheader: "Un clic confirma esta dirección. El enlace vale 24 horas.",
    eyebrow: "Confirma tu correo",
    headline: (n: string) => named("Te queda un paso", n),
    intro: (b: string) =>
      `Has creado una cuenta de ${b} con esta dirección. Confírmala y la cuenta queda activa. La cuenta es lo que lleva un plan Pro de un PC a otro, y es la única forma de enviarte más adelante el restablecimiento de la contraseña.`,
    button: "Confirmar mi correo",
    stepsTitle: "Después de confirmar",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "Vuelve al Uninstaller e inicia sesión desde el panel <strong>Cuenta</strong>. La aplicación comprueba la cuenta al iniciar sesión, así que no hay nada que actualizar a mano.",
            "Nada de lo que eliminaste cambia. Las desinstalaciones individuales, la búsqueda de restos y el Registro de eliminaciones nunca necesitaron una cuenta.",
            "El pago de Uninstaller Pro solo se abre con la dirección confirmada. Un plan de PC Tweaker en la misma cuenta desbloquea el precio de fidelidad.",
          ]
        : [
            "Vuelve a PC Tweaker e inicia sesión desde el botón <strong>Cuenta</strong>. La aplicación comprueba la cuenta al iniciar sesión, así que no hay nada que actualizar a mano.",
            "Nada de lo que ya aplicaste cambia. Free nunca necesitó una cuenta: los ajustes Free, el Análisis y tu Historial de cambios siguen tal como los dejaste.",
            "El pago de Pro solo se abre con la dirección confirmada. Una licencia Pro se firma para la cuenta, no para el equipo: para usarla en otro PC basta con iniciar sesión.",
          ],
    noteHtml: (b: string) =>
      `El enlace vale 24 horas y una sola vez. Si ha caducado, abre el menú de la cuenta en la aplicación y elige <strong>Reenviar</strong>. Si no creaste una cuenta de ${b}, ignora este correo: sin el clic no pasa nada.`,
    helpTitle: "¿El enlace no llega, o llega dos veces?",
    helpText: "Revisa primero la carpeta de spam y luego dinos la dirección con la que te registraste.",
    why: (b: string) => `Recibes este correo porque se creó una cuenta de ${b} con esta dirección.`,
  },

  welcome: {
    subject: (b: string) => `Tu cuenta de ${b} está lista`,
    preheader: (u: boolean) =>
      u ? "Tres cosas que probar primero, y lo que añade Pro." : "Tres ajustes que probar primero, y cómo se deshace cada cambio.",
    eyebrow: "Cuenta lista",
    headline: (n: string) => named("Ya estás dentro", n),
    intro: (u: boolean, free: number) =>
      u
        ? "Tu dirección está confirmada y la cuenta está activa. Inicia sesión desde el panel Cuenta del Uninstaller y todo lo que sigue es tuyo sin pagar nada. Por aquí conviene empezar."
        : `Tu dirección está confirmada y la cuenta está activa. Inicia sesión desde el botón Cuenta de la aplicación y los ${free} ajustes Free, el Análisis, la Puntuación de salud y el Historial de cambios son tuyos sin pagar nada. Por aquí conviene empezar.`,
    stepsTitle: "Tres cosas que probar primero",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "<strong>Aplicaciones instaladas.</strong> Cada programa del PC, aplicaciones de Microsoft Store incluidas, con su tamaño y su editor.",
            "<strong>Detalles, luego Desinstalar.</strong> Cada programa muestra un nivel de confianza y un resumen de la eliminación antes de que se ejecute nada, y para los programas instalados para todo el equipo se intenta antes un punto de restauración.",
            "<strong>La búsqueda de restos.</strong> Tras una desinstalación, la aplicación busca archivos y claves de registro que dejó el programa, y el Registro de eliminaciones anota lo eliminado y el espacio liberado.",
          ]
        : [
            "<strong>Análisis, luego Iniciar análisis del sistema.</strong> Comprobaciones de inicio, almacenamiento, memoria, privacidad, rendimiento y actualizaciones. Los cambios recomendados y los opcionales aparecen por separado, y no se aplica nada hasta que lo apruebes. Corregir todo muestra primero los ajustes exactos y después comprueba cada uno.",
            "<strong>Inicio.</strong> Lo que arranca con Windows, con el editor junto a cada elemento. Desactivar dos o tres que nunca usas es el cambio que más gente nota en el siguiente arranque, y cada elemento tiene su propia restauración.",
            "<strong>Perfiles.</strong> Gaming, Estudio y Trabajo están incluidos en Free. Abre uno, lee las ventajas e inconvenientes de cada tarjeta, desmarca lo que no quieras y aplica el resto con un clic. Un perfil añade sus ajustes sin deshacer nada más de lo que cambiaste.",
          ],
    noteHtml: (u: boolean, guideLink: (label: string) => string) =>
      u
        ? "La limpieza de restos, la eliminación por lotes y la eliminación de entradas rotas son de Uninstaller Pro. Si la misma cuenta tiene un plan de PC Tweaker, Pro cuesta menos: el precio está en Planes y precios."
        : `Antes de escribir nada, PC Tweaker guarda el valor anterior, y cada tarjeta de ajuste tiene <strong>Qué modifica exactamente</strong>. Restaura desde el propio ajuste, o abre el Historial de cambios y usa <strong>Restaurar ajustes activos</strong>. La limpieza que va a la Papelera de reciclaje se puede recuperar hasta que la vacíes; las actualizaciones de controladores, las reparaciones y los ajustes de hardware tienen sus propios pasos de recuperación. Detalles: ${guideLink("cómo deshacer ajustes de Windows")}.`,
    button: (b: string) => `Abrir ${b}`,
    helpTitle: "¿Algo no funciona como se describe?",
    helpText: "Dinos la versión de la aplicación y en qué hiciste clic.",
    why: (b: string) => `Recibes este correo porque confirmaste una cuenta de ${b} con esta dirección. Se envía una sola vez.`,
  },

  reset: {
    subject: (b: string) => `Restablece tu contraseña de ${b}`,
    preheader: "El enlace vale una vez, durante una hora. No cambia nada hasta que lo uses.",
    eyebrow: "Restablecer contraseña",
    headline: "Elige una contraseña nueva.",
    intro: (b: string) =>
      `Alguien ha pedido restablecer la contraseña de la cuenta de ${b} asociada a esta dirección. Si fuiste tú, el botón de abajo abre una página donde elegir una nueva. Todavía no ha cambiado nada.`,
    button: "Elegir una contraseña nueva",
    rows: [
      ["Enlace válido", "Una hora, un solo uso"],
      ["Contraseña nueva", "Al menos 8 caracteres, hasta 72 bytes"],
      ["Se aplica a", "PC Tweaker, PC Tweaker Uninstaller y Tweaky Driver"],
      ["Tras el cambio", "Se cierra la sesión en cada PC conectado"],
    ],
    after:
      "Cuando la contraseña nueva esté guardada, vuelve a iniciar sesión en cada PC donde uses las aplicaciones. Los ajustes aplicados, el historial y cualquier plan Pro dependen de la cuenta y del equipo, no de la contraseña, así que ahí no cambia nada.",
    note:
      "¿No lo pediste tú? Ignora el correo: el enlace vale una hora y una sola vez, y tu contraseña se queda exactamente como está. Si estas solicitudes siguen llegando, escríbenos y miraremos de dónde vienen.",
    helpTitle: "¿Enlace caducado, o la página dice que no es válido?",
    helpTextHtml:
      "Pide uno nuevo desde <strong>¿Olvidaste la contraseña?</strong> en la pantalla de inicio de sesión y usa el correo más reciente que recibas.",
    why: (b: string) => `Recibes este correo porque se pidió restablecer la contraseña de la cuenta de ${b} asociada a esta dirección.`,
  },

  changed: {
    subject: (b: string) => `Tu contraseña de ${b} ha cambiado`,
    preheader: (when: string) => `Cambiada el ${when}. Se cerró la sesión en los demás PC. Si no fuiste tú, sigue leyendo.`,
    eyebrow: "Aviso de seguridad",
    headline: (n: string) => named("Tu contraseña ha cambiado", n),
    intro: (b: string, when: string) =>
      `La contraseña de tu cuenta de ${b} se cambió el ${when}. Se ha cerrado la sesión en todos los dispositivos conectados, en PC Tweaker, PC Tweaker Uninstaller y Tweaky Driver.`,
    ifYou: "vuelve a iniciar sesión en cada PC y listo. Los ajustes aplicados, el historial y tu plan siguen intactos.",
    ifNot: "otra persona puso esa contraseña y la anterior ya no funciona. Haz estas tres cosas, en este orden.",
    stepsTitle: "Si no fuiste tú",
    stepsHtml: [
      "Abre la aplicación, elige <strong>¿Olvidaste la contraseña?</strong> en la pantalla de inicio de sesión y pide el restablecimiento a esta dirección. El enlace que recibas es solo tuyo, y usarlo cierra la sesión de la otra persona.",
      "Elige una contraseña que no uses en ningún otro sitio. Si este buzón de correo comparte la contraseña anterior, cámbiala también: es la cuenta por la que habría pasado un atacante.",
      "Responde a este correo para que revisemos también la cuenta desde nuestro lado.",
    ],
    button: "Contactar con soporte",
    noteHtml:
      "Este correo no incluye, a propósito, ningún enlace que cambie nada ni ningún código: un botón de restablecimiento en un mensaje &quot;¿fuiste tú?&quot; es justo lo que ofrecería un correo falso. Nunca te pediremos la contraseña por correo.",
    helpTitle: "¿Quieres que revisemos la cuenta?",
    helpText: "Los mensajes de seguridad se leen primero.",
    expectation: "Normalmente recibirás respuesta en un día laborable.",
    why: (b: string) => `Este aviso se envía cada vez que cambia la contraseña de una cuenta de ${b}. No se puede desactivar.`,
  },

  emailChange: {
    subject: (b: string) => `Confirma tu nuevo correo para ${b}`,
    preheader: "Un clic traslada tu cuenta a esta dirección. El enlace vale 24 horas.",
    eyebrow: "Confirmar la nueva dirección",
    headline: (n: string) => named("Confirma esta dirección", n),
    intro:
      "Has pedido trasladar a esta dirección la cuenta que usan PC Tweaker, PC Tweaker Uninstaller y Tweaky Driver. Confírmala y a partir de ahora iniciarás sesión con esta dirección; la anterior dejará de servir para iniciar sesión.",
    button: "Confirmar la nueva dirección",
    note: "El enlace vale 24 horas y una sola vez. Hasta que confirmes, no cambia nada. Tras el traslado, se cierra la sesión en cada PC conectado.",
    helpTitle: "¿No lo pediste tú?",
    helpText: "Ignora este correo: la cuenta se queda en su dirección actual.",
    why: "Recibes este correo porque alguien inició sesión en una cuenta de PC Tweaker y pidió trasladarla a esta dirección.",
  },

  emailChanged: {
    subject: (b: string) => `El correo de tu cuenta de ${b} ha cambiado`,
    preheader: (masked: string) => `La cuenta usa ahora ${masked}. Si no fuiste tú, sigue leyendo.`,
    eyebrow: "Aviso de seguridad",
    headline: (n: string) => named("El correo de tu cuenta ha cambiado", n),
    intro: (masked: string, when: string) =>
      `El ${when}, la cuenta que usan PC Tweaker, PC Tweaker Uninstaller y Tweaky Driver pasó de esta dirección a ${masked}. Se cerró la sesión en todos los PC conectados; ahora se inicia sesión con la nueva dirección.`,
    ifYou: "no tienes que hacer nada más. Planes, ajustes e historial se han ido con la cuenta.",
    ifNot:
      "alguien que conocía tu contraseña trasladó la cuenta. Responde a este correo cuanto antes: podemos devolverla y bloquearla mientras lo revisamos. Después cambia esa contraseña en todos los sitios donde la usaste.",
    button: "Contactar con soporte",
    note: "Este correo no incluye, a propósito, ningún enlace que cambie nada. Nunca te pediremos la contraseña por correo.",
    helpTitle: "¿Quieres que revisemos la cuenta?",
    helpText: "Los mensajes de seguridad se leen primero.",
    why: (b: string) => `Este aviso se envía a la dirección anterior cada vez que cambia el correo de una cuenta de ${b}. No se puede desactivar.`,
  },

  signIn: {
    subject: (b: string) => `Nuevo inicio de sesión en tu cuenta de ${b}`,
    preheader: (device: string, when: string) => `Inicio de sesión en ${device} el ${when}. Si fuiste tú, no tienes que hacer nada.`,
    eyebrow: "Nuevo inicio de sesión",
    aPc: "un PC con Windows",
    headline: (device: string) => `Nuevo inicio de sesión en ${device}.`,
    intro: (b: string) =>
      `Se inició sesión en tu cuenta de ${b} desde un PC o una red que no habíamos visto antes en esta cuenta. Lo enviamos una vez por cada PC nuevo, y solo cuando la contraseña es correcta; una contraseña equivocada nunca genera este correo.`,
    rows: { device: "PC", when: "Cuándo", account: "Cuenta" },
    ifYou: "no tienes que hacer nada, por ejemplo un segundo PC, una reinstalación o una red nueva. Un plan Pro va con la cuenta.",
    ifNotHtml:
      "cambia ya tu contraseña desde <strong>¿Olvidaste la contraseña?</strong> en la pantalla de inicio de sesión. Una contraseña nueva cierra la sesión en todos los PC a la vez, incluido este. Después responde a este correo para que revisemos la cuenta.",
    note:
      "Este correo no incluye, a propósito, ningún enlace para cerrar sesiones: un enlace «proteger mi cuenta» en una alerta de seguridad es justo la forma que tendría un mensaje falso. La única acción segura es el restablecimiento que inicias tú en la aplicación. Nunca te pediremos la contraseña por correo.",
    helpTitle: "¿No estás seguro de que fueras tú?",
    helpText: "Trátalo como si no hubieras sido tú y avísanos. Los mensajes de seguridad se leen primero.",
    why: (b: string) => `Este aviso se envía la primera vez que un PC o una red nuevos inician sesión en una cuenta de ${b}. No se puede desactivar.`,
  },

  receipt: {
    subject: (u: boolean, lifetime: boolean) =>
      u
        ? lifetime
          ? "Tu compra de PC Tweaker Uninstaller Pro está confirmada"
          : "Tu suscripción a PC Tweaker Uninstaller Pro está activa"
        : lifetime
          ? "Tu licencia PC Tweaker Pro Lifetime está activa"
          : "Tu suscripción a PC Tweaker Pro está activa",
    rows: {
      plan: "Plan",
      charged: "Cobrado",
      renewsOn: "Se renueva el",
      access: "Acceso",
      neverExpires: "No caduca nunca",
      renewal: "Renovación",
      renewalNone: "Ninguna. No se cobra nada más.",
      included: "Incluido",
      includedValue: "12 meses de PC Tweaker Uninstaller Pro",
      account: "Cuenta",
      shared: (email: string) => `${email} (compartida con PC Tweaker)`,
    },
    eyebrowPro: "Pro activado",
    eyebrowLifetime: "Licencia Lifetime",
    buttonPct: "Abrir PC Tweaker",
    buttonUn: "Abrir Uninstaller",
    help: {
      title: "¿Has pagado y aún no eres Pro, o te han cobrado algo que no esperabas?",
      text: "Dinos la dirección de la cuenta y la fecha del recibo de Stripe.",
      expectation: "Las respuestas sobre facturación suelen salir en un día laborable.",
    },
    sub: {
      headline: (n: string) => named("Pro está activo en tu cuenta", n),
      preheader: (plan: string, price: string, renews: string) =>
        `${plan}, ${price}, se renueva el ${renews}. Cómo gestionar el plan y usar Pro en un segundo PC.`,
      intro: (email: string, total: number, free: number, pro: number) =>
        `Stripe confirmó el pago y la licencia de ${email} está firmada. Los ${total} ajustes están disponibles ya: los ${free} que tenías con Free más los ${pro} de Pro, Game Sessions y el perfil Turbo Gaming incluidos. La aplicación actualiza su licencia cuando vuelves del pago con conexión, así que Pro ya debería aparecer.`,
      stepsTitle: "Lo que conviene saber desde el primer día",
      stepsHtml: (who: string, renews: string) => [
        `<strong>Gestionar el plan.</strong> Abre Planes y precios en la aplicación. Muestra el plan y abre el portal de facturación de Stripe, donde cambias la tarjeta o cancelas. Un plan cancelado sigue siendo Pro hasta el ${renews} y no se vuelve a cobrar.`,
        `<strong>Un segundo PC.</strong> Instala allí PC Tweaker e inicia sesión con ${who}. La licencia se firma para la cuenta, no para el equipo, así que es Pro en los dos. Los ajustes aplicados y el Historial de cambios son de cada equipo.`,
        "<strong>Tras reinstalar Windows o cambiar de hardware.</strong> Vuelve a iniciar sesión y Pro regresa solo. El Historial de cambios no se traslada, así que vuelve a aplicar un perfil en lugar de buscar una restauración.",
        "<strong>Por dónde empezar con Pro.</strong> Gaming y luego Game Sessions: registra un juego y los ajustes turbo se activan al iniciarlo y se deshacen al cerrarlo.",
      ],
      note: "Stripe envía la factura y el recibo del pago por separado, desde su propia dirección; guárdalos para tus registros. Si la aplicación sigue mostrando Free tras unos minutos, cierra sesión y vuelve a entrar: la licencia se lee de nuevo al iniciar sesión.",
      why: "Recibes este correo porque se inició una suscripción a PC Tweaker Pro en la cuenta asociada a esta dirección.",
    },
    lifetime: {
      headline: (n: string) => named("Pro, para siempre. Gracias", n),
      preheader: (price: string) =>
        `Un solo pago de ${price}, sin renovación. Incluye 12 meses de Uninstaller Pro, activados al primer inicio de sesión.`,
      intro: (email: string, total: number) =>
        `Has pagado una vez y es la última vez que cobramos a esta cuenta. La licencia Lifetime de ${email} está firmada y los ${total} ajustes, Game Sessions y el perfil Turbo Gaming están disponibles ya.`,
      stepsTitle: "Qué significa Lifetime en la práctica",
      stepsHtml: (who: string, uninstallerLink: string) => [
        `<strong>Todos tus PC.</strong> Inicia sesión con ${who} en cualquier PC con Windows 10 u 11 y será Pro. No hay activaciones que contar ni claves de licencia que escribir: la clave es la cuenta.`,
        `<strong>Uninstaller Pro durante un año.</strong> Instala PC Tweaker Uninstaller desde ${uninstallerLink} e inicia sesión con la misma cuenta. Los 12 meses empiezan la primera vez que inicias sesión allí, no hoy. Es una ventaja aparte y con fecha de fin, no una licencia Lifetime de Uninstaller.`,
        "<strong>Reinstalaciones y hardware nuevo.</strong> Nada que trasladar. Tras un Windows nuevo, instala PC Tweaker, inicia sesión y Pro vuelve. El Historial de cambios pertenece a la instalación anterior, así que empieza por un perfil en lugar de esperar que vuelvan los ajustes antiguos.",
        "<strong>Actualizaciones.</strong> PC Tweaker busca las actualizaciones por sí mismo, y Lifetime cubre todas las actualizaciones de PC Tweaker Pro.",
      ],
      note: "Stripe envía la factura por separado. Si alguna vez ves un cargo mensual nuestro después de esta compra, escríbenos enseguida: una cuenta Lifetime no debe volver a cobrarse nunca, y lo solucionaremos.",
      why: "Recibes este correo porque se compró una licencia PC Tweaker Pro Lifetime en la cuenta asociada a esta dirección.",
    },
    un: {
      headline: (n: string) => named("Pro está activo", n, ". Ahora los restos también se pueden eliminar."),
      preheader: (plan: string, price: string, renews: string | null) =>
        `${plan}, ${price}, ${renews ? `se renueva el ${renews}` : "sin renovación"}. Limpieza de restos, eliminación por lotes y entradas rotas activadas.`,
      intro: (email: string) =>
        `Stripe confirmó el pago y la licencia Uninstaller Pro de ${email} está firmada. En la aplicación cambian tres cosas: la búsqueda de restos ya puede limpiar lo que encuentra, varios programas se pueden poner en cola y eliminar de una vez, y también se pueden quitar las entradas cuyo desinstalador ya no existe. Todo lo que tenías con Free, incluidos el nivel de confianza y el Registro de eliminaciones, sigue exactamente igual.`,
      stepsTitle: "Una primera eliminación limpia con Pro",
      stepsHtml: (lifetime: boolean, who: string, renews: string) => [
        "Elige un programa valorado como <strong>Seguro</strong> y lee su resumen de eliminación: el comando exacto, si se ejecuta Windows Installer o el desinstalador del propio programa, los permisos que pide y el tamaño indicado. No se ejecuta nada hasta que confirmes.",
        "Tras la desinstalación, la búsqueda de restos enumera las carpetas, accesos directos y claves de registro que dejó el programa. Con Pro puedes eliminarlos desde esa misma pantalla. Los archivos van a la Papelera de reciclaje, así que un error se puede recuperar hasta que la vacíes; los valores del registro se guardan en el Registro de eliminaciones.",
        "Para una limpieza mayor, marca varios programas e inicia un lote. Los programas protegidos nunca entran en un lote, la comprobación de programas relacionados sigue avisando antes de que un programa principal se lleve sus complementos, y antes de las eliminaciones con permisos elevados se intenta un punto de restauración, con el resultado registrado.",
        ...(lifetime
          ? []
          : [
              `<strong>Gestionar el plan.</strong> Planes y precios, en la barra superior, muestra la cuenta y el plan y abre el portal de facturación de Stripe para la tarjeta, la periodicidad o la cancelación. Un plan cancelado sigue siendo Pro hasta el ${renews}. Al iniciar sesión con ${who} en otro PC, también será Pro allí.`,
            ]),
      ],
      note: (lifetime: boolean) =>
        `${lifetime ? "Esta compra no se renueva. " : ""}Una cuenta, dos licencias: una licencia PC Tweaker Pro no desbloquea Uninstaller y esta no desbloquea PC Tweaker; cada aplicación comprueba la suya. Stripe envía la factura por separado. Si Uninstaller sigue mostrando Free tras unos minutos, cierra sesión y vuelve a entrar desde Planes y precios.`,
      help: {
        title: "¿Has pagado y aún no eres Pro, o una eliminación no fue como decía el resumen?",
        text: "Dinos la versión de la aplicación y la entrada del Registro de eliminaciones (se exporta a CSV).",
        expectation: "Normalmente contestamos en un día laborable.",
      },
      why: (lifetime: boolean) =>
        lifetime
          ? "Recibes este correo porque se compró PC Tweaker Uninstaller Pro en la cuenta de PC Tweaker asociada a esta dirección."
          : "Recibes este correo porque se inició una suscripción a Uninstaller Pro en la cuenta de PC Tweaker asociada a esta dirección.",
    },
  },

  reversal: {
    subject: (u: boolean) =>
      u ? "Se ha revertido tu pago de PC Tweaker Uninstaller Pro" : "Se ha revertido tu pago de PC Tweaker Pro",
    eyebrow: "Pago revertido",
    headline: (n: string) => named("Se ha revertido tu pago", n),
    rows: {
      amount: "Importe revertido",
      plan: "Plan",
      proAccess: "Acceso Pro",
      ended: "Finalizado",
      account: "Tu cuenta",
      accountValue: "Abierta, en Free",
      unPro: "Uninstaller Pro",
      unFree: "Sigue siendo tuyo con Free",
      unFreeValue: "Desinstalaciones individuales, nivel de confianza, resumen de eliminación, búsqueda de restos, Registro de eliminaciones",
    },
    pct: {
      lead: (amount: string | null) =>
        `${amount ? `Tu pago de ${amount}` : "Tu pago"} por PC Tweaker Pro ha sido revertido por tu proveedor de pagos.`,
      preheaderTail: "El acceso Pro ha finalizado; las funciones gratuitas siguen funcionando.",
      introTail:
        "Stripe nos lo ha comunicado, y el acceso Pro ligado a ese pago ha finalizado en tu cuenta. Este correo deja constancia de lo que cambió; no te pide nada.",
      ended: "El acceso Pro ligado a este pago ha finalizado. Tu cuenta y las funciones gratuitas siguen funcionando.",
      endedTail: "La aplicación vuelve a Free la próxima vez que compruebe la licencia, normalmente al siguiente inicio o inicio de sesión.",
      stopRenewal: "Si la suscripción en sí sigue activa, cancélala desde Planes y precios para que no se renueve.",
      oneOff: "Era una compra única, así que no queda ninguna suscripción que cancelar.",
      mistake: "Si crees que ha sido un error, responde a este correo y revisaremos contigo el registro de Stripe.",
    },
    un: {
      preheader: (amount: string | null) =>
        `${amount ?? "Tu pago"} ha sido revertido por tu proveedor de pagos. Pro ha finalizado; las desinstalaciones individuales, el resumen de eliminación y el Registro de eliminaciones siguen funcionando.`,
      intro: (amount: string | null) =>
        `Tu proveedor de pagos revirtió ${amount ? `el pago de ${amount}` : "tu pago"} por PC Tweaker Uninstaller Pro, y Stripe nos lo ha comunicado. El acceso Pro ligado a ese pago ha finalizado. Tu cuenta sigue abierta, igual que su parte de PC Tweaker: esta reversión solo afecta a Uninstaller.`,
      stops:
        "Lo que se detiene: la limpieza de restos, la eliminación por lotes y la eliminación de entradas rotas. Lo que no cambia: lo ya eliminado sigue eliminado, el Registro de eliminaciones conserva cada recibo, y los archivos que enviaste a la Papelera de reciclaje siguen ahí hasta que la vacíes.",
      stopRenewal:
        "Si la suscripción sigue figurando como activa en Stripe, cancélala desde Planes y precios en la barra superior para que no intente otro cobro.",
      oneOff: "Era un acceso único, así que no queda nada que cancelar.",
      origin:
        "Esta reversión vino de tu banco o del emisor de tu tarjeta, no de nosotros. Si no se la pediste a tu banco, responde a este correo con la fecha y el importe de tu extracto y revisaremos contigo el registro de Stripe.",
    },
    helpTitle: "¿Preguntas sobre esta reversión?",
    helpText: "Dinos la fecha y el importe que aparecen en tu extracto bancario.",
    why: (u: boolean) =>
      u
        ? "Recibes este correo porque se revirtió un pago de Uninstaller Pro en la cuenta de PC Tweaker asociada a esta dirección."
        : "Recibes este correo porque se revirtió un pago de PC Tweaker Pro en la cuenta asociada a esta dirección.",
  },

  ending: {
    subject: (b: string, ends: string) => `Tu plan ${b} Pro termina el ${ends}`,
    preheader: (ends: string) => `Pro sigue activo hasta el ${ends}; después la cuenta vuelve a Free. No se borra nada.`,
    eyebrow: "Plan a punto de terminar",
    headline: (n: string, ends: string) => named(`Pro sigue activo hasta el ${ends}`, n),
    intro: (b: string, failed: boolean, ends: string) =>
      failed
        ? `Stripe no pudo cobrar la renovación de tu suscripción a ${b} Pro. Pro sigue funcionando mientras Stripe reintenta el pago; si no se puede cobrar antes del ${ends}, la cuenta vuelve a Free.`
        : `Tu suscripción a ${b} Pro se ha cancelado, como pediste. No habrá más cobros. Todo lo de Pro funciona hasta el final del periodo ya pagado, y después la cuenta vuelve a Free.`,
    rows: { plan: "Plan", until: "Pro hasta el", next: "Próximo cobro", nextValue: "Ninguno", after: "Después" },
    afterValue: (u: boolean, free: number) =>
      u ? "Free: desinstalaciones individuales, búsqueda de restos, Registro de eliminaciones" : `Free: ${free} ajustes, Análisis, Puntuación de salud, Historial de cambios`,
    stepsTitle: (ends: string) => `Antes del ${ends}`,
    steps: (u: boolean, failed: boolean) => [
      u
        ? "La limpieza de restos y la eliminación por lotes se detienen cuando termina Pro. Lo ya eliminado sigue eliminado, y el Registro de eliminaciones conserva cada recibo."
        : "Los ajustes aplicados con controles Pro no se deshacen cuando termina Pro; Windows los mantiene. Si quieres devolver alguno a su valor predeterminado, hazlo ahora desde la tarjeta del ajuste o desde el Historial de cambios, donde la restauración también funciona con Free.",
      u
        ? "Los archivos enviados a la Papelera de reciclaje por una limpieza Pro siguen ahí hasta que la vacíes, con Pro o sin él."
        : "Cuando termina Pro, Game Sessions deja de activar los ajustes turbo al iniciar los juegos. No queda nada aplicado de una sesión ya cerrada, porque cada sesión se deshace al salir.",
      failed
        ? "Actualiza la tarjeta desde Planes y precios y luego Gestionar suscripción. Stripe reintenta la renovación por sí mismo; cuando lo consiga, Pro continúa sin interrupciones."
        : "¿Has cambiado de idea? Abre Planes y precios y luego Gestionar suscripción: hasta la fecha de fin, Stripe te deja reanudar el mismo plan sin un nuevo pago.",
    ],
    button: (b: string) => `Abrir ${b}`,
    note: "Cuando termina Pro no se borra nada: la cuenta, su historial y cada ajuste aplicado siguen exactamente donde están. Stripe envía por separado su propio aviso sobre la suscripción.",
    helpTitle: "¿No cancelaste, o la fecha parece incorrecta?",
    helpText: "Dínoslo y revisaremos contigo el registro de Stripe.",
    why: (b: string) => `Recibes este correo porque la suscripción a ${b} Pro de la cuenta asociada a esta dirección cambió de estado.`,
  },

  bonus: {
    subject: "Tus 12 meses de Uninstaller Pro han empezado",
    preheader: (ends: string) => `Incluido con tu licencia PC Tweaker Lifetime, activo hasta el ${ends}. Nada que pagar, nada que cancelar.`,
    eyebrow: "Ventaja Lifetime",
    headline: (n: string) => named("Tu año de Uninstaller Pro empezó hoy", n),
    intro: (ends: string) =>
      `Has iniciado sesión en PC Tweaker Uninstaller con la cuenta que tiene tu licencia PC Tweaker Lifetime, y ese primer inicio de sesión es lo que pone en marcha los 12 meses de Uninstaller Pro incluidos. No se ha cobrado ninguna tarjeta y no hay ninguna suscripción detrás; dura hasta el ${ends} y luego simplemente termina.`,
    rows: {
      entitlement: "Derecho",
      entitlementValue: "Uninstaller Pro, ventaja Lifetime de 12 meses",
      started: "Inicio",
      ends: "Fin",
      charged: "Cobrado",
      chargedValue: "Nada. Sin renovación.",
    },
    stepsTitle: "Lo que añade Pro durante el año",
    stepsHtml: [
      "<strong>Limpieza de restos.</strong> La búsqueda tras cada desinstalación ya enumeraba lo que quedaba; ahora puedes eliminar esas carpetas, accesos directos y claves de registro desde la misma pantalla. Los archivos van a la Papelera de reciclaje y los valores del registro se guardan en el Registro de eliminaciones.",
      "<strong>Eliminación por lotes.</strong> Marca varios programas y deja que se eliminen en un orden seguro. Los programas protegidos quedan excluidos, y para las eliminaciones con permisos elevados se intenta antes un punto de restauración.",
      "<strong>Entradas rotas.</strong> Los programas cuyo desinstalador ya no existe, que normalmente se quedan en la lista para siempre, se pueden eliminar.",
    ],
    button: "Abrir Uninstaller",
    note: (ends: string) =>
      `Cuando termine el año, Uninstaller vuelve a Free por sí solo: las desinstalaciones individuales, el nivel de confianza, la búsqueda de restos y el Registro de eliminaciones se quedan, y nada de lo eliminado vuelve. Tu licencia PC Tweaker Lifetime no cambia en ningún caso. Si quieres Pro después del ${ends}, un plan de pago de Uninstaller empezaría en Planes y precios; no hay ninguna conversión automática.`,
    helpTitle: "¿Pro no aparece en Uninstaller?",
    helpText: "Cierra sesión y vuelve a entrar una vez; cada aplicación lee su propia licencia al iniciar sesión.",
    why: "Recibes este correo porque se activó la ventaja Lifetime en la cuenta de PC Tweaker asociada a esta dirección. Se envía una sola vez.",
  },

  reminder: {
    subject: "Tu pago de PC Tweaker Lifetime",
    preheader: "El pago se cerró antes de completarse, así que no se cobró nada. Es el único recordatorio.",
    eyebrow: "Pago sin completar",
    headline: (n: string) => named("No se ha cobrado nada", n),
    intro:
      "Abriste un pago Lifetime de PC Tweaker Pro y la página de Stripe se cerró antes de que el pago se completara. No se cobró ninguna tarjeta y tu cuenta está exactamente como estaba. Si algo te frenó, esto es lo que la gente suele preguntar antes de decidirse.",
    rows: (total: number) => [
      ["Lifetime", "Un solo pago. Sin renovaciones, nunca."],
      ["Incluye", `Los ${total} ajustes, Game Sessions, todas las actualizaciones`],
      ["PC", "Cada PC en el que inicies sesión con esta cuenta"],
      ["También incluido", "12 meses de PC Tweaker Uninstaller Pro"],
    ],
    button: "Abrir PC Tweaker",
    retry:
      "Para volver a intentarlo, abre Planes y precios en la aplicación y elige Lifetime. El pago necesita una dirección de correo confirmada; si el botón aparece en gris es por eso, y Reenviar en el menú de la cuenta lo soluciona. El precio actual está en la tarjeta del plan y en la página de Stripe.",
    doubts:
      "Si se rechazó un método de pago, Stripe muestra el motivo en su página; otra tarjeta o un monedero digital suele funcionar. Y si decidiste que no, no pasa nada: Free sigue siendo Free, y este es el único recordatorio que recibirás sobre este pago.",
    helpTitle: "¿Alguna pregunta antes de decidir?",
    helpText: "Responde una persona de verdad.",
    why: "Recibes este correo porque se inició un pago Lifetime desde la cuenta de PC Tweaker asociada a esta dirección y no se completó. Un único recordatorio.",
    unsubscribe: "No recibir más correos como este.",
  },

  supportAck: {
    subject: "Hemos recibido tu solicitud de soporte de PC Tweaker",
    preheader: "Tu mensaje está en la cola. Responde a este correo para añadir un detalle o una captura.",
    eyebrow: "Solicitud de soporte recibida",
    headline: (n: string) => (n ? `Recibido, ${n}. Está en la cola.` : "Recibido. Está en la cola."),
    intro:
      "Tu mensaje ha llegado al buzón de soporte de PC Tweaker. Lo lee una persona, no un bot, y la respuesta llegará a esta dirección. La mayoría de las respuestas salen en un día laborable; lo que necesita que reproduzcamos el problema puede tardar algo más, y te lo diremos.",
    replyTo: "Respondemos a",
    stepsTitle: "Lo que acelera la respuesta",
    steps: [
      "Responde a este correo con lo que se te haya olvidado: la versión de la aplicación, tu versión de Windows y el ajuste o el análisis exactos que usaste. Un solo hilo lo mantiene todo junto.",
      "Si un ajuste se comporta mal, abre el Historial de cambios y dinos qué indica la entrada. Cada ajuste aplicado aparece allí con el valor que puso y el que sustituyó, lo que suele ser todo el diagnóstico.",
      "Las capturas ayudan; difumina antes todo lo personal. No incluyas nunca contraseñas, tokens de licencia ni datos de tarjeta, y si alguna vez parece que te los pedimos, el mensaje no es nuestro.",
    ],
    wait: "Mientras esperas: si hay que deshacer un cambio ya, Restaurar ajustes activos en el Historial de cambios devuelve cada ajuste registrado sin esperarnos.",
    guide: (link: string) => `La ${link} cubre los casos a los que no llega.`,
    guideLabel: "guía para deshacer cambios",
    notYouTitle: "¿No nos escribiste tú?",
    notYou:
      "Alguien escribió esta dirección en el formulario de soporte. Puedes ignorar este correo; a través del formulario no cambia nada en ninguna cuenta. Si sigue pasando, avísanos y bloquearemos el origen.",
    why: "Recibes este correo porque se envió una solicitud de soporte a PC Tweaker desde esta dirección.",
  },

  pages: {
    error: "Error",
    unavailable: "Este servicio no está disponible ahora mismo.",
    missingToken: "Este enlace está incompleto. Ábrelo directamente desde el correo.",
    verifiedTitle: "Correo verificado",
    verified: (b: string) => `Tu correo está verificado. Puedes cerrar esta ventana y volver a ${b}.`,
    alreadyVerified: (b: string) => `Tu correo ya estaba verificado. Puedes cerrar esta ventana y volver a ${b}.`,
    expiredTitle: "Enlace caducado",
    verifyExpired: "Este enlace de verificación no es válido o ha caducado. Pide uno nuevo desde la aplicación.",
    failed: "Algo ha fallado. Inténtalo de nuevo más tarde.",
    resetTitle: "Elige una contraseña nueva",
    resetLead:
      "Elige una que no uses en ningún otro sitio. Sirve para PC Tweaker, PC Tweaker Uninstaller y Tweaky Driver, y se cerrará la sesión en tus otros dispositivos.",
    newPassword: "Contraseña nueva",
    newPasswordPlaceholder: "Al menos 8 caracteres",
    passwordHint: "Usa al menos 8 caracteres y no más de 72 bytes UTF-8. Las letras con tilde y los emojis pueden ocupar varios bytes.",
    confirmPassword: "Confirma la contraseña",
    confirmPlaceholder: "Escríbela otra vez",
    update: "Actualizar contraseña",
    resetHint: "Este enlace vale una sola vez y caduca una hora después de enviarse.",
    notValidTitle: "Enlace no válido",
    notValidLead: "Esta página necesita el enlace de tu correo de restablecimiento. Abre ese enlace directamente en lugar de recargar la página.",
    passwordRule: "La contraseña debe tener al menos 8 caracteres y no más de 72 bytes UTF-8.",
    mismatch: "Las dos contraseñas no coinciden.",
    resetInvalid: "Este enlace de restablecimiento no es válido, ya se usó o ha caducado.",
    resetFailed: "No se pudo restablecer la contraseña. Inténtalo de nuevo.",
    updatedTitle: "Contraseña actualizada",
    updated: (b: string) => `Hecho. Vuelve a ${b} e inicia sesión con tu nueva contraseña.`,
    closeHint: "Puedes cerrar esta ventana.",
    emailChangedTitle: "Dirección de correo cambiada",
    emailChanged: (b: string, email: string) => `Tu cuenta usa ahora ${email}. Vuelve a ${b} e inicia sesión con ella.`,
    emailChangeInvalid: "Este enlace no es válido, ya se usó o ha caducado. Vuelve a pedir el cambio desde la aplicación.",
    emailTaken: "Esa dirección ya la usa otra cuenta. No se ha cambiado nada.",
  },

  checkout: {
    paidTitle: "Pago completado",
    paidBody: (app: string) =>
      `Pro ya está activo en tu cuenta. Vuelve a ${app}: el nuevo plan se aplica automáticamente en la próxima comprobación de la licencia.`,
    trialTitle: "Tu prueba gratuita ha empezado",
    trialBody: (app: string, days: number) =>
      `Hoy no se te ha cobrado nada y Pro está activo en tu cuenta durante ${days} días. Al terminar la prueba, el primer pago se cobra automáticamente, salvo que canceles antes desde Planes y precios en ${app}. Te escribimos el día anterior.`,
    cancelTitle: "Pago cancelado",
    cancelBody: "No se ha cobrado nada. Puedes volver a iniciar el pago desde la aplicación cuando quieras.",
    tipTitle: "Gracias por tu apoyo",
    tipBody: "Tu propina se destina directamente a nuevas funciones y a las actualizaciones diarias de PC Tweaker. Stripe te enviará el recibo por correo.",
    notedTitle: "Gracias por contárnoslo",
    notedBody: "Nos ayuda a saber dónde seguir publicando. Vuelve a la aplicación: tu nuevo plan se aplica automáticamente.",
    ask: "Opcional: ¿cómo conociste PC Tweaker?",
    sources: {
      youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook",
      search: "Buscador", friend: "Un amigo", other: "En otro sitio",
    } as Record<string, string>,
    close: "Puedes cerrar esta pestaña.",
  },
};
