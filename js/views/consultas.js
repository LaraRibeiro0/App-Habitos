// =====================================================================
//  Consultas com nutricionista.
//    #/consultas        → resumo do período + tabela das consultas
//    #/consultas/nova   → formulário para uma consulta nova
//    #/consultas/<id>   → editar uma consulta
// =====================================================================
import { estado, recarregarBase, ir } from '../app.js';
import * as db from '../data.js';
import * as st from '../stats.js';
import { $, $$, esc, hoje, dataCurta, diasEntre, duracao, num, lerNumero, janela, aviso, mostrarErro } from '../util.js';

// Colunas da tabela: campo, título, unidade, e se descer é "bom".
const MEDIDAS = [
  { campo: 'peso', titulo: 'Peso', un: 'kg', baixarEBom: true },
  { campo: 'imc', titulo: 'IMC', un: '', baixarEBom: true },
  { campo: 'massa_gorda_pct', titulo: 'M. gorda', un: '%', baixarEBom: true },
  { campo: 'massa_muscular_kg', titulo: 'M. muscular', un: 'kg', baixarEBom: false },
  { campo: 'gordura_visceral', titulo: 'G. visceral', un: '', baixarEBom: true },
  { campo: 'cintura_cm', titulo: 'Cintura', un: 'cm', baixarEBom: true },
  { campo: 'anca_cm', titulo: 'Anca', un: 'cm', baixarEBom: true },
];

function celulaDif(atual, anterior, baixarEBom, un) {
  if (atual == null) return '<td>—</td>';
  let dif = '';
  if (anterior != null) {
    const d = Number(atual) - Number(anterior);
    if (Math.abs(d) >= 0.05) {
      const bom = baixarEBom ? d < 0 : d > 0;
      dif = `<span class="dif ${bom ? 'variacao-baixa' : 'variacao-sobe'}">${d > 0 ? '+' : ''}${num(d)}${un ? ' ' + un : ''}</span>`;
    }
  }
  return `<td>${num(atual)}${dif}</td>`;
}

