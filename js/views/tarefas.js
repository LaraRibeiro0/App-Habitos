// =====================================================================
//  Tarefas (to-do list)
//  Estados: Por fazer → A fazer → Feita / Não feita.
//  A data é opcional; as tarefas com data aparecem também no registo
//  desse dia e no calendário.
// =====================================================================
import { estado, ui } from '../app.js';
import * as db from '../data.js';
import { $, $$, esc, hoje, somarDias, dataCurta, janela, aviso, mostrarErro } from '../util.js';

export const ESTADOS = [
  { valor: 'por_fazer', rotulo: 'Por fazer' },
  { valor: 'a_fazer', rotulo: 'A fazer' },
  { valor: 'feita', rotulo: 'Feita' },
  { valor: 'nao_feita', rotulo: 'Não feita' },
];
const EM_ABERTO = ['por_fazer', 'a_fazer'];

// "Hoje", "Amanhã", "Atrasada · 20/11" ou a data
function rotuloData(t) {
  if (!t.data) return '';
  const hj = hoje();
  const atrasada = t.data < hj && EM_ABERTO.includes(t.estado);
  const texto = t.data === hj ? 'Hoje' : t.data === somarDias(hj, 1) ? 'Amanhã' : dataCurta(t.data);
  return `<span class="tarefa-data ${atrasada ? 'atrasada' : ''}">${atrasada ? 'Atrasada · ' : ''}${texto}</span>`;
}

// Uma tarefa: título (toca para editar), data, botões de estado e apagar.
export function htmlTarefa(t, { comData = true } = {}) {
  return `
    <div class="tarefa estado-${t.estado}" data-tarefa="${t.id}">
      <div class="tarefa-cabeca">
        <button type="button" class="tarefa-titulo" data-editar-tarefa="${t.id}">${esc(t.titulo)}</button>
        <button type="button" class="botao-icone" data-apagar-tarefa="${t.id}" aria-label="Apagar tarefa">✕</button>
      </div>
      ${(comData && t.data) || t.notas ? `<div class="tarefa-meta">${comData ? rotuloData(t) : ''}${t.notas ? `<span class="suave">${esc(t.notas)}</span>` : ''}</div>` : ''}
      <div class="segmentos segmentos-tarefa" role="group" aria-label="Estado de ${esc(t.titulo)}">
        ${ESTADOS.map((e) => `<button type="button" class="est-${e.valor}" data-estado="${e.valor}" aria-pressed="${t.estado === e.valor}">${e.rotulo}</button>`).join('')}
      </div>
    </div>`;
}

// Liga os botões das tarefas desenhadas dentro de "raiz".
//   tarefas: a lista (é atualizada aqui)   depois: redesenhar
export function ligarTarefas(raiz, tarefas, depois) {
  const porId = (id) => tarefas.find((t) => t.id === id);

  $$('[data-estado]', raiz).forEach((b) => b.addEventListener('click', async () => {
    const t = porId(b.closest('[data-tarefa]').dataset.tarefa);
    if (t.estado === b.dataset.estado) return;
    try {
      Object.assign(t, await db.atualizarTarefa(t.id, { estado: b.dataset.estado }));
      depois();
    } catch (erro) { mostrarErro(erro); }
  }));

  $$('[data-editar-tarefa]', raiz).forEach((b) => b.addEventListener('click', async () => {
    const t = porId(b.dataset.editarTarefa);
    const resp = await janela({
      titulo: 'Editar tarefa',
      campos: [
        { id: 'titulo', rotulo: 'Tarefa', valor: t.titulo, obrigatorio: true },
        { id: 'data', rotulo: 'Data (opcional)', tipo: 'date', valor: t.data || '' },
        { id: 'notas', rotulo: 'Notas (opcional)', valor: t.notas || '' },
      ],
    });
    if (!resp?.titulo?.trim()) return;
    try {
      Object.assign(t, await db.atualizarTarefa(t.id, {
        titulo: resp.titulo.trim(), data: resp.data || null, notas: resp.notas.trim() || null,
      }));
      depois();
    } catch (erro) { mostrarErro(erro); }
  }));

  $$('[data-apagar-tarefa]', raiz).forEach((b) => b.addEventListener('click', async () => {
    const t = porId(b.dataset.apagarTarefa);
    const sim = await janela({ titulo: 'Apagar tarefa?', texto: t.titulo, botaoOk: 'Apagar', perigo: true });
    if (!sim) return;
    try {
      await db.apagarTarefa(t.id);
      tarefas.splice(tarefas.indexOf(t), 1);
      depois();
    } catch (erro) { mostrarErro(erro, 'Não foi possível apagar'); }
  }));
}

