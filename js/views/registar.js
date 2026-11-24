// =====================================================================
//  Registo diário: um ecrã por dia, com todos os blocos.
//  Endereço: #/registar            → hoje
//            #/registar/2026-11-21 → esse dia
// =====================================================================
import { estado, recarregarBase, ir, ui } from '../app.js';
import { htmlTarefa, ligarTarefas } from './tarefas.js';
import * as db from '../data.js';
import {
  $, $$, esc, hoje, somarDias, dataLonga, deIso, minutosSono, duracao, num,
  lerNumero, janela, aviso, mostrarErro, CORES,
} from '../util.js';

const CATEGORIAS_REFEICAO = [
  { valor: 'plano', rotulo: 'Dentro do plano' },
  { valor: 'parcial', rotulo: 'Parcialmente' },
  { valor: 'livre', rotulo: 'Refeição livre' },
];
const INTENSIDADES = ['leve', 'moderada', 'intensa'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Monta as refeições do ecrã: as habituais do perfil (com o que já foi
// guardado nesse dia) e, a seguir, as refeições extra.
function montarRefeicoes(guardadas) {
  const lista = estado.refeicoesTipo.map((t) => {
    const g = guardadas.find((x) => x.refeicao_tipo_id === t.id);
    return {
      refeicao_tipo_id: t.id,
      nome: t.nome,
      hora: (g?.hora || t.hora || '').slice(0, 5),
      descricao: g?.descricao || '',
      categoria: g?.categoria || null,
    };
  });
  const idsAtivos = new Set(estado.refeicoesTipo.map((t) => t.id));
  for (const g of guardadas) {
    if (!g.refeicao_tipo_id || !idsAtivos.has(g.refeicao_tipo_id)) {
      lista.push({ refeicao_tipo_id: null, nome: g.nome, hora: (g.hora || '').slice(0, 5),
        descricao: g.descricao || '', categoria: g.categoria, extra: true });
    }
  }
  return lista;
}

function montarEstado(dia) {
  return {
    refeicoes: montarRefeicoes(dia?.refeicoes_dia || []),
    atividades: (dia?.atividades_dia || []).map((a) => ({ ...a })),
    liquidos: (dia?.liquidos_dia || []).map((l) => ({ ...l })),
    habitos: new Set((dia?.habitos_dia || []).map((h) => h.categoria_id)),
    sono_deitar: (dia?.sono_deitar || '').slice(0, 5),
    sono_acordar: (dia?.sono_acordar || '').slice(0, 5),
    sono_qualidade: dia?.sono_qualidade || null,
    meditacao_min: dia?.meditacao_min ?? null,
    leitura_min: dia?.leitura_min ?? null,
    leitura_livro: dia?.leitura_livro || '',
    peso: dia?.peso ?? null,
    notas: dia?.notas || '',
  };
}

export async function mostrar(ecra, params, aindaAtual) {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params[0] || '') ? params[0] : hoje();
  const [diaGuardado, tarefasDia] = await Promise.all([db.carregarDia(data), db.tarefasEntre(data, data)]);
  if (!aindaAtual()) return;

  const perfil = estado.perfil;
  let d = montarEstado(diaGuardado);
  let alterado = false;
  // Marca o dia como "com alterações por guardar" (aqui e para a app,
  // para a atualização automática não apagar o que estás a escrever).
  const marcar = () => { alterado = true; ui.sujo = true; };
  let bebidaAtual = null;

  const cats = (tipo) => estado.categorias.filter((c) => c.tipo === tipo && !c.arquivada);
  const catPorId = (id) => estado.categorias.find((c) => c.id === id);

  // ---------- Desenho ----------
  function htmlRefeicao(r, i) {
    return `
      <div class="refeicao" data-r="${i}">
        <div class="refeicao-cabeca">
          ${r.extra
            ? `<input class="nome-extra" data-campo="nome" value="${esc(r.nome)}" aria-label="Nome da refeição extra">`
            : `<span class="nome">${esc(r.nome)}</span>`}
          <input type="time" data-campo="hora" value="${esc(r.hora)}" aria-label="Hora de ${esc(r.nome)}">
          ${r.extra ? `<button type="button" class="botao-icone" data-remover-extra="${i}" aria-label="Remover">✕</button>` : ''}
        </div>
        <textarea data-campo="descricao" rows="2" placeholder="O que comeste?">${esc(r.descricao)}</textarea>
        <div class="segmentos" role="group" aria-label="Categoria de ${esc(r.nome)}">
          ${CATEGORIAS_REFEICAO.map((c) => `
            <button type="button" class="cat-${c.valor}" data-categoria="${c.valor}"
              aria-pressed="${r.categoria === c.valor}">${c.rotulo}</button>`).join('')}
        </div>
      </div>`;
  }

  function htmlAtividade(a, i) {
    return `
      <div class="item-bloco" data-a="${i}">
        <div class="item-linha">
          <select data-campo="categoria_id" aria-label="Atividade">
            ${cats('atividade').map((c) => `<option value="${c.id}" ${c.id === a.categoria_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
            ${a.categoria_id && !cats('atividade').some((c) => c.id === a.categoria_id)
              ? `<option value="${a.categoria_id}" selected>${esc(catPorId(a.categoria_id)?.nome || 'Atividade arquivada')}</option>` : ''}
          </select>
          <input type="number" min="1" data-campo="duracao_min" value="${esc(a.duracao_min ?? '')}" placeholder="min" aria-label="Duração em minutos">
          <button type="button" class="botao-icone" data-remover-atividade="${i}" aria-label="Remover treino">✕</button>
        </div>
        <div class="segmentos" role="group" aria-label="Intensidade">
          ${INTENSIDADES.map((n) => `<button type="button" data-intensidade="${n}" aria-pressed="${a.intensidade === n}">${n[0].toUpperCase() + n.slice(1)}</button>`).join('')}
        </div>
      </div>`;
  }

  function htmlLiquidos() {
    const bebidas = cats('bebida');
    if (!bebidaAtual || !bebidas.some((b) => b.id === bebidaAtual)) bebidaAtual = bebidas[0]?.id ?? null;
    const total = d.liquidos.reduce((s, l) => s + (l.quantidade_ml || 0), 0);
    const obj = perfil.liquidos_objetivo_ml;
    return `
      <div class="total-liquidos">
        <span class="horas-sono">${num(total / 1000, 2)} L</span>
        ${obj ? `<span class="suave">objetivo ${num(obj / 1000, 2)} L</span>` : ''}
      </div>
      ${obj ? `<div class="barra"><span style="width:${Math.min(100, (total / obj) * 100)}%"></span></div>` : ''}
      <div class="fichas" role="group" aria-label="Bebida">
        ${bebidas.map((b) => `<button type="button" class="ficha" data-bebida="${b.id}" aria-pressed="${b.id === bebidaAtual}"><span class="ponto" style="background:${esc(b.cor)}"></span>${esc(b.nome)}</button>`).join('')}
        <button type="button" class="ficha ficha-nova" data-nova-cat="bebida">+ Nova</button>
      </div>
      <div class="botoes">
        <button type="button" class="botao botao-sec" data-ml="250">+250 ml</button>
        <button type="button" class="botao botao-sec" data-ml="330">+330 ml</button>
        <button type="button" class="botao botao-sec" data-ml="500">+500 ml</button>
        <button type="button" class="botao botao-sec" data-ml="outro">Outra</button>
      </div>
      ${d.liquidos.length ? `<div>
        ${d.liquidos.map((l, i) => {
          const c = catPorId(l.categoria_id);
          return `<div class="liquido-linha"><span><span class="ponto" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:${esc(c?.cor || '#999')}"></span>${esc(c?.nome || 'Bebida')}</span>
            <span class="num">${l.quantidade_ml} ml <button type="button" class="botao-icone" style="display:inline-grid;width:32px;height:32px" data-remover-liquido="${i}" aria-label="Remover">✕</button></span></div>`;
        }).join('')}</div>` : ''}`;
  }

  function desenhar() {
    const sono = minutosSono(d.sono_deitar, d.sono_acordar);
    const ontem = deIso(somarDias(data, -1));
    const esteDia = deIso(data);
    ecra.innerHTML = `
      <div class="seletor-data">
        <button class="botao-icone" id="dia-anterior" aria-label="Dia anterior">‹</button>
        <div style="display:grid;justify-items:center;gap:2px">
          <h1>${data === hoje() ? 'Hoje' : esc(dataLonga(data))}</h1>
          <input type="date" id="escolher-data" value="${data}" max="${hoje()}" aria-label="Escolher dia">
        </div>
        <button class="botao-icone" id="dia-seguinte" aria-label="Dia seguinte" ${data >= hoje() ? 'disabled style="visibility:hidden"' : ''}>›</button>
      </div>
      ${diaGuardado ? '' : '<p class="suave pequeno" style="text-align:center">Este dia ainda não tem registo.</p>'}

      <section class="cartao" id="bloco-refeicoes">
        <div class="cartao-cabeca"><h2>Alimentação</h2>
          <button type="button" class="botao botao-texto" id="copiar-ontem">Copiar de ontem</button></div>
        ${d.refeicoes.map(htmlRefeicao).join('')}
        <button type="button" class="botao botao-sec" id="mais-extra">+ Refeição extra</button>
      </section>

      <section class="cartao" id="bloco-atividades">
        <h2>Atividade física</h2>
        ${d.atividades.length ? d.atividades.map(htmlAtividade).join('') : '<p class="suave pequeno">Sem treinos registados neste dia.</p>'}
        <div class="botoes">
          <button type="button" class="botao botao-sec" id="mais-atividade" ${cats('atividade').length ? '' : 'disabled'}>+ Adicionar treino</button>
          <button type="button" class="botao botao-texto" data-nova-cat="atividade">+ Nova atividade</button>
        </div>
      </section>

      <section class="cartao" id="bloco-tarefas"></section>

      <section class="cartao" id="bloco-habitos">
        <h2>Outros hábitos</h2>
        ${cats('habito').length ? `
          <p class="suave pequeno">Toca nos que fizeste hoje.</p>
          <div class="fichas" role="group" aria-label="Outros hábitos">
            ${cats('habito').map((h) => `<button type="button" class="ficha" data-habito="${h.id}" aria-pressed="${d.habitos.has(h.id)}">
              <span class="ponto" style="background:${esc(h.cor)}"></span>${esc(h.nome)}</button>`).join('')}
          </div>` : '<p class="suave pequeno">Acrescenta suplementos ou outros hábitos diários que queres acompanhar, por exemplo creatina ou vitaminas.</p>'}
        <div><button type="button" class="botao botao-texto" data-nova-cat="habito">+ Novo hábito</button></div>
      </section>

      <section class="cartao" id="bloco-liquidos">
        <h2>Líquidos</h2>
        <div id="liquidos">${htmlLiquidos()}</div>
      </section>

      <section class="cartao" id="bloco-sono">
        <div class="cartao-cabeca"><h2>Sono</h2><span class="horas-sono" id="horas-sono">${sono ? duracao(sono) : ''}</span></div>
        <p class="suave pequeno">Noite de ${DIAS_CURTOS[ontem.getDay()]} para ${DIAS_CURTOS[esteDia.getDay()]}</p>
        <div class="linha-campos">
          <label class="campo"><span>Adormeci às</span><input type="time" id="sono-deitar" value="${esc(d.sono_deitar)}"></label>
          <label class="campo"><span>Acordei às</span><input type="time" id="sono-acordar" value="${esc(d.sono_acordar)}"></label>
        </div>
        <div class="segmentos" role="group" aria-label="Qualidade do sono">
          ${[['bem', 'Dormi bem'], ['mais_ou_menos', 'Mais ou menos'], ['mal', 'Dormi mal']].map(([v, t]) =>
            `<button type="button" data-qualidade="${v}" aria-pressed="${d.sono_qualidade === v}">${t}</button>`).join('')}
        </div>
      </section>

      ${perfil.acompanha_meditacao ? `
      <section class="cartao">
        <h2>Meditação ou relaxamento</h2>
        <label class="campo"><span>Minutos (vazio se não fizeste)</span>
          <input type="number" min="0" id="meditacao" value="${esc(d.meditacao_min ?? '')}"></label>
        <div class="fichas">${[5, 10, 15, 20, 30].map((m) => `<button type="button" class="ficha" data-meditacao="${m}">${m} min</button>`).join('')}</div>
      </section>` : ''}

      ${perfil.acompanha_leitura ? `
      <section class="cartao">
        <h2>Leitura</h2>
        <div class="linha-campos">
          <label class="campo"><span>Minutos</span><input type="number" min="0" id="leitura" value="${esc(d.leitura_min ?? '')}"></label>
          <label class="campo"><span>Livro (opcional)</span><input id="livro" value="${esc(d.leitura_livro)}"></label>
        </div>
      </section>` : ''}

      <section class="cartao">
        <h2>Peso</h2>
        <label class="campo"><span>Peso de hoje em kg (só se te pesaste)</span>
          <input id="peso" inputmode="decimal" value="${esc(d.peso != null ? String(d.peso).replace('.', ',') : '')}"></label>
      </section>

      <section class="cartao">
        <h2>Notas</h2>
        <textarea id="notas" rows="3" placeholder="Como correu o dia?">${esc(d.notas)}</textarea>
      </section>

      <div class="barra-guardar">
        <button class="botao botao-grande" id="guardar">Guardar dia</button>
      </div>`;
    ligarEventos();
    desenharTarefas();
  }

  // ---------- Ler o que está no ecrã para o estado "d" ----------
  function lerDoEcra() {
    $$('.refeicao', ecra).forEach((el) => {
      const r = d.refeicoes[el.dataset.r];
      r.hora = $('[data-campo=hora]', el).value;
      r.descricao = $('[data-campo=descricao]', el).value;
      const nomeExtra = $('[data-campo=nome]', el);
      if (nomeExtra) r.nome = nomeExtra.value;
    });
    $$('[data-a]', ecra).forEach((el) => {
      const a = d.atividades[el.dataset.a];
      a.categoria_id = $('[data-campo=categoria_id]', el).value;
      a.duracao_min = lerNumero($('[data-campo=duracao_min]', el).value);
    });
    d.sono_deitar = $('#sono-deitar', ecra).value;
    d.sono_acordar = $('#sono-acordar', ecra).value;
    if ($('#meditacao', ecra)) d.meditacao_min = lerNumero($('#meditacao', ecra).value);
    if ($('#leitura', ecra)) {
      d.leitura_min = lerNumero($('#leitura', ecra).value);
      d.leitura_livro = $('#livro', ecra).value;
    }
    d.peso = lerNumero($('#peso', ecra).value);
    d.notas = $('#notas', ecra).value;
  }

  function redesenhar() {
    const y = window.scrollY;
    lerDoEcra();
    desenhar();
    window.scrollTo(0, y);
  }

  async function novaCategoria(tipo) {
    const resp = await janela({
      titulo: { bebida: 'Nova bebida', atividade: 'Nova atividade', habito: 'Novo hábito' }[tipo],
      campos: [
        { id: 'nome', rotulo: 'Nome', obrigatorio: true },
        { id: 'cor', rotulo: 'Cor no calendário', tipo: 'cor', valor: CORES[estado.categorias.length % CORES.length] },
      ],
      botaoOk: 'Criar',
    });
    if (!resp?.nome?.trim()) return null;
    try {
      const nova = await db.criarCategoria({ tipo, nome: resp.nome, cor: resp.cor });
      await recarregarBase();
      return nova;
    } catch (erro) {
      mostrarErro(erro, erro.code === '23505' ? 'Já existe uma com esse nome' : 'Não foi possível criar');
      return null;
    }
  }

  // ---------- Tarefas deste dia ----------
  // Guardam-se logo ao tocar (não esperam pelo "Guardar dia").
  function desenharTarefas() {
    const caixa = $('#bloco-tarefas', ecra);
    caixa.innerHTML = `
      <div class="cartao-cabeca"><h2>Tarefas</h2><a class="botao botao-texto" href="#/tarefas">Ver todas</a></div>
      ${tarefasDia.length ? tarefasDia.map((t) => htmlTarefa(t, { comData: false })).join('')
        : '<p class="suave pequeno">Sem tarefas com data neste dia.</p>'}
      <div><button type="button" class="botao botao-texto" id="mais-tarefa">+ Tarefa para este dia</button></div>`;
    ligarTarefas(caixa, tarefasDia, desenharTarefas);
    $('#mais-tarefa', caixa).addEventListener('click', async () => {
      const resp = await janela({ titulo: 'Nova tarefa', campos: [{ id: 'titulo', rotulo: 'O que precisas de fazer?', obrigatorio: true }], botaoOk: 'Adicionar' });
      if (!resp?.titulo?.trim()) return;
      try {
        tarefasDia.push(await db.criarTarefa(estado.user.id, { titulo: resp.titulo, data }));
        desenharTarefas();
      } catch (erro) { mostrarErro(erro, 'Não foi possível adicionar'); }
    });
  }

  // ---------- Eventos ----------
  function ligarEventos() {
    ecra.addEventListener('input', () => marcar(), { once: true });

    $('#dia-anterior', ecra).addEventListener('click', () => mudarDia(somarDias(data, -1)));
    $('#dia-seguinte', ecra).addEventListener('click', () => mudarDia(somarDias(data, 1)));
    $('#escolher-data', ecra).addEventListener('change', (e) => e.target.value && mudarDia(e.target.value));

    // Refeições: categoria
    $$('.refeicao [data-categoria]', ecra).forEach((b) => b.addEventListener('click', () => {
      const r = d.refeicoes[b.closest('.refeicao').dataset.r];
      r.categoria = r.categoria === b.dataset.categoria ? null : b.dataset.categoria;
      $$('[data-categoria]', b.parentElement).forEach((x) => x.setAttribute('aria-pressed', x.dataset.categoria === r.categoria));
      marcar();
    }));
    $('#mais-extra', ecra).addEventListener('click', () => {
      lerDoEcra();
      const agora = new Date();
      d.refeicoes.push({ refeicao_tipo_id: null, nome: 'Extra', extra: true, descricao: '', categoria: null,
        hora: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}` });
      marcar();
      redesenhar();
    });
    $$('[data-remover-extra]', ecra).forEach((b) => b.addEventListener('click', () => {
      lerDoEcra();
      d.refeicoes.splice(Number(b.dataset.removerExtra), 1);
      marcar();
      redesenhar();
    }));
    $('#copiar-ontem', ecra).addEventListener('click', copiarDeOntem);

    // Atividades
    $('#mais-atividade', ecra).addEventListener('click', () => {
      lerDoEcra();
      d.atividades.push({ categoria_id: cats('atividade')[0]?.id, duracao_min: null, intensidade: 'moderada' });
      marcar();
      redesenhar();
    });
    $$('[data-remover-atividade]', ecra).forEach((b) => b.addEventListener('click', () => {
      lerDoEcra();
      d.atividades.splice(Number(b.dataset.removerAtividade), 1);
      marcar();
      redesenhar();
    }));
    $$('[data-intensidade]', ecra).forEach((b) => b.addEventListener('click', () => {
      const a = d.atividades[b.closest('[data-a]').dataset.a];
      a.intensidade = b.dataset.intensidade;
      $$('[data-intensidade]', b.parentElement).forEach((x) => x.setAttribute('aria-pressed', x === b));
      marcar();
    }));
    $$('[data-nova-cat]', ecra).forEach((b) => b.addEventListener('click', async () => {
      lerDoEcra();
      const tipo = b.dataset.novaCat;
      const nova = await novaCategoria(tipo);
      if (!nova) return;
      if (tipo === 'bebida') bebidaAtual = nova.id;
      else if (tipo === 'habito') d.habitos.add(nova.id);
      else if (tipo === 'atividade') d.atividades.push({ categoria_id: nova.id, duracao_min: null, intensidade: 'moderada' });
      marcar();
      redesenhar();
    }));

    // Outros hábitos: tocar liga/desliga
    $$('[data-habito]', ecra).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.habito;
      if (d.habitos.has(id)) d.habitos.delete(id); else d.habitos.add(id);
      b.setAttribute('aria-pressed', d.habitos.has(id));
      marcar();
    }));

    // Líquidos
    $$('[data-bebida]', ecra).forEach((b) => b.addEventListener('click', () => {
      bebidaAtual = b.dataset.bebida;
      $$('[data-bebida]', ecra).forEach((x) => x.setAttribute('aria-pressed', x === b));
    }));
    $$('[data-ml]', ecra).forEach((b) => b.addEventListener('click', async () => {
      if (!bebidaAtual) return aviso('Cria primeiro uma bebida em "+ Nova".', 'erro');
      let ml = Number(b.dataset.ml);
      if (b.dataset.ml === 'outro') {
        const resp = await janela({ titulo: 'Quantidade', campos: [{ id: 'ml', rotulo: 'Mililitros (ml)', tipo: 'number', obrigatorio: true }], botaoOk: 'Acrescentar' });
        ml = Math.round(lerNumero(resp?.ml));
        if (!ml || ml <= 0) return;
      }
      lerDoEcra();
      d.liquidos.push({ categoria_id: bebidaAtual, quantidade_ml: ml });
      marcar();
      redesenhar();
    }));
    $$('[data-remover-liquido]', ecra).forEach((b) => b.addEventListener('click', () => {
      lerDoEcra();
      d.liquidos.splice(Number(b.dataset.removerLiquido), 1);
      marcar();
      redesenhar();
    }));

    // Sono: atualiza as horas enquanto se escreve
    const atualizarSono = () => {
      const m = minutosSono($('#sono-deitar', ecra).value, $('#sono-acordar', ecra).value);
      $('#horas-sono', ecra).textContent = m ? duracao(m) : '';
    };
    $('#sono-deitar', ecra).addEventListener('input', atualizarSono);
    $('#sono-acordar', ecra).addEventListener('input', atualizarSono);
    $$('[data-qualidade]', ecra).forEach((b) => b.addEventListener('click', () => {
      d.sono_qualidade = d.sono_qualidade === b.dataset.qualidade ? null : b.dataset.qualidade;
      $$('[data-qualidade]', ecra).forEach((x) => x.setAttribute('aria-pressed', x.dataset.qualidade === d.sono_qualidade));
      marcar();
    }));

    $$('[data-meditacao]', ecra).forEach((b) => b.addEventListener('click', () => {
      $('#meditacao', ecra).value = b.dataset.meditacao;
      marcar();
    }));

    $('#guardar', ecra).addEventListener('click', guardar);
  }

  async function mudarDia(novaData) {
    if (alterado) {
      const sair = await janela({
        titulo: 'Tens alterações por guardar',
        texto: 'Se mudares de dia agora, perdes o que escreveste neste dia.',
        botaoOk: 'Mudar sem guardar', perigo: true,
      });
      if (!sair) return;
    }
    ir(`#/registar/${novaData}`);
  }

  async function copiarDeOntem() {
    try {
      const ontem = await db.carregarDia(somarDias(data, -1));
      if (!ontem) return aviso('Ontem não tem registo para copiar.', 'erro');
      lerDoEcra();
      const deOntem = montarRefeicoes(ontem.refeicoes_dia || []);
      d.refeicoes = deOntem;
      d.liquidos = (ontem.liquidos_dia || []).map(({ categoria_id, quantidade_ml }) => ({ categoria_id, quantidade_ml }));
      d.habitos = new Set((ontem.habitos_dia || []).map((h) => h.categoria_id));
      marcar();
      redesenhar();
      aviso('Copiado de ontem. Revê e guarda.');
    } catch (erro) {
      mostrarErro(erro, 'Não foi possível ler o dia de ontem');
    }
  }

  async function guardar(e) {
    lerDoEcra();

    // Só se guardam as refeições com alguma coisa escrita ou escolhida.
    const refeicoes = d.refeicoes.filter((r) => r.descricao.trim() || r.categoria);
    const semCategoria = refeicoes.find((r) => !r.categoria);
    if (semCategoria) return aviso(`Escolhe a categoria de "${semCategoria.nome}".`, 'erro');

    const botao = e.target;
    botao.disabled = true;
    botao.textContent = 'A guardar…';
    try {
      await db.guardarDia(estado.user.id, data, {
        campos: {
          sono_deitar: d.sono_deitar || null,
          sono_acordar: d.sono_acordar || null,
          sono_qualidade: d.sono_qualidade,
          meditacao_min: d.meditacao_min,
          leitura_min: d.leitura_min,
          leitura_livro: d.leitura_livro.trim() || null,
          peso: d.peso,
          notas: d.notas.trim() || null,
        },
        refeicoes: refeicoes.map((r) => ({
          refeicao_tipo_id: r.refeicao_tipo_id,
          nome: r.nome.trim() || 'Extra',
          hora: r.hora || null,
          descricao: r.descricao.trim() || null,
          categoria: r.categoria,
        })),
        atividades: d.atividades.filter((a) => a.categoria_id).map((a) => ({
          categoria_id: a.categoria_id,
          duracao_min: a.duracao_min > 0 ? Math.round(a.duracao_min) : null,
          intensidade: a.intensidade || null,
        })),
        liquidos: d.liquidos.map((l) => ({ categoria_id: l.categoria_id, quantidade_ml: l.quantidade_ml })),
        habitos: [...d.habitos].map((id) => ({ categoria_id: id })),
      });
      alterado = false;
      ui.sujo = false;
      aviso('Dia guardado');
      botao.textContent = 'Guardado ✓';
      setTimeout(() => { botao.textContent = 'Guardar dia'; botao.disabled = false; }, 1500);
    } catch (erro) {
      botao.disabled = false;
      botao.textContent = 'Guardar dia';
      mostrarErro(erro);
    }
  }

  desenhar();
}