export async function mostrar(ecra, params, aindaAtual) {
  const perfil = estado.perfil;

  if (!perfil.tem_nutricionista) {
    ecra.innerHTML = `
      <div class="cartao">
        <h1>Consultas</h1>
        <p class="suave">Se tens acompanhamento com nutricionista, regista aqui os resultados de cada consulta.
          A app mostra a evolução e um resumo dos teus hábitos entre consultas, para levares à próxima.</p>
        <button class="botao" id="ativar">Registar consulta com nutricionista</button>
      </div>`;
    $('#ativar', ecra).addEventListener('click', async () => {
      try {
        await db.guardarPerfil(estado.user.id, { tem_nutricionista: true });
        await recarregarBase();
        ir('#/consultas/nova');
      } catch (erro) { mostrarErro(erro); }
    });
    return;
  }

  const consultas = await db.listarConsultas(); // mais recente primeiro
  if (!aindaAtual()) return;

  if (params[0]) return mostrarFormulario(ecra, consultas, params[0]);

  // ---------- Períodos entre consultas ----------
  // Atual: desde a última consulta até à próxima marcada (ou hoje).
  const hj = hoje();
  const periodos = consultas.map((c, i) => {
    const seguinte = consultas[i - 1]; // a consulta que veio depois desta
    return {
      de: c.data,
      ate: seguinte ? seguinte.data : hj,
      atual: i === 0,
      proxima: i === 0 ? c.proxima_data : null,
    };
  }).filter((p) => p.de <= hj);

  let escolhido = 0;

  async function desenharResumo() {
    const caixa = $('#resumo', ecra);
    const p = periodos[escolhido];
    if (!p) { caixa.innerHTML = '<p class="suave pequeno">Regista a primeira consulta para veres aqui o resumo do período.</p>'; return; }
    caixa.innerHTML = '<p class="suave pequeno">A calcular…</p>';
    const dias = await db.carregarPeriodo(p.de, p.ate);
    const n = Math.max(diasEntre(p.de, p.ate), 1);
    const r = st.resumo(dias, perfil, n);
    const ref = r.refeicoes;
    const pct = (x) => (ref.total ? Math.round((x / ref.total) * 100) : 0);
    const atividades = Object.entries(r.porAtividade)
      .map(([id, v]) => ({ nome: estado.categorias.find((c) => c.id === id)?.nome || 'Atividade', ...v }))
      .sort((a, b) => b.vezes - a.vezes);
    const varPeso = r.pesoInicio && r.pesoFim && r.pesoInicio.data !== r.pesoFim.data
      ? r.pesoFim.peso - r.pesoInicio.peso : null;
    const faltam = p.proxima ? diasEntre(hj, p.proxima) : null;

    caixa.innerHTML = `
      <p class="suave pequeno">${dataCurta(p.de)} → ${p.atual ? 'hoje' : dataCurta(p.ate)} · ${r.diasRegistados} de ${n} dias registados
        ${faltam != null && faltam >= 0 ? ` · próxima consulta ${faltam === 0 ? 'hoje' : `daqui a ${faltam} dias (${dataCurta(p.proxima)})`}` : ''}</p>
      <div class="contagens">
        <div class="contagem"><span>Treinos por semana</span><strong>${num(r.treinosPorSemana)}</strong></div>
        ${atividades.map((a) => `<div class="contagem suave"><span>· ${esc(a.nome)}</span><span>${a.vezes}× ${a.minutos ? `· ${duracao(a.minutos)}` : ''}</span></div>`).join('')}
        <div class="contagem"><span>Refeições dentro do plano</span><strong>${ref.total ? pct(ref.plano) + '%' : '—'}</strong></div>
        ${ref.total ? `<div class="contagem suave"><span>· parcialmente / livres</span><span>${pct(ref.parcial)}% / ${pct(ref.livre)}%</span></div>` : ''}
        <div class="contagem"><span>Sono médio por noite</span><strong>${duracao(r.sonoMedio)}</strong></div>
        <div class="contagem"><span>Líquidos por dia</span><strong>${r.liquidosMedio != null ? num(r.liquidosMedio / 1000, 2) + ' L' : '—'}</strong></div>
        ${perfil.acompanha_meditacao ? `<div class="contagem"><span>Meditação</span><strong>${num(r.meditacaoPorSemana)} dias/semana</strong></div>` : ''}
        ${perfil.acompanha_leitura ? `<div class="contagem"><span>Leitura</span><strong>${num(r.leituraPorSemana)} dias/semana</strong></div>` : ''}
        <div class="contagem"><span>Peso (pesagens em casa)</span><strong>${varPeso != null ? `${varPeso > 0 ? '+' : ''}${num(varPeso)} kg` : '—'}</strong></div>
      </div>`;
  }

  // Medidas extra: uma coluna por cada nome usado
  const extras = [...new Set(consultas.flatMap((c) => (c.medidas_extra || []).map((m) => m.nome)))];
  const valorExtra = (c, nome) => (c?.medidas_extra || []).find((m) => m.nome === nome)?.valor ?? null;

  ecra.innerHTML = `
    <div class="cartao-cabeca"><h1>Consultas</h1>
      <a class="botao" href="#/consultas/nova">+ Nova consulta</a></div>

    <section class="cartao">
      <div class="cartao-cabeca"><h2>Resumo do período</h2>
        ${periodos.length > 1 ? `<select id="periodo" style="width:auto" aria-label="Período">
          ${periodos.map((p, i) => `<option value="${i}">${p.atual ? 'Atual' : `${dataCurta(p.de).slice(0, 5)} → ${dataCurta(p.ate).slice(0, 5)}`}</option>`).join('')}
        </select>` : ''}</div>
      <div id="resumo"></div>
    </section>

    <section class="cartao">
      <h2>Resultados</h2>
      ${consultas.length ? `
      <div class="tabela-rolar">
        <table>
          <thead><tr><th>Data</th>${MEDIDAS.map((m) => `<th>${m.titulo}${m.un ? ` (${m.un})` : ''}</th>`).join('')}
            ${extras.map((e) => `<th>${esc(e)}</th>`).join('')}</tr></thead>
          <tbody>
            ${consultas.map((c, i) => {
              const ant = consultas[i + 1];
              return `<tr class="clicavel" data-id="${c.id}" tabindex="0">
                <td>${dataCurta(c.data)}</td>
                ${MEDIDAS.map((m) => celulaDif(c[m.campo], ant?.[m.campo], m.baixarEBom, m.un)).join('')}
                ${extras.map((e) => celulaDif(valorExtra(c, e), valorExtra(ant, e), true, '')).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p class="suave pequeno">Toca numa linha para a editar. A verde, as variações no bom sentido.</p>`
      : '<p class="suave">Ainda não há consultas registadas.</p>'}
    </section>`;

  $('#periodo', ecra)?.addEventListener('change', (e) => { escolhido = Number(e.target.value); desenharResumo(); });
  $$('tr[data-id]', ecra).forEach((tr) => {
    const abrir = () => ir(`#/consultas/${tr.dataset.id}`);
    tr.addEventListener('click', abrir);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });
  });
  await desenharResumo();
}

