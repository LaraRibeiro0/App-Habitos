// =====================================================================
//  Calendário mensal com filtros.
//  Endereço: #/calendario (mês atual) ou #/calendario/2026-11
// =====================================================================
import { estado, ir } from '../app.js';
import * as db from '../data.js';
import * as st from '../stats.js';
import { $, $$, esc, iso, hoje, nomeMes } from '../util.js';

const CHAVE_FILTROS = 'filtros-calendario';

// Cada filtro: uma chave, um nome, uma cor e um teste "o dia tem isto?".
function listaFiltros(perfil) {
  const filtros = estado.categorias
    .filter((c) => c.tipo === 'atividade' && !c.arquivada)
    .map((c) => ({
      chave: `a:${c.id}`, nome: c.nome, cor: c.cor,
      teste: (d) => (d.atividades_dia || []).some((a) => a.categoria_id === c.id),
    }));
  for (const c of estado.categorias.filter((x) => x.tipo === 'habito' && !x.arquivada)) {
    filtros.push({
      chave: `h:${c.id}`, nome: c.nome, cor: c.cor,
      teste: (d) => (d.habitos_dia || []).some((h) => h.categoria_id === c.id),
    });
  }
  filtros.push(
    { chave: 'plano', nome: 'Dia dentro do plano', cor: 'var(--plano)', teste: st.diaDentroDoPlano },
    { chave: 'livre', nome: 'Refeição livre', cor: 'var(--livre)', teste: st.temRefeicaoLivre },
  );
  if (perfil.acompanha_meditacao) filtros.push({ chave: 'meditacao', nome: 'Meditação', cor: '#8e6fd8', teste: (d) => d.meditacao_min > 0 });
  if (perfil.acompanha_leitura) filtros.push({ chave: 'leitura', nome: 'Leitura', cor: '#0b8a9e', teste: (d) => d.leitura_min > 0 });
  filtros.push({ chave: 'pesagem', nome: 'Pesagem', cor: '#7d8a83', teste: (d) => d.peso != null });
  if (perfil.sono_objetivo_min) {
    filtros.push({
      chave: 'sono', nome: 'Sono abaixo do objetivo', cor: '#c2410c',
      teste: (d) => { const m = st.sonoDoDia(d); return m != null && m < perfil.sono_objetivo_min; },
    });
  }
  return filtros;
}

function lerFiltrosGuardados() {
  try { return JSON.parse(localStorage.getItem(CHAVE_FILTROS)); } catch { return null; }
}
function guardarFiltros(ativos) {
  try { localStorage.setItem(CHAVE_FILTROS, JSON.stringify([...ativos])); } catch { /* sem armazenamento */ }
}

