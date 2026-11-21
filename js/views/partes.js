// =====================================================================
//  Pedaços de ecrã usados em mais do que um sítio
//  (configuração inicial e definições).
// =====================================================================
import { esc, duracao, horaDe, minutosDe, $$ } from '../util.js';

export const SUGESTOES_ATIVIDADES = ['CrossFit', 'Ginásio', 'Corrida', 'Caminhada', 'Bicicleta',
  'Natação', 'Pilates', 'Yoga', 'Dança', 'Ginástica'];
export const SUGESTOES_BEBIDAS = ['Água', 'Chá', 'Café', 'Leite', 'Sumo', 'Refrigerante', 'Bebida alcoólica'];
export const REFEICOES_PADRAO = [
  { nome: 'Pequeno-almoço', hora: '07:30' },
  { nome: 'Lanche da manhã', hora: '10:30' },
  { nome: 'Almoço', hora: '13:00' },
  { nome: 'Lanche da tarde', hora: '16:30' },
  { nome: 'Jantar', hora: '20:00' },
];

// <select> com durações de 30 em 30 minutos (4h a 11h).
export function seletorHoras(id, valorMin) {
  const opcoes = [];
  for (let m = 240; m <= 660; m += 30) {
    opcoes.push(`<option value="${m}" ${m === valorMin ? 'selected' : ''}>${duracao(m)}</option>`);
  }
  return `<select id="${id}">${opcoes.join('')}</select>`;
}

// Lista editável das refeições habituais (nome + hora + remover).
export function htmlRefeicoes(lista) {
  return `
    <div class="lista-edit" id="lista-refeicoes">
      ${lista.map((r, i) => `
        <div class="lista-edit-linha" data-i="${i}" data-id="${esc(r.id || '')}">
          <input type="text" class="r-nome" value="${esc(r.nome)}" aria-label="Nome da refeição" required>
          <input type="time" class="r-hora" value="${esc((r.hora || '').slice(0, 5))}" aria-label="Hora habitual">
          <button type="button" class="botao-icone" data-remover-refeicao="${i}" aria-label="Remover ${esc(r.nome)}">✕</button>
        </div>`).join('')}
    </div>
    <button type="button" class="botao botao-sec" id="mais-refeicao">+ Adicionar refeição</button>`;
}

// Lê do ecrã a lista de refeições tal como está escrita.
export function lerRefeicoes(raiz) {
  return $$('.lista-edit-linha', raiz).map((linha) => ({
    id: linha.dataset.id || undefined,
    nome: linha.querySelector('.r-nome').value.trim(),
    hora: linha.querySelector('.r-hora').value || null,
  })).filter((r) => r.nome);
}

// Fichas para escolher atividades ou bebidas.
//   escolhidas: Set de nomes   extra: nomes criados pela pessoa
export function htmlFichasEscolha(tipo, sugestoes, escolhidas) {
  const todas = [...new Set([...sugestoes, ...escolhidas])];
  return `
    <div class="fichas" data-fichas="${tipo}">
      ${todas.map((nome) => `
        <button type="button" class="ficha" data-nome="${esc(nome)}" aria-pressed="${escolhidas.has(nome)}">${esc(nome)}</button>`).join('')}
      <button type="button" class="ficha ficha-nova" data-nova="${tipo}">+ Nova</button>
    </div>`;
}

export { horaDe, minutosDe };