// ---------- Formulário de uma consulta ----------
function mostrarFormulario(ecra, consultas, id) {
  const nova = id === 'nova';
  const c = nova ? { data: hoje(), medidas_extra: [] } : consultas.find((x) => x.id === id);
  if (!c) { ir('#/consultas'); return; }
  let medidas = (c.medidas_extra || []).map((m) => ({ ...m }));
  const v = (x) => (x == null ? '' : String(x).replace('.', ','));

  function desenhar() {
    ecra.innerHTML = `
      <form class="cartao" id="form-consulta">
        <h1>${nova ? 'Nova consulta' : `Consulta de ${dataCurta(c.data)}`}</h1>
        <div class="linha-campos">
          <label class="campo"><span>Data da consulta</span><input type="date" name="data" value="${esc(c.data)}" required></label>
          <label class="campo"><span>Próxima consulta</span><input type="date" name="proxima_data" value="${esc(c.proxima_data || '')}"></label>
        </div>
        <p class="suave pequeno">Preenche só o que te mediram. Tudo é opcional.</p>
        <div class="linha-campos">
          ${MEDIDAS.map((m) => `<label class="campo"><span>${m.titulo}${m.un ? ` (${m.un})` : ''}</span>
            <input name="${m.campo}" inputmode="decimal" value="${esc(v(c[m.campo]))}"></label>`).join('')}
        </div>

        <h3>Outras medidas</h3>
        <div class="lista-edit" id="medidas">
          ${medidas.map((m, i) => `
            <div class="medida-linha" data-m="${i}">
              <input class="m-nome" placeholder="Nome (ex.: braço)" value="${esc(m.nome || '')}" aria-label="Nome da medida">
              <input class="m-valor" inputmode="decimal" placeholder="Valor" value="${esc(v(m.valor))}" aria-label="Valor">
              <input class="m-un" placeholder="cm" value="${esc(m.unidade || '')}" aria-label="Unidade">
              <button type="button" class="botao-icone" data-remover-medida="${i}" aria-label="Remover medida">✕</button>
            </div>`).join('')}
        </div>
        <button type="button" class="botao botao-sec" id="mais-medida">+ Acrescentar medida</button>

        <label class="campo"><span>Notas da consulta</span><textarea name="notas" rows="3">${esc(c.notas || '')}</textarea></label>

        <div class="botoes" style="justify-content:space-between">
          ${nova ? '<span></span>' : '<button type="button" class="botao botao-texto" id="apagar" style="color:var(--perigo)">Apagar consulta</button>'}
          <div class="botoes">
            <a class="botao botao-sec" href="#/consultas">Cancelar</a>
            <button class="botao" type="submit">Guardar</button>
          </div>
        </div>
      </form>`;

    const form = $('#form-consulta', ecra);
    const lerMedidas = () => $$('.medida-linha', ecra).map((l) => ({
      nome: $('.m-nome', l).value.trim(),
      valor: lerNumero($('.m-valor', l).value),
      unidade: $('.m-un', l).value.trim(),
    }));
    const lerCampos = () => {
      const f = new FormData(form);
      Object.assign(c, {
        data: f.get('data'),
        proxima_data: f.get('proxima_data') || null,
        notas: f.get('notas').trim() || null,
      });
      for (const m of MEDIDAS) c[m.campo] = lerNumero(f.get(m.campo));
    };

    $('#mais-medida', ecra).addEventListener('click', () => {
      lerCampos(); medidas = lerMedidas(); medidas.push({}); desenhar();
    });
    $$('[data-remover-medida]', ecra).forEach((b) => b.addEventListener('click', () => {
      lerCampos(); medidas = lerMedidas(); medidas.splice(Number(b.dataset.removerMedida), 1); desenhar();
    }));

    $('#apagar', ecra)?.addEventListener('click', async () => {
      const sim = await janela({ titulo: 'Apagar esta consulta?', texto: 'Os resultados desta consulta são apagados de vez.', botaoOk: 'Apagar', perigo: true });
      if (!sim) return;
      try { await db.apagarConsulta(c.id); aviso('Consulta apagada'); ir('#/consultas'); } catch (erro) { mostrarErro(erro, 'Não foi possível apagar'); }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      lerCampos();
      if (c.gordura_visceral != null) c.gordura_visceral = Math.round(c.gordura_visceral);
      const botao = e.submitter;
      botao.disabled = true;
      try {
        await db.guardarConsulta(estado.user.id, c, lerMedidas());
        aviso('Consulta guardada');
        ir('#/consultas');
      } catch (erro) {
        botao.disabled = false;
        mostrarErro(erro, erro.code === '23505' ? 'Já existe uma consulta nessa data' : 'Não foi possível guardar');
      }
    });
  }

  desenhar();
}
