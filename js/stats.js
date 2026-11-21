// =====================================================================
//  Cálculos dos resumos (dashboard e período entre consultas).
//  São funções "puras": recebem dados e devolvem números, sem tocar
//  na base de dados nem no ecrã. Por isso são fáceis de testar.
//
//  Cada "dia" tem o formato que vem do Supabase:
//    { data, sono_deitar, sono_acordar, meditacao_min, leitura_min, peso,
//      refeicoes_dia: [...], atividades_dia: [...], liquidos_dia: [...] }
// =====================================================================
import { minutosSono, inicioSemana, somarDias, diasEntre } from './util.js';

const soma = (lista) => lista.reduce((a, b) => a + b, 0);
const media = (lista) => (lista.length ? soma(lista) / lista.length : null);

export function totalLiquidos(dia) {
  return soma((dia.liquidos_dia || []).map((l) => l.quantidade_ml || 0));
}

export function sonoDoDia(dia) {
  return minutosSono(dia.sono_deitar, dia.sono_acordar);
}

// Contagem das refeições por categoria: { plano, parcial, livre, total }
export function contarRefeicoes(dias) {
  const c = { plano: 0, parcial: 0, livre: 0, total: 0 };
  for (const d of dias) {
    for (const r of d.refeicoes_dia || []) {
      if (c[r.categoria] != null) c[r.categoria]++;
      c.total++;
    }
  }
  return c;
}

// Um dia "dentro do plano" tem pelo menos uma refeição e todas no plano.
export function diaDentroDoPlano(dia) {
  const r = dia.refeicoes_dia || [];
  return r.length > 0 && r.every((x) => x.categoria === 'plano');
}

export function temRefeicaoLivre(dia) {
  return (dia.refeicoes_dia || []).some((x) => x.categoria === 'livre');
}

// Resumo de um conjunto de dias (uma semana ou o período entre consultas).
//   nDias = número de dias do intervalo (para médias "por semana")
export function resumo(dias, perfil, nDias) {
  const noites = dias.map(sonoDoDia).filter((m) => m != null);
  const objSono = perfil?.sono_objetivo_min;

  // Dívida de sono: quanto faltou (positivo) ou sobrou (negativo) face ao
  // objetivo, somando só as noites registadas.
  const dividaSono = objSono && noites.length
    ? soma(noites.map((m) => objSono - m))
    : null;

  const comLiquidos = dias.filter((d) => (d.liquidos_dia || []).length);
  const atividades = dias.flatMap((d) => d.atividades_dia || []);

  // Treinos por atividade: { categoria_id: { vezes, minutos } }
  const porAtividade = {};
  for (const a of atividades) {
    const p = (porAtividade[a.categoria_id] ||= { vezes: 0, minutos: 0 });
    p.vezes++;
    p.minutos += a.duracao_min || 0;
  }

  const diasMeditacao = dias.filter((d) => d.meditacao_min > 0);
  const diasLeitura = dias.filter((d) => d.leitura_min > 0);
  const pesagens = dias.filter((d) => d.peso != null).sort((a, b) => (a.data < b.data ? -1 : 1));
  const semanas = Math.max(nDias / 7, 1);

  return {
    diasRegistados: dias.length,
    treinos: atividades.length,
    treinosPorSemana: atividades.length / semanas,
    porAtividade,
    refeicoes: contarRefeicoes(dias),
    sonoMedio: media(noites),
    noites: noites.length,
    dividaSono,
    liquidosMedio: media(comLiquidos.map(totalLiquidos)),
    meditacao: { dias: diasMeditacao.length, minutos: soma(diasMeditacao.map((d) => d.meditacao_min)) },
    leitura: { dias: diasLeitura.length, minutos: soma(diasLeitura.map((d) => d.leitura_min)) },
    meditacaoPorSemana: diasMeditacao.length / semanas,
    leituraPorSemana: diasLeitura.length / semanas,
    pesoInicio: pesagens[0] || null,
    pesoFim: pesagens.at(-1) || null,
  };
}

// Dias de uma lista que caem entre duas datas (inclusive).
export function filtrarPeriodo(dias, de, ate) {
  return dias.filter((d) => d.data >= de && d.data <= ate);
}

// Resumo da semana atual (segunda até hoje).
export function resumoSemana(dias, perfil, hoje) {
  const seg = inicioSemana(hoje);
  return { de: seg, ate: hoje, ...resumo(filtrarPeriodo(dias, seg, hoje), perfil, diasEntre(seg, hoje) + 1) };
}

// Média de treinos por semana nas 4 semanas completas anteriores.
export function mediaTreinos4Semanas(dias, hoje) {
  const seg = inicioSemana(hoje);
  const de = somarDias(seg, -28);
  const ate = somarDias(seg, -1);
  const n = filtrarPeriodo(dias, de, ate).flatMap((d) => d.atividades_dia || []).length;
  return n / 4;
}

// Sequências: dias seguidos com registo e dias seguidos dentro do plano.
// Se hoje ainda não foi registado, a contagem começa em ontem (para a
// sequência não "partir" logo de manhã).
export function sequencias(dias, hoje) {
  const porData = new Map(dias.map((d) => [d.data, d]));
  const contar = (condicao) => {
    let dia = porData.has(hoje) && condicao(porData.get(hoje)) ? hoje : somarDias(hoje, -1);
    let n = 0;
    while (porData.has(dia) && condicao(porData.get(dia))) {
      n++;
      dia = somarDias(dia, -1);
    }
    return n;
  };
  return {
    registo: contar(() => true),
    plano: contar(diaDentroDoPlano),
  };
}

// Progresso até ao peso objetivo, de 0 a 1 (ou null sem dados).
export function progressoPeso(inicial, atual, objetivo) {
  if (inicial == null || atual == null || objetivo == null) return null;
  const total = inicial - objetivo;
  if (total === 0) return 1;
  return Math.min(Math.max((inicial - atual) / total, 0), 1);
}
