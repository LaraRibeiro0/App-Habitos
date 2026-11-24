// =====================================================================
//  Início (dashboard): resumo da semana atual.
//  Tudo é calculado a partir dos registos; nada é guardado à parte.
// =====================================================================
import { estado } from '../app.js';
import * as db from '../data.js';
import * as st from '../stats.js';
import { esc, iso, hoje, somarDias, inicioSemana, dataLonga, dataCurta, diasEntre, duracao, num } from '../util.js';

// Pequeno gráfico de linha do peso (SVG desenhado à mão).
function sparkline(pesagens) {
  if (pesagens.length < 2) return '';
  const L = 300, A = 48, m = 4;
  const pesos = pesagens.map((p) => Number(p.peso));
  const min = Math.min(...pesos), max = Math.max(...pesos);
  const de = pesagens[0].data, ate = pesagens.at(-1).data;
  const total = Math.max(diasEntre(de, ate), 1);
  const x = (p) => m + (diasEntre(de, p.data) / total) * (L - 2 * m);
  const y = (p) => (max === min ? A / 2 : m + (1 - (Number(p.peso) - min) / (max - min)) * (A - 2 * m));
  const pontos = pesagens.map((p) => `${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const ult = pesagens.at(-1);
  return `<svg class="sparkline" viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img" aria-label="Evolução do peso nos últimos 30 dias">
    <polyline points="${pontos}" fill="none" stroke="var(--destaque)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${x(ult)}" cy="${y(ult)}" r="3.5" fill="var(--destaque)"/>
  </svg>`;
}

export async function mostrar(ecra, _params, aindaAtual) {
  const perfil = estado.perfil;
  const hj = hoje();
  const de = somarDias(inicioSemana(hj), -90);

  const [dias, primeira, consultas, tarefas] = await Promise.all([
    db.carregarPeriodo(de, hj),
    perfil.peso_objetivo != null ? db.primeiraPesagem() : null,
    perfil.tem_nutricionista ? db.listarConsultas() : [],
    db.listarTarefas(),
  ]);
  if (!aindaAtual()) return;

  const semana = st.resumoSemana(dias, perfil, hj);
  const media4 = st.mediaTreinos4Semanas(dias, hj);
  const seq = st.sequencias(dias, hj);
  const registouHoje = dias.some((d) => d.data === hj);

  // Peso: última pesagem e variação face à pesagem de há ~1 semana
  const pesagens = dias.filter((d) => d.peso != null);
  const ultima = pesagens.at(-1);
  const anterior = ultima && [...pesagens].reverse().find((p) => diasEntre(p.data, ultima.data) >= 7);
  const variacao = ultima && anterior ? ultima.peso - anterior.peso : null;
  const pesos30 = pesagens.filter((p) => p.data >= somarDias(hj, -30));
  const progresso = st.progressoPeso(primeira?.peso, ultima?.peso, perfil.peso_objetivo);

  // Próxima consulta: a data marcada na consulta mais recente
  const proxima = consultas.find((c) => c.proxima_data)?.proxima_data;
  const diasProxima = proxima ? diasEntre(hj, proxima) : null;

  const habitos = estado.categorias.filter((c) => c.tipo === 'habito' && !c.arquivada);
  // Tarefas: em aberto, atrasadas, e feitas esta semana
  const abertas = tarefas.filter((t) => t.estado === 'por_fazer' || t.estado === 'a_fazer');
  const atrasadas = abertas.filter((t) => t.data && t.data < hj).length;
  const paraHoje = abertas.filter((t) => t.data === hj).length;
  const feitasSemana = tarefas.filter((t) => t.estado === 'feita' && iso(new Date(t.atualizado_em)) >= semana.de).length;
  const nome = perfil.nome?.split(' ')[0];
  const ref = semana.refeicoes;
  const pct = (n) => (ref.total ? (n / ref.total) * 100 : 0);
  const objTreinos = perfil.treinos_objetivo_semana;
  const objSono = perfil.sono_objetivo_min;
  const objLiq = perfil.liquidos_objetivo_ml;

  ecra.innerHTML = `
    <div class="saudacao">
      <p class="suave">${esc(dataLonga(hj).replace(/^./, (l) => l.toUpperCase()))}</p>
      <h1>Olá${nome ? `, ${esc(nome)}` : ''}</h1>
    </div>

    <a class="botao botao-grande" href="#/registar">${registouHoje ? 'Continuar o registo de hoje' : 'Registar hoje'}</a>

    ${diasProxima != null && diasProxima >= 0 ? `
    <a class="cartao destaque-consulta" href="#/consultas" style="text-decoration:none;color:inherit">
      <span class="rotulo">Próxima consulta</span>
      <div class="metrica-valor">${diasProxima === 0 ? 'Hoje' : diasProxima === 1 ? 'Amanhã' : `daqui a ${diasProxima} dias`}</div>
      <span class="suave pequeno">${dataCurta(proxima)} · ver o resumo do período</span>
    </a>` : ''}

    ${!dias.length ? `
    <div class="cartao">
      <h2>Ainda não tens registos</h2>
      <p class="suave">Regista o teu primeiro dia: o resumo da semana aparece aqui à medida que fores registando.</p>
    </div>` : ''}

    <p class="rotulo" style="margin-top:4px">Esta semana · desde ${dataCurta(semana.de).slice(0, 5)}</p>
    <div class="metricas">

      <div class="cartao metrica metrica-larga">
        <span class="rotulo">Peso</span>
        ${ultima ? `
          <div class="metrica-valor">${num(ultima.peso)} <small>kg</small>
            ${variacao != null ? `<small class="${variacao <= 0 ? 'variacao-baixa' : 'variacao-sobe'}">${variacao > 0 ? '+' : ''}${num(variacao)} kg numa semana</small>` : ''}
          </div>
          <span class="suave pequeno">Última pesagem: ${dataCurta(ultima.data)}</span>
          ${sparkline(pesos30)}
          ${progresso != null ? `
            <div class="barra" aria-label="Progresso até ao objetivo"><span style="width:${progresso * 100}%"></span></div>
            <span class="suave pequeno">Objetivo ${num(perfil.peso_objetivo)} kg · ${
              ultima.peso <= perfil.peso_objetivo ? 'atingido!' : `faltam ${num(ultima.peso - perfil.peso_objetivo)} kg`}</span>` : ''}
        ` : '<p class="suave pequeno">Sem pesagens. Regista o peso nos dias em que te pesares.</p>'}
      </div>

      <div class="cartao metrica">
        <span class="rotulo">Treinos</span>
        <div class="metrica-valor">${semana.treinos}${objTreinos ? ` <small>de ${objTreinos}</small>` : ''}</div>
        ${objTreinos ? `<div class="barra"><span style="width:${Math.min(100, (semana.treinos / objTreinos) * 100)}%"></span></div>` : ''}
        <span class="suave pequeno">Média de 4 semanas: ${num(media4)}</span>
      </div>

      <div class="cartao metrica">
        <span class="rotulo">Sono por noite</span>
        <div class="metrica-valor">${duracao(semana.sonoMedio)}</div>
        ${semana.dividaSono != null ? `<span class="suave pequeno">${
          semana.dividaSono > 0 ? `${duracao(semana.dividaSono)} a menos que o objetivo` :
          semana.dividaSono < 0 ? `${duracao(-semana.dividaSono)} a mais que o objetivo` : 'Mesmo no objetivo'}</span>` :
          `<span class="suave pequeno">${objSono ? 'Sem noites registadas' : ''}</span>`}
      </div>

      <div class="cartao metrica metrica-larga">
        <span class="rotulo">Refeições</span>
        ${ref.total ? `
          <div class="barra-multi" aria-hidden="true">
            <span style="width:${pct(ref.plano)}%;background:var(--plano)"></span>
            <span style="width:${pct(ref.parcial)}%;background:var(--parcial)"></span>
            <span style="width:${pct(ref.livre)}%;background:var(--livre)"></span>
          </div>
          <div class="legenda">
            <span><i style="background:var(--plano)"></i>${ref.plano} dentro do plano</span>
            <span><i style="background:var(--parcial)"></i>${ref.parcial} parcialmente</span>
            <span><i style="background:var(--livre)"></i>${ref.livre} livres</span>
          </div>` : '<p class="suave pequeno">Sem refeições registadas esta semana.</p>'}
      </div>

      <div class="cartao metrica">
        <span class="rotulo">Líquidos por dia</span>
        <div class="metrica-valor">${semana.liquidosMedio != null ? num(semana.liquidosMedio / 1000, 2) : '—'} <small>L</small></div>
        ${objLiq ? `<span class="suave pequeno">Objetivo ${num(objLiq / 1000, 2)} L</span>` : ''}
      </div>

      <div class="cartao metrica">
        <span class="rotulo">Sequências</span>
        <div class="metrica-valor">${seq.registo} <small>${seq.registo === 1 ? 'dia' : 'dias'} a registar</small></div>
        <span class="suave pequeno">${seq.plano} ${seq.plano === 1 ? 'dia seguido' : 'dias seguidos'} dentro do plano</span>
      </div>

      <a class="cartao metrica metrica-larga" href="#/tarefas" style="text-decoration:none;color:inherit">
        <span class="rotulo">Tarefas</span>
        <div class="metrica-valor">${abertas.length} <small>em aberto${paraHoje ? ` · ${paraHoje} para hoje` : ''}</small></div>
        <span class="suave pequeno">${feitasSemana} ${feitasSemana === 1 ? 'feita' : 'feitas'} esta semana${
          atrasadas ? ` · <span style="color:var(--livre)">${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>` : ''}</span>
      </a>

      ${habitos.length ? `
      <div class="cartao metrica metrica-larga">
        <span class="rotulo">Outros hábitos · dias esta semana</span>
        <div class="contagens">
          ${habitos.map((h) => {
            const n = semana.porHabito[h.id] || 0;
            return `<div class="contagem"><span><span class="ponto" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:${esc(h.cor)}"></span>${esc(h.nome)}</span>
              <strong>${n} ${n === 1 ? 'dia' : 'dias'}</strong></div>`;
          }).join('')}
        </div>
      </div>` : ''}

      ${perfil.acompanha_meditacao ? `
      <div class="cartao metrica">
        <span class="rotulo">Meditação</span>
        <div class="metrica-valor">${semana.meditacao.dias} <small>${semana.meditacao.dias === 1 ? 'dia' : 'dias'}</small></div>
        <span class="suave pequeno">${semana.meditacao.minutos} minutos no total</span>
      </div>` : ''}

      ${perfil.acompanha_leitura ? `
      <div class="cartao metrica">
        <span class="rotulo">Leitura</span>
        <div class="metrica-valor">${semana.leitura.dias} <small>${semana.leitura.dias === 1 ? 'dia' : 'dias'}</small></div>
        <span class="suave pequeno">${semana.leitura.minutos} minutos no total</span>
      </div>` : ''}
    </div>`;
}
