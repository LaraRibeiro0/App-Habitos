// =====================================================================
//  Funções auxiliares usadas em toda a app: datas, formatação,
//  ecrã, mensagens e janelas.
// =====================================================================

// ---------- Datas ----------
// Trabalhamos sempre com datas no formato 'AAAA-MM-DD' (como o PostgreSQL),
// calculadas na hora LOCAL. Nunca usar toISOString() para isto: converte
// para UTC e, perto da meia-noite, pode dar o dia errado.

export function iso(d) {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${dia}`;
}

export function deIso(s) {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function hoje() {
  return iso(new Date());
}

export function somarDias(s, n) {
  const d = deIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

// Diferença em dias entre duas datas ISO (b - a).
export function diasEntre(a, b) {
  return Math.round((deIso(b) - deIso(a)) / 86400000);
}

// Segunda-feira da semana de uma data (a semana em Portugal começa à 2.ª).
export function inicioSemana(s) {
  const d = deIso(s);
  const diaSemana = (d.getDay() + 6) % 7; // 0 = segunda … 6 = domingo
  d.setDate(d.getDate() - diaSemana);
  return iso(d);
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function nomeMes(m) { return MESES[m]; }

// "sábado, 21 de novembro"
export function dataLonga(s) {
  const d = deIso(s);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

// "21/11/2026"
export function dataCurta(s) {
  if (!s) return '';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

// ---------- Horas e sono ----------
// 'HH:MM' ou 'HH:MM:SS' → minutos desde a meia-noite
export function minutosDe(hora) {
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// Minutos → 'HH:MM' (para preencher <input type="time">)
export function horaDe(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// Minutos dormidos entre deitar e acordar. Se acordar for "antes" de
// deitar (ex.: 23:30 → 06:30), a noite passou a meia-noite: somamos 24h.
export function minutosSono(deitar, acordar) {
  const a = minutosDe(deitar);
  const b = minutosDe(acordar);
  if (a == null || b == null) return null;
  let dif = b - a;
  if (dif <= 0) dif += 24 * 60;
  return dif;
}

// 450 → "7h30"; 420 → "7h"
export function duracao(min) {
  if (min == null || isNaN(min)) return '—';
  const sinal = min < 0 ? '-' : '';
  const t = Math.abs(Math.round(min));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${sinal}${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

// ---------- Números ----------
export function num(v, casas = 1) {
  if (v == null || v === '' || isNaN(v)) return '—';
  return Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

// Lê um campo de formulário como número (aceita vírgula). Vazio → null.
export function lerNumero(texto) {
  if (texto == null) return null;
  const t = String(texto).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

// ---------- Ecrã ----------
// Escapa texto antes de o pôr em HTML (evita que "<" no texto de um
// utilizador seja interpretado como código).
export function esc(t) {
  return String(t ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// Mensagem curta no fundo do ecrã ("Dia guardado").
export function aviso(texto, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.textContent = texto;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('visivel'));
  setTimeout(() => {
    el.classList.remove('visivel');
    setTimeout(() => el.remove(), 300);
  }, tipo === 'erro' ? 5000 : 2200);
}

// Janela (modal) simples. Devolve uma Promise com o resultado.
//   campos: [{ id, rotulo, tipo, valor, opcoes }]
export function janela({ titulo, texto = '', campos = [], botaoOk = 'Guardar', perigo = false }) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'janela-fundo';
    fundo.innerHTML = `
      <form class="janela" role="dialog" aria-modal="true" aria-labelledby="janela-titulo">
        <h2 id="janela-titulo">${esc(titulo)}</h2>
        ${texto ? `<p class="suave">${esc(texto)}</p>` : ''}
        ${campos.map((c) => `
          <label class="campo">
            <span>${esc(c.rotulo)}</span>
            ${c.tipo === 'cor'
              ? `<input type="color" name="${c.id}" value="${esc(c.valor ?? '#4f7cff')}">`
              : `<input type="${c.tipo || 'text'}" name="${c.id}" value="${esc(c.valor ?? '')}" ${c.obrigatorio ? 'required' : ''}>`}
          </label>`).join('')}
        <div class="janela-botoes">
          <button type="button" class="botao botao-sec" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="botao ${perigo ? 'botao-perigo' : ''}">${esc(botaoOk)}</button>
        </div>
      </form>`;
    document.body.append(fundo);
    const form = fundo.querySelector('form');
    const primeiro = form.querySelector('input');
    (primeiro || form.querySelector('[type=submit]')).focus();

    const fechar = (valor) => { fundo.remove(); resolve(valor); };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(form));
      fechar(campos.length ? dados : true);
    });
    fundo.querySelector('[data-acao=cancelar]').addEventListener('click', () => fechar(null));
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(null); });
    fundo.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(null); });
  });
}

// Mostra um erro do Supabase de forma legível e regista-o na consola.
export function mostrarErro(erro, contexto = 'Não foi possível guardar') {
  console.error(contexto, erro);
  const detalhe = erro?.message ? `: ${erro.message}` : '.';
  aviso(`${contexto}${detalhe}`, 'erro');
}

// Cores sugeridas para novas categorias (bem distintas entre si).
export const CORES = ['#3d7bf2', '#16a39a', '#e0732f', '#9b5de5', '#d63c6b',
  '#2f9e44', '#c79100', '#0b7285', '#e8590c', '#5c7cfa'];
