import type { Lang, TweakText } from "./i18n";

const ids = [
  "cpu_energy_performance",
  "pcie_link_power",
  "usb_suspend_diagnostics",
  "hybrid_short_threads",
  "hybrid_long_threads",
] as const;
const copy: Record<Lang, [string, string][]> = {
  en: [
    [
      "Favor CPU performance on mains power",
      "Sets CPU energy-performance preference to 0 in the current plan while plugged in. Requires autonomous CPPC support; firmware and thermal limits still apply. May increase heat and power use. Battery settings stay unchanged. Test your workload before keeping it.",
    ],
    [
      "Keep PCIe links active on mains power",
      "Disables PCIe link-state power saving in the current plan while plugged in. A troubleshooting option for devices affected by power transitions; latency improvements are not guaranteed. May increase idle power use. Battery settings stay unchanged.",
    ],
    [
      "USB wake troubleshooting on mains power",
      "Disables USB selective suspend while plugged in to investigate device wake or disconnect problems. Windows recommends leaving it enabled normally. Restore after testing; idle power use may increase. Battery settings stay unchanged.",
    ],
    [
      "Prefer performance cores for short threads",
      "On a CPU with different efficiency classes, asks Windows to prefer performant cores for short-running threads while plugged in. This is a preference, not a fixed affinity mask. Automatic scheduling may work better. Battery settings stay unchanged.",
    ],
    [
      "Prefer performance cores for long threads",
      "On a CPU with different efficiency classes, asks Windows to prefer performant cores for long-running threads while plugged in. Other cores remain available; E-cores are not disabled. Compare throughput and responsiveness. Battery settings stay unchanged.",
    ],
  ],
  it: [
    [
      "Privilegia le prestazioni CPU con alimentazione di rete",
      "Imposta a 0 la preferenza energetica della CPU nel piano corrente quando il PC è collegato alla rete elettrica. Richiede CPPC autonomo; restano i limiti termici e del firmware. Può aumentare calore e consumi. Non modifica la batteria. Valuta il tuo carico prima di mantenerlo.",
    ],
    [
      "Mantieni attivi i collegamenti PCIe con alimentazione di rete",
      "Disattiva il risparmio energetico dei collegamenti PCIe nel piano corrente con alimentazione di rete. Serve a diagnosticare problemi durante le transizioni energetiche; non garantisce una latenza inferiore. Può aumentare i consumi a riposo. Non modifica la batteria.",
    ],
    [
      "Diagnostica il risveglio USB con alimentazione di rete",
      "Disattiva la sospensione selettiva USB con alimentazione di rete per indagare problemi di risveglio o disconnessione. Windows consiglia di lasciarla normalmente attiva. Ripristina dopo la prova: i consumi a riposo possono aumentare. Non modifica la batteria.",
    ],
    [
      "Preferisci i core prestanti per i thread brevi",
      "Su CPU con classi di efficienza differenti, chiede a Windows di preferire i core prestanti per i thread brevi con alimentazione di rete. È una preferenza, non un'affinità fissa. Lo scheduling automatico può funzionare meglio. Non modifica la batteria.",
    ],
    [
      "Preferisci i core prestanti per i thread lunghi",
      "Su CPU con classi di efficienza differenti, chiede a Windows di preferire i core prestanti per i thread lunghi con alimentazione di rete. Gli altri core restano disponibili: non disattiva gli E-core. Confronta produttività e reattività. Non modifica la batteria.",
    ],
  ],
  fr: [
    [
      "Privilégier les performances du processeur sur secteur",
      "Règle la préférence énergétique du processeur sur 0 dans le mode actif, sur secteur. Nécessite CPPC autonome ; les limites thermiques et du micrologiciel restent applicables. Peut augmenter la chaleur et la consommation. La batterie reste inchangée. Testez votre charge de travail.",
    ],
    [
      "Maintenir les liaisons PCIe actives sur secteur",
      "Désactive l'économie d'énergie des liaisons PCIe dans le mode actif, sur secteur. Option de diagnostic pour les transitions énergétiques ; aucune réduction de latence garantie. Peut augmenter la consommation au repos. La batterie reste inchangée.",
    ],
    [
      "Diagnostiquer le réveil USB sur secteur",
      "Désactive la suspension sélective USB sur secteur pour rechercher des problèmes de réveil ou de déconnexion. Windows recommande de la laisser normalement activée. Restaurez après le test ; la consommation au repos peut augmenter. La batterie reste inchangée.",
    ],
    [
      "Préférer les cœurs performants pour les threads courts",
      "Sur un processeur avec plusieurs classes d'efficacité, demande à Windows de préférer les cœurs performants pour les threads courts sur secteur. C'est une préférence, pas une affinité fixe. La planification automatique peut être meilleure. La batterie reste inchangée.",
    ],
    [
      "Préférer les cœurs performants pour les threads longs",
      "Sur un processeur avec plusieurs classes d'efficacité, demande à Windows de préférer les cœurs performants pour les threads longs sur secteur. Les autres cœurs restent disponibles ; les E-cores ne sont pas désactivés. Comparez le débit et la réactivité. La batterie reste inchangée.",
    ],
  ],
  es: [
    [
      "Priorizar el rendimiento de la CPU conectada a la corriente",
      "Establece en 0 la preferencia energética de la CPU en el plan actual al conectar el equipo. Requiere CPPC autónomo; siguen vigentes los límites térmicos y del firmware. Puede aumentar el calor y el consumo. No cambia la batería. Prueba tu carga de trabajo.",
    ],
    [
      "Mantener activos los enlaces PCIe con alimentación externa",
      "Desactiva el ahorro de energía de los enlaces PCIe en el plan actual al conectar el equipo. Opción de diagnóstico para transiciones energéticas; no garantiza menor latencia. Puede aumentar el consumo en reposo. No cambia la batería.",
    ],
    [
      "Diagnosticar la reactivación USB con alimentación externa",
      "Desactiva la suspensión selectiva USB al conectar el equipo para investigar problemas de reactivación o desconexión. Windows recomienda mantenerla activada normalmente. Restaura después de la prueba; puede aumentar el consumo en reposo. No cambia la batería.",
    ],
    [
      "Preferir núcleos de rendimiento para hilos cortos",
      "En CPU con distintas clases de eficiencia, pide a Windows que prefiera núcleos de rendimiento para hilos cortos con alimentación externa. Es una preferencia, no una afinidad fija. La planificación automática puede funcionar mejor. No cambia la batería.",
    ],
    [
      "Preferir núcleos de rendimiento para hilos largos",
      "En CPU con distintas clases de eficiencia, pide a Windows que prefiera núcleos de rendimiento para hilos largos con alimentación externa. Los demás núcleos siguen disponibles; no desactiva los E-cores. Compara rendimiento y respuesta. No cambia la batería.",
    ],
  ],
  de: [
    [
      "CPU-Leistung im Netzbetrieb bevorzugen",
      "Setzt die Energie-Leistungspräferenz der CPU im aktuellen Energiesparplan bei Netzbetrieb auf 0. Autonomes CPPC ist erforderlich; Temperatur- und Firmwaregrenzen gelten weiterhin. Wärme und Stromverbrauch können steigen. Der Akkubetrieb bleibt unverändert. Mit eigener Arbeitslast testen.",
    ],
    [
      "PCIe-Verbindungen im Netzbetrieb aktiv halten",
      "Deaktiviert das Energiesparen der PCIe-Verbindungen im aktuellen Plan bei Netzbetrieb. Zur Diagnose von Problemen bei Energiezustandswechseln; geringere Latenz ist nicht garantiert. Kann den Leerlaufverbrauch erhöhen. Der Akkubetrieb bleibt unverändert.",
    ],
    [
      "USB-Aufwachprobleme im Netzbetrieb untersuchen",
      "Deaktiviert selektives USB-Energiesparen bei Netzbetrieb zur Untersuchung von Aufwachproblemen oder Verbindungsabbrüchen. Windows empfiehlt, es normalerweise aktiviert zu lassen. Nach dem Test wiederherstellen; der Leerlaufverbrauch kann steigen. Der Akkubetrieb bleibt unverändert.",
    ],
    [
      "Leistungskerne für kurze Threads bevorzugen",
      "Bittet Windows auf CPUs mit unterschiedlichen Effizienzklassen, im Netzbetrieb Leistungskerne für kurze Threads zu bevorzugen. Eine Präferenz, keine feste Affinität. Automatische Planung kann besser funktionieren. Der Akkubetrieb bleibt unverändert.",
    ],
    [
      "Leistungskerne für lange Threads bevorzugen",
      "Bittet Windows auf CPUs mit unterschiedlichen Effizienzklassen, im Netzbetrieb Leistungskerne für lange Threads zu bevorzugen. Andere Kerne bleiben verfügbar; E-Kerne werden nicht deaktiviert. Durchsatz und Reaktionsfähigkeit vergleichen. Der Akkubetrieb bleibt unverändert.",
    ],
  ],
  pt: [
    [
      "Priorizar o desempenho da CPU ligada à tomada",
      "Define como 0 a preferência energética da CPU no plano atual quando ligada à tomada. Requer CPPC autônomo; os limites térmicos e do firmware continuam válidos. Pode aumentar o calor e o consumo. Não altera a bateria. Teste sua carga de trabalho.",
    ],
    [
      "Manter as conexões PCIe ativas na tomada",
      "Desativa a economia de energia das conexões PCIe no plano atual quando ligado à tomada. Opção de diagnóstico para transições de energia; não garante menor latência. Pode aumentar o consumo em repouso. Não altera a bateria.",
    ],
    [
      "Diagnosticar a reativação USB na tomada",
      "Desativa a suspensão seletiva USB na tomada para investigar problemas de reativação ou desconexão. O Windows recomenda mantê-la ativada normalmente. Restaure após o teste; o consumo em repouso pode aumentar. Não altera a bateria.",
    ],
    [
      "Preferir núcleos de desempenho para threads curtas",
      "Em CPUs com diferentes classes de eficiência, solicita ao Windows que prefira núcleos de desempenho para threads curtas na tomada. É uma preferência, não uma afinidade fixa. O agendamento automático pode funcionar melhor. Não altera a bateria.",
    ],
    [
      "Preferir núcleos de desempenho para threads longas",
      "Em CPUs com diferentes classes de eficiência, solicita ao Windows que prefira núcleos de desempenho para threads longas na tomada. Os outros núcleos continuam disponíveis; não desativa os E-cores. Compare rendimento e resposta. Não altera a bateria.",
    ],
  ],
};
export const POWER_TUNING_COPY = Object.fromEntries(
  Object.entries(copy).map(([lang, rows]) => [
    lang,
    Object.fromEntries(
      rows.map(([name, description], index) => [ids[index], { name, description }]),
    ),
  ]),
) as Record<Lang, Record<string, TweakText>>;