// Ordem: com data primeiro (mais próxima primeiro), depois sem data, por criação.
function ordenarPorData(a, b) {
  if (a.data && b.data && a.data !== b.data) return a.data < b.data ? -1 : 1;
  if (a.data && !b.data) return -1;
  if (!a.data && b.data) return 1;
  return a.criado_em < b.criado_em ? -1 : 1;
}

const CHAVE_FILTRO = 'filtro-tarefas';

export async function mostrar(ecra, params, aindaAtual) {
  const tarefas = await db.listarTarefas();
  if (!aindaAtual()) return;

  let filtro = 'abertas';
  try { filtro = localStorage.getItem(CHAVE_FILTRO) || 'abertas'; } catch { /* sem armazenamento */ }

  const FILTROS = [
    { chave: 'abertas', rotulo: 'Em aberto', teste: (t) => EM_ABERTO.includes(t.estado) },
    { chave: 'feita', rotulo: 'Feitas', teste: (t) => t.estado === 'feita' },
    { chave: 'nao_feita', rotulo: 'Não feitas', teste: (t) => t.estado === 'nao_feita' },
    { chave: 'todas', rotulo: 'Todas', teste: () => true },
  ];

  function grupo(titulo, lista) {
    if (!lista.length) return '';
    return `<section class="cartao">
      <div class="cartao-cabeca"><h2>${titulo}</h2><span class="suave pequeno">${lista.length}</span></div>
      ${lista.map((t) => htmlTarefa(t)).join('')}
    </section>`;
  }

  function desenhar() {
    const f = FILTROS.find((x) => x.chave === filtro) || FILTROS[0];
    const visiveis = tarefas.filter(f.teste);
    let corpo;
    if (filtro === 'abertas') {
      corpo = grupo('A fazer', visiveis.filter((t) => t.estado === 'a_fazer').sort(ordenarPorData))
        + grupo('Por fazer', visiveis.filter((t) => t.estado === 'por_fazer').sort(ordenarPorData));
    } else {
      // Feitas / não feitas: as mais recentes primeiro
      corpo = grupo(f.rotulo, [...visiveis].sort((a, b) => (a.atualizado_em < b.atualizado_em ? 1 : -1)));
    }
    if (!visiveis.length) {
      corpo = `<div class="cartao"><p class="suave">${filtro === 'abertas'
        ? 'Não tens tarefas em aberto. Escreve acima o que precisas de fazer.'
        : 'Nada por aqui.'}</p></div>`;
    }

    ecra.innerHTML = `
      <h1>Tarefas</h1>
      <form class="cartao" id="nova-tarefa">
        <label class="campo"><span>O que precisas de fazer?</span>
          <input id="titulo" maxlength="200" placeholder="Ex.: marcar consulta, comprar creatina" required></label>
        <div class="linha-campos">
          <label class="campo"><span>Data (opcional)</span><input type="date" id="data"></label>
          <button class="botao" type="submit" style="align-self:end">Adicionar</button>
        </div>
      </form>
      <div class="fichas" role="group" aria-label="Mostrar">
        ${FILTROS.map((x) => `<button type="button" class="ficha" data-filtro="${x.chave}" aria-pressed="${x.chave === filtro}">
          ${x.rotulo} <span class="suave">${tarefas.filter(x.teste).length}</span></button>`).join('')}
      </div>
      ${corpo}`;

    $('#nova-tarefa', ecra).addEventListener('submit', async (e) => {
      e.preventDefault();
      const titulo = $('#titulo', ecra).value;
      if (!titulo.trim()) return;
      e.submitter.disabled = true;
      try {
        tarefas.push(await db.criarTarefa(estado.user.id, { titulo, data: $('#data', ecra).value }));
        ui.sujo = false;
        if (filtro !== 'abertas' && filtro !== 'todas') filtro = 'abertas';
        aviso('Tarefa adicionada');
        desenhar();
        $('#titulo', ecra).focus();
      } catch (erro) {
        e.submitter.disabled = false;
        mostrarErro(erro, 'Não foi possível adicionar');
      }
    });
    $$('[data-filtro]', ecra).forEach((b) => b.addEventListener('click', () => {
      filtro = b.dataset.filtro;
      try { localStorage.setItem(CHAVE_FILTRO, filtro); } catch { /* sem armazenamento */ }
      desenhar();
    }));
    ligarTarefas(ecra, tarefas, () => { ui.sujo = false; desenhar(); });
  }

  desenhar();
}