export async function mostrar(ecra, params, aindaAtual) {
  const hj = hoje();
  const [ano, mes] = /^\d{4}-\d{2}$/.test(params[0] || '')
    ? params[0].split('-').map(Number)
    : [Number(hj.slice(0, 4)), Number(hj.slice(5, 7))];

  const primeiro = new Date(ano, mes - 1, 1);
  const ultimo = new Date(ano, mes, 0);
  const [dias, tarefas] = await Promise.all([
    db.carregarPeriodo(iso(primeiro), iso(ultimo)),
    db.tarefasEntre(iso(primeiro), iso(ultimo)),
  ]);
  if (!aindaAtual()) return;

  const porData = new Map(dias.map((d) => [d.data, d]));
  const filtros = listaFiltros(estado.perfil);
  // As tarefas não dependem do registo do dia: o teste recebe também a data.
  const tarefasDe = (data) => tarefas.filter((t) => t.data === data);
  filtros.push(
    { chave: 'tarefa-feita', nome: 'Tarefas feitas', cor: '#2f9e44', semDia: true, teste: (_d, data) => tarefasDe(data).some((t) => t.estado === 'feita') },
    { chave: 'tarefa-aberta', nome: 'Tarefas por fazer', cor: '#5c7cfa', semDia: true, teste: (_d, data) => tarefasDe(data).some((t) => t.estado === 'por_fazer' || t.estado === 'a_fazer') },
  );
  // Um filtro "normal" só se aplica a dias com registo
  const aplica = (f, d, data) => (f.semDia ? f.teste(d, data) : Boolean(d) && f.teste(d, data));
  const guardados = lerFiltrosGuardados();
  const ativos = new Set(guardados
    ? guardados.filter((k) => filtros.some((f) => f.chave === k))
    : filtros.filter((f) => f.chave.startsWith('a:') || f.chave.startsWith('h:') || f.chave === 'livre').map((f) => f.chave));

  const mesAnt = new Date(ano, mes - 2, 1);
  const mesSeg = new Date(ano, mes, 1);
  const chaveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const ehMesAtual = chaveMes(primeiro) === hj.slice(0, 7);

  function desenhar() {
    const selecionados = filtros.filter((f) => ativos.has(f.chave));
    const vazios = (primeiro.getDay() + 6) % 7; // dias antes do dia 1 (semana começa à segunda)

    const celulas = [];
    for (let i = 0; i < vazios; i++) celulas.push('<span class="cal-dia vazio" aria-hidden="true"></span>');
    for (let n = 1; n <= ultimo.getDate(); n++) {
      const data = iso(new Date(ano, mes - 1, n));
      const d = porData.get(data);
      const pontos = selecionados.filter((f) => aplica(f, d, data));
      const classes = ['cal-dia', d && 'com-registo', data === hj && 'hoje', data > hj && 'futuro'].filter(Boolean).join(' ');
      celulas.push(`
        <button class="${classes}" data-data="${data}" ${data > hj ? 'disabled' : ''}
          aria-label="${n}${pontos.length ? ': ' + pontos.map((p) => p.nome).join(', ') : ''}">
          <span>${n}</span>
          <span class="cal-pontos">${pontos.map((p) => `<i style="background:${esc(p.cor)}"></i>`).join('')}</span>
        </button>`);
    }

    ecra.innerHTML = `
      <div class="cartao">
        <div class="cal-cabeca">
          <button class="botao-icone" id="mes-ant" aria-label="Mês anterior">‹</button>
          <h2>${nomeMes(mes - 1)} ${ano}</h2>
          <button class="botao-icone" id="mes-seg" aria-label="Mês seguinte" ${ehMesAtual ? 'disabled style="visibility:hidden"' : ''}>›</button>
        </div>
        <div class="cal-grelha">
          ${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((l) => `<span class="cal-semana">${l}</span>`).join('')}
          ${celulas.join('')}
        </div>
      </div>

      <div class="cartao">
        <span class="rotulo">Mostrar no calendário</span>
        <div class="fichas">
          ${filtros.map((f) => `<button type="button" class="ficha" data-filtro="${esc(f.chave)}" aria-pressed="${ativos.has(f.chave)}">
            <span class="ponto" style="background:${esc(f.cor)}"></span>${esc(f.nome)}</button>`).join('')}
        </div>
        ${selecionados.length ? `<div class="contagens">
          ${selecionados.map((f) => {
            let n = 0;
            for (let k = 1; k <= ultimo.getDate(); k++) {
              const data = iso(new Date(ano, mes - 1, k));
              if (aplica(f, porData.get(data), data)) n++;
            }
            return `<div class="contagem"><span><span class="ponto" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:${esc(f.cor)}"></span>${esc(f.nome)}</span><strong>${n} ${n === 1 ? 'dia' : 'dias'}</strong></div>`;
          }).join('')}
        </div>` : '<p class="suave pequeno">Escolhe um ou mais filtros para veres os dias no calendário.</p>'}
      </div>`;

    $('#mes-ant', ecra).addEventListener('click', () => ir(`#/calendario/${chaveMes(mesAnt)}`));
    $('#mes-seg', ecra).addEventListener('click', () => ir(`#/calendario/${chaveMes(mesSeg)}`));
    $$('[data-data]', ecra).forEach((b) => b.addEventListener('click', () => ir(`#/registar/${b.dataset.data}`)));
    $$('[data-filtro]', ecra).forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.filtro;
      if (ativos.has(k)) ativos.delete(k); else ativos.add(k);
      guardarFiltros(ativos);
      desenhar();
    }));
  }

  desenhar();
}
