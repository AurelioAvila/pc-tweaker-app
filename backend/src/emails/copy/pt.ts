import type { Copy } from "./index";

/**
 * Português europeu, tratamento formal (sem "você"), como o resto do correio
 * da família. Termos da interface: Planos e preços, Esqueceu-se da
 * palavra-passe?, Histórico de alterações, Gerir subscrição.
 */
const named = (lead: string, n: string, end = ".") => (n ? `${lead}, ${n}${end}` : `${lead}${end}`);

/** "em um PC" is Brazilian; European Portuguese contracts it to "num PC". */
const em = (place: string) => (place.startsWith("um ") ? `n${place}` : `em ${place}`);

export const pt: Copy = {
  tag: "pt",
  dateLocale: "pt-PT",

  shell: {
    writeTo: (address: string) => `Escreva para ${address} ou responda a este e-mail.`,
    expectation: "Lemos tudo e normalmente respondemos no prazo de um dia útil.",
    neverSend: "Nunca envie palavras-passe nem números de cartão por e-mail.",
    questions: "Dúvidas?",
    family: "Uma só conta para o PC Tweaker, o PC Tweaker Uninstaller e o Tweaky Driver.",
    support: "Apoio",
    privacy: "Privacidade",
    terms: "Termos",
    linkFallback: "Se o botão não abrir, copie este endereço para o navegador:",
    ifYou: "Se foi o próprio:",
    ifNot: "Se não foi:",
    unsubscribe: "Cancelar a subscrição",
  },

  plans: { monthly: "Pro, mensal", annual: "Pro, anual", lifetime: "Pro, vitalício" },

  verify: {
    subject: (b: string) => `Confirme o seu e-mail para o ${b}`,
    preheader: "Um clique confirma este endereço. A ligação é válida durante 24 horas.",
    eyebrow: "Confirme o seu e-mail",
    headline: (n: string) => named("Falta um passo", n),
    intro: (b: string) =>
      `Criou uma conta ${b} com este endereço. Confirme-o e a conta fica ativa. É a conta que leva um plano Pro de um PC para outro, e é a única forma de lhe enviarmos mais tarde a reposição da palavra-passe.`,
    button: "Confirmar o meu e-mail",
    stepsTitle: "Depois de confirmar",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "Volte ao Uninstaller e inicie sessão no painel <strong>Conta</strong>. A aplicação verifica a conta ao iniciar sessão, por isso não há nada a atualizar manualmente.",
            "Nada do que removeu se altera. As desinstalações individuais, a procura de resíduos e o Registo de remoções nunca precisaram de conta.",
            "O pagamento do Uninstaller Pro só abre com o endereço confirmado. Um plano PC Tweaker na mesma conta desbloqueia o preço de fidelização.",
          ]
        : [
            "Volte ao PC Tweaker e inicie sessão no botão <strong>Conta</strong>. A aplicação verifica a conta ao iniciar sessão, por isso não há nada a atualizar manualmente.",
            "Nada do que já aplicou se altera. O Free nunca precisou de conta: os ajustes Free, a Verificação e o Histórico de alterações ficam como os deixou.",
            "O pagamento do Pro só abre com o endereço confirmado. Uma licença Pro é assinada para a conta, não para o computador: para a usar noutro PC basta iniciar sessão.",
          ],
    noteHtml: (b: string) =>
      `A ligação é válida durante 24 horas e uma só vez. Se tiver expirado, abra o menu da conta na aplicação e escolha <strong>Reenviar</strong>. Se não criou uma conta ${b}, ignore este e-mail: sem o clique nada acontece.`,
    helpTitle: "A ligação não chega, ou chega duas vezes?",
    helpText: "Verifique primeiro a pasta de spam e depois indique-nos o endereço com que se registou.",
    why: (b: string) => `Recebe este e-mail porque foi criada uma conta ${b} com este endereço.`,
  },

  welcome: {
    subject: (b: string) => `A sua conta ${b} está pronta`,
    preheader: (u: boolean) =>
      u ? "Três coisas a experimentar primeiro, e o que o Pro acrescenta." : "Três ajustes a experimentar primeiro, e como cada alteração se anula.",
    eyebrow: "Conta pronta",
    headline: (n: string) => named("Já está", n),
    intro: (u: boolean, free: number) =>
      u
        ? "O seu endereço está confirmado e a conta está ativa. Inicie sessão no painel Conta do Uninstaller e tudo o que se segue é seu sem pagar nada. Comece por aqui."
        : `O seu endereço está confirmado e a conta está ativa. Inicie sessão no botão Conta da aplicação e os ${free} ajustes Free, a Verificação, a Pontuação de saúde e o Histórico de alterações são seus sem pagar nada. Comece por aqui.`,
    stepsTitle: "Três coisas a experimentar primeiro",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "<strong>Aplicações instaladas.</strong> Todos os programas deste PC, incluindo as aplicações da Microsoft Store, com o tamanho e o editor.",
            "<strong>Detalhes, depois Desinstalar.</strong> Cada programa mostra um nível de confiança e um resumo da remoção antes de qualquer execução, e nos programas instalados para todo o computador tenta-se primeiro um ponto de restauro.",
            "<strong>A procura de resíduos.</strong> Depois de uma desinstalação, a aplicação procura ficheiros e chaves de registo deixados pelo programa, e o Registo de remoções anota o que foi removido e o espaço libertado.",
          ]
        : [
            "<strong>Verificação, depois Executar verificação do sistema.</strong> Verificações de arranque, armazenamento, memória, privacidade, desempenho e atualizações. As alterações recomendadas e as opcionais aparecem separadas, e nada é aplicado sem a sua aprovação. Corrigir tudo mostra primeiro as definições exatas e depois verifica cada uma.",
            "<strong>Arranque.</strong> Os programas que arrancam com o Windows, com o editor ao lado de cada um. Desativar dois ou três que nunca usa é a alteração que mais pessoas notam no arranque seguinte, e cada entrada tem o seu próprio restauro.",
            "<strong>Perfis.</strong> Gaming, Estudo e Trabalho estão incluídos no Free. Abra um, leia as vantagens e desvantagens de cada cartão, desmarque o que não quer e aplique o resto com um clique. Um perfil acrescenta as suas definições sem anular as outras alterações que fez.",
          ],
    noteHtml: (u: boolean, guideLink: (label: string) => string) =>
      u
        ? "A limpeza de resíduos, a remoção em lote e a remoção de entradas danificadas fazem parte do Uninstaller Pro. Se a mesma conta tiver um plano PC Tweaker, o Pro custa menos: o preço está em Planos e preços."
        : `Antes de escrever qualquer coisa, o PC Tweaker guarda o valor anterior, e cada cartão de ajuste tem <strong>O que isto altera, exatamente</strong>. Restaure a partir do próprio ajuste, ou abra o Histórico de alterações e use <strong>Restaurar ajustes ativos</strong>. A limpeza que vai para a Reciclagem pode ser recuperada até a esvaziar; as atualizações de controladores, as reparações e os ajustes de hardware têm passos de recuperação próprios. Pormenores: ${guideLink("como anular ajustes do Windows")}.`,
    button: (b: string) => `Abrir o ${b}`,
    helpTitle: "Algo não funciona como descrito?",
    helpText: "Indique-nos a versão da aplicação e onde clicou.",
    why: (b: string) => `Recebe este e-mail porque confirmou uma conta ${b} com este endereço. É enviado uma só vez.`,
  },

  reset: {
    subject: (b: string) => `Reponha a sua palavra-passe do ${b}`,
    preheader: "A ligação é válida uma vez, durante uma hora. Nada muda até a usar.",
    eyebrow: "Reposição da palavra-passe",
    headline: "Escolha uma nova palavra-passe.",
    intro: (b: string) =>
      `Alguém pediu para repor a palavra-passe da conta ${b} associada a este endereço. Se foi o próprio, o botão abaixo abre uma página onde define uma nova. Por agora, nada mudou.`,
    button: "Definir nova palavra-passe",
    rows: [
      ["Ligação válida", "Uma hora, uma só utilização"],
      ["Nova palavra-passe", "Pelo menos 8 caracteres, até 72 bytes"],
      ["Aplica-se a", "PC Tweaker, PC Tweaker Uninstaller e Tweaky Driver"],
      ["Depois da alteração", "A sessão termina em todos os PCs"],
    ],
    after:
      "Depois de guardar a nova palavra-passe, inicie sessão novamente em cada PC onde usa as aplicações. Os ajustes aplicados, o histórico e qualquer plano Pro estão ligados à conta e ao computador, não à palavra-passe, por isso nada aí se altera.",
    note:
      "Não fez este pedido? Ignore o e-mail: a ligação é válida durante uma hora e uma só vez, e a sua palavra-passe fica exatamente como está. Se estes pedidos continuarem a chegar, escreva-nos e veremos de onde vêm.",
    helpTitle: "Ligação expirada, ou a página diz que não é válida?",
    helpTextHtml:
      "Peça uma nova em <strong>Esqueceu-se da palavra-passe?</strong> no ecrã de início de sessão e use o e-mail mais recente que receber.",
    why: (b: string) => `Recebe este e-mail porque foi pedida a reposição da palavra-passe da conta ${b} associada a este endereço.`,
  },

  changed: {
    subject: (b: string) => `A sua palavra-passe do ${b} foi alterada`,
    preheader: (when: string) => `Alterada a ${when}. A sessão terminou nos outros PCs. Se não foi o próprio, continue a ler.`,
    eyebrow: "Aviso de segurança",
    headline: (n: string) => named("A sua palavra-passe foi alterada", n),
    intro: (b: string, when: string) =>
      `A palavra-passe da sua conta ${b} foi alterada a ${when}. A sessão terminou em todos os dispositivos, no PC Tweaker, no PC Tweaker Uninstaller e no Tweaky Driver.`,
    ifYou: "inicie sessão novamente em cada PC e está feito. Os ajustes aplicados, o histórico e o plano ficam intactos.",
    ifNot: "outra pessoa definiu essa palavra-passe e a antiga já não funciona. Faça estas três coisas, por esta ordem.",
    stepsTitle: "Se não foi o próprio",
    stepsHtml: [
      "Abra a aplicação, escolha <strong>Esqueceu-se da palavra-passe?</strong> no ecrã de início de sessão e peça a reposição para este endereço. A ligação que receber é só sua, e usá-la termina a sessão da outra pessoa.",
      "Escolha uma palavra-passe que não use em mais lado nenhum. Se esta caixa de correio tiver a mesma palavra-passe que a anterior, altere-a também: é por essa conta que um atacante teria entrado.",
      "Responda a este e-mail para verificarmos também a conta do nosso lado.",
    ],
    button: "Contactar o apoio",
    noteHtml:
      "Este e-mail não contém, de propósito, nenhuma ligação que altere algo nem nenhum código: um botão de reposição numa mensagem &quot;foi o próprio?&quot; é exatamente o que um e-mail falso ofereceria. Nunca lhe pediremos a palavra-passe por e-mail.",
    helpTitle: "Quer que verifiquemos a conta?",
    helpText: "As mensagens de segurança são lidas primeiro.",
    expectation: "Normalmente recebe resposta no prazo de um dia útil.",
    why: (b: string) => `Este aviso é enviado sempre que a palavra-passe de uma conta ${b} é alterada. Não pode ser desativado.`,
  },

  emailChange: {
    subject: (b: string) => `Confirme o seu novo e-mail para o ${b}`,
    preheader: "Um clique muda a sua conta para este endereço. A ligação é válida durante 24 horas.",
    eyebrow: "Confirmar o novo endereço",
    headline: (n: string) => named("Confirme este endereço", n),
    intro:
      "Pediu para mudar para este endereço a conta usada pelo PC Tweaker, pelo PC Tweaker Uninstaller e pelo Tweaky Driver. Confirme-o e passa a iniciar sessão com este endereço; o anterior deixa de servir para iniciar sessão.",
    button: "Confirmar o novo endereço",
    note: "A ligação é válida durante 24 horas e uma só vez. Até confirmar, nada muda. Depois da mudança, a sessão termina em todos os PCs.",
    helpTitle: "Não fez este pedido?",
    helpText: "Ignore este e-mail: a conta fica no endereço atual.",
    why: "Recebe este e-mail porque alguém iniciou sessão numa conta PC Tweaker e pediu para a mudar para este endereço.",
  },

  emailChanged: {
    subject: (b: string) => `O e-mail da sua conta ${b} foi alterado`,
    preheader: (masked: string) => `A conta usa agora ${masked}. Se não foi o próprio, continue a ler.`,
    eyebrow: "Aviso de segurança",
    headline: (n: string) => named("O e-mail da sua conta foi alterado", n),
    intro: (masked: string, when: string) =>
      `A ${when}, a conta usada pelo PC Tweaker, pelo PC Tweaker Uninstaller e pelo Tweaky Driver passou deste endereço para ${masked}. A sessão terminou em todos os PCs; o início de sessão usa agora o novo endereço.`,
    ifYou: "não precisa de fazer mais nada. Planos, ajustes e histórico acompanharam a conta.",
    ifNot:
      "alguém que conhecia a sua palavra-passe mudou a conta. Responda já a este e-mail: podemos repô-la e bloqueá-la enquanto verificamos. Depois altere essa palavra-passe em todos os sítios onde a usou.",
    button: "Contactar o apoio",
    note: "Este e-mail não contém, de propósito, nenhuma ligação que altere algo. Nunca lhe pediremos a palavra-passe por e-mail.",
    helpTitle: "Quer que verifiquemos a conta?",
    helpText: "As mensagens de segurança são lidas primeiro.",
    why: (b: string) => `Este aviso é enviado para o endereço anterior sempre que o e-mail de uma conta ${b} é alterado. Não pode ser desativado.`,
  },

  signIn: {
    subject: (b: string) => `Novo início de sessão na sua conta ${b}`,
    preheader: (device: string, when: string) => `Sessão iniciada ${em(device)} a ${when}. Se foi o próprio, não precisa de fazer nada.`,
    eyebrow: "Novo início de sessão",
    aPc: "um PC com Windows",
    headline: (device: string) => `Novo início de sessão ${em(device)}.`,
    intro: (b: string) =>
      `Foi iniciada sessão na sua conta ${b} a partir de um PC ou de uma rede que ainda não tínhamos visto nesta conta. Enviamos isto uma vez por cada PC novo, e só quando a palavra-passe está correta; uma palavra-passe errada nunca gera este e-mail.`,
    rows: { device: "PC", when: "Quando", account: "Conta" },
    ifYou: "não precisa de fazer nada, por exemplo num segundo PC, numa reinstalação ou numa rede nova. Um plano Pro acompanha a conta.",
    ifNotHtml:
      "altere já a palavra-passe em <strong>Esqueceu-se da palavra-passe?</strong> no ecrã de início de sessão. Uma nova palavra-passe termina a sessão em todos os PCs de uma vez, incluindo este. Depois responda a este e-mail para verificarmos a conta.",
    note:
      "Este e-mail não contém, de propósito, nenhuma ligação para terminar sessões: uma ligação «proteger a minha conta» num alerta de segurança é exatamente a forma que teria uma mensagem falsa. A única ação segura é a reposição que o próprio inicia na aplicação. Nunca lhe pediremos a palavra-passe por e-mail.",
    helpTitle: "Não tem a certeza de que foi o próprio?",
    helpText: "Trate-o como se não tivesse sido e avise-nos. As mensagens de segurança são lidas primeiro.",
    why: (b: string) => `Este aviso é enviado na primeira vez que um PC ou uma rede novos iniciam sessão numa conta ${b}. Não pode ser desativado.`,
  },

  receipt: {
    subject: (u: boolean, lifetime: boolean) =>
      u
        ? lifetime
          ? "A sua compra do PC Tweaker Uninstaller Pro está confirmada"
          : "A sua subscrição do PC Tweaker Uninstaller Pro está ativa"
        : lifetime
          ? "A sua licença vitalícia PC Tweaker Pro está ativa"
          : "A sua subscrição do PC Tweaker Pro está ativa",
    rows: {
      plan: "Plano",
      charged: "Cobrado",
      renewsOn: "Renova a",
      access: "Acesso",
      neverExpires: "Nunca expira",
      renewal: "Renovação",
      renewalNone: "Nenhuma. Não é cobrado mais nada.",
      included: "Incluído",
      includedValue: "12 meses de PC Tweaker Uninstaller Pro",
      account: "Conta",
      shared: (email: string) => `${email} (partilhada com o PC Tweaker)`,
    },
    eyebrowPro: "Pro ativado",
    eyebrowLifetime: "Licença vitalícia",
    buttonPct: "Abrir o PC Tweaker",
    buttonUn: "Abrir o Uninstaller",
    help: {
      title: "Pagou mas ainda não tem o Pro, ou foi cobrado algo que não esperava?",
      text: "Indique-nos o endereço da conta e a data do recibo do Stripe.",
      expectation: "As respostas sobre faturação seguem normalmente no prazo de um dia útil.",
    },
    sub: {
      headline: (n: string) => named("O Pro está ativo na sua conta", n),
      preheader: (plan: string, price: string, renews: string) =>
        `${plan}, ${price}, renova a ${renews}. Como gerir o plano e usar o Pro num segundo PC.`,
      intro: (email: string, total: number, free: number, pro: number) =>
        `O Stripe confirmou o pagamento e a licença de ${email} está assinada. Os ${total} ajustes estão já disponíveis: os ${free} que tinha no Free mais os ${pro} do Pro, incluindo as Sessões de jogo e o perfil Turbo Gaming. A aplicação atualiza a licença quando regressa do pagamento com ligação à internet, por isso o Pro já deve aparecer.`,
      stepsTitle: "A saber desde o primeiro dia",
      stepsHtml: (who: string, renews: string) => [
        `<strong>Gerir o plano.</strong> Abra Planos e preços na aplicação. Mostra o plano e abre o portal de faturação do Stripe, onde altera o cartão ou cancela. Um plano cancelado mantém o Pro até ${renews} e não volta a ser cobrado.`,
        `<strong>Um segundo PC.</strong> Instale lá o PC Tweaker e inicie sessão com ${who}. A licença é assinada para a conta, não para o computador, por isso tem o Pro em ambos. Os ajustes aplicados e o Histórico de alterações são de cada computador.`,
        "<strong>Depois de reinstalar o Windows ou trocar de hardware.</strong> Inicie sessão novamente e o Pro volta sozinho. O Histórico de alterações não passa para a nova instalação, por isso volte a aplicar um perfil em vez de procurar um restauro.",
        "<strong>Por onde começar com o Pro.</strong> Gaming e depois Sessões de jogo: registe um jogo e as definições turbo ativam-se quando ele arranca e anulam-se quando fecha.",
      ],
      note: "O Stripe envia a fatura e o recibo de pagamento separadamente, a partir do seu próprio endereço; guarde-os para os seus registos. Se a aplicação ainda mostrar Free ao fim de alguns minutos, termine a sessão e inicie-a novamente: a licença é lida de novo ao iniciar sessão.",
      why: "Recebe este e-mail porque foi iniciada uma subscrição do PC Tweaker Pro na conta associada a este endereço.",
    },
    lifetime: {
      headline: (n: string) => named("Pro, para sempre. Obrigado", n),
      preheader: (price: string) =>
        `Um único pagamento de ${price}, sem renovação. Inclui 12 meses de Uninstaller Pro, ativados no primeiro início de sessão.`,
      intro: (email: string, total: number) =>
        `Pagou uma vez e é a última vez que esta conta é cobrada. A licença vitalícia de ${email} está assinada e os ${total} ajustes, as Sessões de jogo e o perfil Turbo Gaming estão já disponíveis.`,
      stepsTitle: "O que significa vitalício na prática",
      stepsHtml: (who: string, uninstallerLink: string) => [
        `<strong>Todos os seus PCs.</strong> Inicie sessão com ${who} em qualquer PC com Windows 10 ou 11 e fica com o Pro. Não há ativações a contar nem chaves de licença a escrever: a chave é a conta.`,
        `<strong>Uninstaller Pro durante um ano.</strong> Instale o PC Tweaker Uninstaller a partir de ${uninstallerLink} e inicie sessão com a mesma conta. Os 12 meses começam no primeiro início de sessão lá, não hoje. É uma vantagem à parte e com prazo, não uma licença vitalícia do Uninstaller.`,
        "<strong>Reinstalações e hardware novo.</strong> Nada a transferir. Depois de um Windows novo, instale o PC Tweaker, inicie sessão e o Pro volta. O Histórico de alterações pertence à instalação anterior, por isso comece por um perfil em vez de esperar que as definições antigas reapareçam.",
        "<strong>Atualizações.</strong> O PC Tweaker procura atualizações sozinho, e a licença vitalícia cobre todas as atualizações do PC Tweaker Pro.",
      ],
      note: "O Stripe envia a fatura separadamente. Se alguma vez vir uma cobrança mensal nossa depois desta compra, escreva-nos de imediato: uma conta vitalícia nunca mais deve ser cobrada, e resolveremos a situação.",
      why: "Recebe este e-mail porque foi comprada uma licença vitalícia PC Tweaker Pro na conta associada a este endereço.",
    },
    un: {
      headline: (n: string) => named("O Pro está ativo", n, ". Agora também pode remover os resíduos."),
      preheader: (plan: string, price: string, renews: string | null) =>
        `${plan}, ${price}, ${renews ? `renova a ${renews}` : "sem renovação"}. Limpeza de resíduos, remoção em lote e entradas danificadas ativadas.`,
      intro: (email: string) =>
        `O Stripe confirmou o pagamento e a licença Uninstaller Pro de ${email} está assinada. Mudam três coisas na aplicação: a procura de resíduos passa a poder limpar o que encontra, vários programas podem ser colocados em fila e removidos de uma vez, e também se podem remover as entradas cujo desinstalador já não existe. Tudo o que tinha no Free, incluindo o nível de confiança e o Registo de remoções, fica exatamente como estava.`,
      stepsTitle: "Uma primeira remoção limpa com o Pro",
      stepsHtml: (lifetime: boolean, who: string, renews: string) => [
        "Escolha um programa classificado como <strong>Seguro</strong> e leia o resumo da remoção: o comando exato, se é executado o Windows Installer ou o desinstalador do próprio programa, as permissões pedidas e o tamanho indicado. Nada é executado até confirmar.",
        "Depois da desinstalação, a procura de resíduos lista as pastas, atalhos e chaves de registo deixados pelo programa. Com o Pro pode removê-los no mesmo ecrã. Os ficheiros vão para a Reciclagem, por isso um engano pode ser recuperado até a esvaziar; os valores de registo ficam guardados no Registo de remoções.",
        "Para uma limpeza maior, assinale vários programas e inicie um lote. Os programas protegidos nunca entram num lote, a verificação de programas relacionados continua a avisar antes de um programa principal levar consigo os seus plugins, e antes das remoções com privilégios elevados tenta-se um ponto de restauro, com o resultado registado.",
        ...(lifetime
          ? []
          : [
              `<strong>Gerir o plano.</strong> Planos e preços, na barra superior, mostra a conta e o plano e abre o portal de faturação do Stripe para o cartão, a periodicidade ou o cancelamento. Um plano cancelado mantém o Pro até ${renews}. Ao iniciar sessão com ${who} noutro PC, também fica com o Pro.`,
            ]),
      ],
      note: (lifetime: boolean) =>
        `${lifetime ? "Esta compra não se renova. " : ""}Uma conta, duas licenças: uma licença PC Tweaker Pro não desbloqueia o Uninstaller e esta não desbloqueia o PC Tweaker; cada aplicação verifica a sua. O Stripe envia a fatura separadamente. Se o Uninstaller ainda mostrar Free ao fim de alguns minutos, termine a sessão e inicie-a novamente em Planos e preços.`,
      help: {
        title: "Pagou mas ainda não tem o Pro, ou uma remoção não correu como dizia o resumo?",
        text: "Indique-nos a versão da aplicação e a entrada do Registo de remoções (exporta para CSV).",
        expectation: "Normalmente respondemos no prazo de um dia útil.",
      },
      why: (lifetime: boolean) =>
        lifetime
          ? "Recebe este e-mail porque foi comprado o PC Tweaker Uninstaller Pro na conta PC Tweaker associada a este endereço."
          : "Recebe este e-mail porque foi iniciada uma subscrição do Uninstaller Pro na conta PC Tweaker associada a este endereço.",
    },
  },

  reversal: {
    subject: (u: boolean) =>
      u ? "O seu pagamento do PC Tweaker Uninstaller Pro foi revertido" : "O seu pagamento do PC Tweaker Pro foi revertido",
    eyebrow: "Pagamento revertido",
    headline: (n: string) => named("O seu pagamento foi revertido", n),
    rows: {
      amount: "Montante revertido",
      plan: "Plano",
      proAccess: "Acesso Pro",
      ended: "Terminado",
      account: "A sua conta",
      accountValue: "Aberta, no Free",
      unPro: "Uninstaller Pro",
      unFree: "Continua seu no Free",
      unFreeValue: "Desinstalações individuais, nível de confiança, resumo da remoção, procura de resíduos, Registo de remoções",
    },
    pct: {
      lead: (amount: string | null) =>
        `${amount ? `O seu pagamento de ${amount}` : "O seu pagamento"} do PC Tweaker Pro foi revertido pelo seu prestador de pagamentos.`,
      preheaderTail: "O acesso Pro terminou; as funcionalidades gratuitas continuam a funcionar.",
      introTail:
        "O Stripe informou-nos, e o acesso Pro associado a esse pagamento terminou na sua conta. Este e-mail regista o que mudou; não lhe pede nada.",
      ended: "O acesso Pro associado a este pagamento terminou. A sua conta e as funcionalidades gratuitas continuam a funcionar.",
      endedTail: "A aplicação volta ao Free na próxima verificação da licença, normalmente no próximo arranque ou início de sessão.",
      stopRenewal: "Se a subscrição ainda estiver ativa, cancele-a em Planos e preços para que não seja renovada.",
      oneOff: "Foi uma compra única, por isso não há nenhuma subscrição para cancelar.",
      mistake: "Se acha que isto aconteceu por engano, responda a este e-mail e analisaremos consigo o registo do Stripe.",
    },
    un: {
      preheader: (amount: string | null) =>
        `${amount ?? "O seu pagamento"} foi revertido pelo seu prestador de pagamentos. O Pro terminou; as desinstalações individuais, o resumo da remoção e o Registo de remoções continuam a funcionar.`,
      intro: (amount: string | null) =>
        `O seu prestador de pagamentos reverteu ${amount ? `o pagamento de ${amount}` : "o seu pagamento"} do PC Tweaker Uninstaller Pro, e o Stripe informou-nos. O acesso Pro associado a esse pagamento terminou. A sua conta continua aberta, tal como a parte do PC Tweaker: esta reversão afeta apenas o Uninstaller.`,
      stops:
        "O que para: a limpeza de resíduos, a remoção em lote e a remoção de entradas danificadas. O que não muda: o que já foi removido continua removido, o Registo de remoções guarda cada recibo, e os ficheiros enviados para a Reciclagem continuam lá até a esvaziar.",
      stopRenewal:
        "Se a subscrição ainda aparecer como ativa no Stripe, cancele-a em Planos e preços, na barra superior, para que não seja tentada outra cobrança.",
      oneOff: "Foi um acesso único, por isso não há nada para cancelar.",
      origin:
        "Esta reversão partiu do seu banco ou do emissor do cartão, não de nós. Se não a pediu ao banco, responda a este e-mail com a data e o montante do seu extrato e analisaremos consigo o registo do Stripe.",
    },
    helpTitle: "Dúvidas sobre esta reversão?",
    helpText: "Indique-nos a data e o montante que aparecem no seu extrato bancário.",
    why: (u: boolean) =>
      u
        ? "Recebe este e-mail porque foi revertido um pagamento do Uninstaller Pro na conta PC Tweaker associada a este endereço."
        : "Recebe este e-mail porque foi revertido um pagamento do PC Tweaker Pro na conta associada a este endereço.",
  },

  ending: {
    subject: (b: string, ends: string) => `O seu plano ${b} Pro termina a ${ends}`,
    preheader: (ends: string) => `O Pro mantém-se ativo até ${ends}; depois a conta volta ao Free. Nada é apagado.`,
    eyebrow: "Plano a terminar",
    headline: (n: string, ends: string) => named(`O Pro mantém-se ativo até ${ends}`, n),
    intro: (b: string, failed: boolean, ends: string) =>
      failed
        ? `O Stripe não conseguiu cobrar a renovação da sua subscrição do ${b} Pro. O Pro continua a funcionar enquanto o Stripe tenta de novo o pagamento; se não o conseguir cobrar até ${ends}, a conta volta ao Free.`
        : `A sua subscrição do ${b} Pro foi cancelada, como pediu. Não haverá mais cobranças. Tudo o que é Pro funciona até ao fim do período já pago, e depois a conta volta ao Free.`,
    rows: { plan: "Plano", until: "Pro até", next: "Próxima cobrança", nextValue: "Nenhuma", after: "Depois" },
    afterValue: (u: boolean, free: number) =>
      u ? "Free: desinstalações individuais, procura de resíduos, Registo de remoções" : `Free: ${free} ajustes, Verificação, Pontuação de saúde, Histórico de alterações`,
    stepsTitle: (ends: string) => `Antes de ${ends}`,
    steps: (u: boolean, failed: boolean) => [
      u
        ? "A limpeza de resíduos e a remoção em lote param quando o Pro termina. O que já foi removido continua removido, e o Registo de remoções guarda cada recibo."
        : "As definições aplicadas com ajustes Pro não são anuladas quando o Pro termina; o Windows mantém-nas. Se quiser repor algumas nos valores predefinidos, faça-o agora no cartão do ajuste ou no Histórico de alterações, onde o restauro também funciona no Free.",
      u
        ? "Os ficheiros enviados para a Reciclagem por uma limpeza Pro ficam lá até a esvaziar, com ou sem Pro."
        : "Quando o Pro termina, as Sessões de jogo deixam de ativar as definições turbo ao arrancar os jogos. Nada fica aplicado de uma sessão já terminada, porque cada sessão é anulada à saída.",
      failed
        ? "Atualize o cartão em Planos e preços e depois Gerir subscrição. O Stripe tenta de novo a renovação sozinho; quando conseguir, o Pro continua sem interrupção."
        : "Mudou de ideias? Abra Planos e preços e depois Gerir subscrição: até à data de fim, o Stripe permite retomar o mesmo plano sem um novo pagamento.",
    ],
    button: (b: string) => `Abrir o ${b}`,
    note: "Quando o Pro termina, nada é apagado: a conta, o seu histórico e cada definição aplicada ficam exatamente onde estão. O Stripe envia separadamente o seu próprio aviso sobre a subscrição.",
    helpTitle: "Não cancelou, ou a data parece errada?",
    helpText: "Diga-nos e analisaremos consigo o registo do Stripe.",
    why: (b: string) => `Recebe este e-mail porque a subscrição do ${b} Pro da conta associada a este endereço mudou de estado.`,
  },

  bonus: {
    subject: "Os seus 12 meses de Uninstaller Pro começaram",
    preheader: (ends: string) => `Incluídos na sua licença vitalícia PC Tweaker, ativos até ${ends}. Nada a pagar, nada a cancelar.`,
    eyebrow: "Vantagem vitalícia",
    headline: (n: string) => named("O seu ano de Uninstaller Pro começou hoje", n),
    intro: (ends: string) =>
      `Iniciou sessão no PC Tweaker Uninstaller com a conta que tem a sua licença vitalícia PC Tweaker, e é esse primeiro início de sessão que dá início aos 12 meses de Uninstaller Pro incluídos. Nenhum cartão foi cobrado e não existe nenhuma subscrição por trás; dura até ${ends} e depois simplesmente termina.`,
    rows: {
      entitlement: "Direito",
      entitlementValue: "Uninstaller Pro, vantagem vitalícia de 12 meses",
      started: "Início",
      ends: "Fim",
      charged: "Cobrado",
      chargedValue: "Nada. Sem renovação.",
    },
    stepsTitle: "O que o Pro acrescenta durante o ano",
    stepsHtml: [
      "<strong>Limpeza de resíduos.</strong> A procura depois de cada desinstalação já listava o que ficava; agora pode remover essas pastas, atalhos e chaves de registo no mesmo ecrã. Os ficheiros vão para a Reciclagem e os valores de registo ficam no Registo de remoções.",
      "<strong>Remoção em lote.</strong> Assinale vários programas e deixe-os seguir numa ordem segura. Os programas protegidos ficam excluídos, e nas remoções com privilégios elevados tenta-se primeiro um ponto de restauro.",
      "<strong>Entradas danificadas.</strong> Os programas cujo desinstalador já não existe, que normalmente ficam na lista para sempre, podem ser removidos.",
    ],
    button: "Abrir o Uninstaller",
    note: (ends: string) =>
      `Quando o ano terminar, o Uninstaller volta ao Free sozinho: as desinstalações individuais, o nível de confiança, a procura de resíduos e o Registo de remoções mantêm-se, e nada do que foi removido volta. A sua licença vitalícia PC Tweaker não é afetada. Se quiser o Pro depois de ${ends}, um plano pago do Uninstaller começaria em Planos e preços; não há nenhuma conversão automática.`,
    helpTitle: "O Pro não aparece no Uninstaller?",
    helpText: "Termine a sessão e inicie-a novamente uma vez; cada aplicação lê a sua própria licença ao iniciar sessão.",
    why: "Recebe este e-mail porque a vantagem vitalícia foi ativada na conta PC Tweaker associada a este endereço. É enviado uma só vez.",
  },

  reminder: {
    subject: "O seu pagamento vitalício do PC Tweaker",
    preheader: "O pagamento fechou antes de terminar, por isso nada foi cobrado. Este é o único lembrete.",
    eyebrow: "Pagamento não concluído",
    headline: (n: string) => named("Nada foi cobrado", n),
    intro:
      "Abriu um pagamento vitalício do PC Tweaker Pro e a página do Stripe fechou antes de o pagamento ser concluído. Nenhum cartão foi cobrado e a sua conta está exatamente como estava. Se algo o impediu, eis o que as pessoas costumam perguntar antes de decidir.",
    rows: (total: number) => [
      ["Vitalício", "Um único pagamento. Nunca há renovação."],
      ["Abrange", `Os ${total} ajustes, as Sessões de jogo, todas as atualizações`],
      ["PCs", "Todos os PCs onde iniciar sessão com esta conta"],
      ["Também incluído", "12 meses de PC Tweaker Uninstaller Pro"],
    ],
    button: "Abrir o PC Tweaker",
    retry:
      "Para tentar de novo, abra Planos e preços na aplicação e escolha Vitalício. O pagamento exige um endereço de e-mail confirmado; se o botão estiver a cinzento, é por isso, e Reenviar no menu da conta resolve. O preço atual está no cartão do plano e na página do Stripe.",
    doubts:
      "Se um meio de pagamento foi recusado, o Stripe mostra o motivo na sua página; outro cartão ou uma carteira digital costuma funcionar. E se decidiu que não, não há problema: o Free continua Free, e este é o único lembrete que receberá sobre este pagamento.",
    helpTitle: "Alguma dúvida antes de decidir?",
    helpText: "Responde uma pessoa real.",
    why: "Recebe este e-mail porque foi iniciado um pagamento vitalício a partir da conta PC Tweaker associada a este endereço e não foi concluído. Um único lembrete.",
    unsubscribe: "Deixar de receber e-mails como este.",
  },

  supportAck: {
    subject: "Recebemos o seu pedido de apoio do PC Tweaker",
    preheader: "A sua mensagem está na fila. Responda a este e-mail para acrescentar um pormenor ou uma captura de ecrã.",
    eyebrow: "Pedido de apoio recebido",
    headline: (n: string) => (n ? `Recebido, ${n}. Está na fila.` : "Recebido. Está na fila."),
    intro:
      "A sua mensagem chegou à caixa de apoio do PC Tweaker. Quem a lê é uma pessoa, não um bot, e a resposta chega a este endereço. A maioria das respostas segue no prazo de um dia útil; o que exigir que reproduzamos o problema pode demorar um pouco mais, e diremos isso.",
    replyTo: "Respondemos para",
    stepsTitle: "O que acelera a resposta",
    steps: [
      "Responda a este e-mail com o que se esqueceu: a versão da aplicação, a versão do Windows e o ajuste ou a verificação exatos que usou. Uma só conversa mantém tudo junto.",
      "Se uma definição estiver a comportar-se mal, abra o Histórico de alterações e diga-nos o que indica a entrada. Cada ajuste aplicado aparece lá com o valor definido e o que substituiu, o que costuma ser todo o diagnóstico.",
      "As capturas de ecrã ajudam; desfoque antes tudo o que for pessoal. Nunca inclua palavras-passe, tokens de licença ou dados do cartão, e se alguma vez parecer que lhos pedimos, a mensagem não é nossa.",
    ],
    wait: "Enquanto espera: se uma alteração tiver de ser anulada já, Restaurar ajustes ativos no Histórico de alterações repõe cada definição registada sem esperar por nós.",
    guide: (link: string) => `O ${link} cobre os casos a que não chega.`,
    guideLabel: "guia para anular alterações",
    notYouTitle: "Não nos escreveu?",
    notYou:
      "Alguém escreveu este endereço no formulário de apoio. Pode ignorar este e-mail; através do formulário nada muda em nenhuma conta. Se isto continuar a acontecer, avise-nos e bloquearemos a origem.",
    why: "Recebe este e-mail porque foi enviado um pedido de apoio ao PC Tweaker a partir deste endereço.",
  },

  pages: {
    error: "Erro",
    unavailable: "Este serviço não está disponível neste momento.",
    missingToken: "Esta ligação está incompleta. Abra-a diretamente a partir do e-mail.",
    verifiedTitle: "E-mail verificado",
    verified: (b: string) => `O seu e-mail está verificado. Pode fechar esta janela e voltar ao ${b}.`,
    alreadyVerified: (b: string) => `O seu e-mail já está verificado. Pode fechar esta janela e voltar ao ${b}.`,
    expiredTitle: "Ligação expirada",
    verifyExpired: "Esta ligação de verificação não é válida ou expirou. Peça uma nova na aplicação.",
    failed: "Algo correu mal. Tente novamente mais tarde.",
    resetTitle: "Escolha uma nova palavra-passe",
    resetLead:
      "Escolha uma que não use em mais lado nenhum. Aplica-se ao PC Tweaker, ao PC Tweaker Uninstaller e ao Tweaky Driver, e a sessão terminará nos seus outros dispositivos.",
    newPassword: "Nova palavra-passe",
    newPasswordPlaceholder: "Pelo menos 8 caracteres",
    passwordHint: "Use pelo menos 8 caracteres e não mais de 72 bytes UTF-8. As letras acentuadas e os emojis podem ocupar vários bytes.",
    confirmPassword: "Confirmar a palavra-passe",
    confirmPlaceholder: "Escreva-a novamente",
    update: "Atualizar a palavra-passe",
    resetHint: "Esta ligação é válida uma só vez e expira uma hora depois de ser enviada.",
    notValidTitle: "Ligação inválida",
    notValidLead: "Esta página precisa da ligação do seu e-mail de reposição. Abra essa ligação diretamente em vez de recarregar esta página.",
    passwordRule: "A palavra-passe tem de ter pelo menos 8 caracteres e não mais de 72 bytes UTF-8.",
    mismatch: "As duas palavras-passe não coincidem.",
    resetInvalid: "Esta ligação de reposição não é válida, já foi usada ou expirou.",
    resetFailed: "Não foi possível repor a palavra-passe. Tente novamente.",
    updatedTitle: "Palavra-passe atualizada",
    updated: (b: string) => `Feito. Volte ao ${b} e inicie sessão com a nova palavra-passe.`,
    closeHint: "Pode fechar esta janela.",
    emailChangedTitle: "Endereço de e-mail alterado",
    emailChanged: (b: string, email: string) => `A sua conta usa agora ${email}. Volte ao ${b} e inicie sessão com este endereço.`,
    emailChangeInvalid: "Esta ligação não é válida, já foi usada ou expirou. Peça a alteração novamente na aplicação.",
    emailTaken: "Esse endereço já é usado por outra conta. Nada foi alterado.",
  },

  checkout: {
    paidTitle: "Pagamento concluído",
    paidBody: (app: string) =>
      `O Pro já está ativo na sua conta. Volte ao ${app}: o novo plano é aplicado automaticamente na próxima verificação da licença.`,
    trialTitle: "A sua avaliação gratuita começou",
    trialBody: (app: string, days: number) =>
      `Hoje não foi cobrado nada e o Pro está ativo na sua conta durante ${days} dias. No fim da avaliação, o primeiro pagamento é cobrado automaticamente, a menos que cancele antes em Planos e preços no ${app}. Enviamos-lhe um e-mail na véspera.`,
    cancelTitle: "Pagamento cancelado",
    cancelBody: "Não foi cobrado nada. Pode voltar a iniciar o pagamento a partir da aplicação quando quiser.",
    tipTitle: "Obrigado pelo seu apoio",
    tipBody: "A sua gorjeta vai diretamente para novas funcionalidades e para as atualizações diárias do PC Tweaker. A Stripe envia-lhe o recibo por e-mail.",
    notedTitle: "Obrigado por nos dizer",
    notedBody: "Ajuda-nos a saber onde continuar a publicar. Volte à aplicação: o novo plano é aplicado automaticamente.",
    ask: "Opcional: como conheceu o PC Tweaker?",
    sources: {
      youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook",
      search: "Motor de pesquisa", friend: "Um amigo", other: "Noutro sítio",
    } as Record<string, string>,
    close: "Pode fechar este separador.",
  },
};
