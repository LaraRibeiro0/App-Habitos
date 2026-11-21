// =====================================================================
//  Configuração inicial: aparece só na primeira vez que a pessoa entra.
//  5 passos; tudo fica editável depois, nas Definições.
// =====================================================================
import { estado, recarregarBase, ir } from '../app.js';
import * as db from '../data.js';
import { $, $$, esc, hoje, lerNumero, janela, mostrarErro, aviso, CORES } from '../util.js';
import {
  SUGESTOES_ATIVIDADES, SUGESTOES_BEBIDAS, REFEICOES_PADRAO,
  seletorHoras, htmlRefeicoes, lerRefeicoes, htmlFichasEscolha,
} from './partes.js';

const N_PASSOS = 5;

export async function mostrar(ecra) {
  // Respostas guardadas em memória até ao fim; só no último passo
  // é que se escreve na base de dados.
  const r = {
    refeicoes: REFEICOES_PADRAO.map((x) => ({ ...x })),
    atividades: new Set(),
    bebidas: new Set(['Água']),
    sonoHabitual: 420,
    sonoObjetivo: 450,
    liquidosL: 1.5,
    treinos: 3,
    querPeso: false,
    pesoObjetivo: null,
    meditacao: true,
    leitura: true,
    nutricionista: false,
    primeiraConsulta: hoje(),
    proximaConsulta: '',
  };
  let passo = 1;

  function moldura(titulo, texto, corpo) {
    const nome = estado.perfil?.nome?.split(' ')[0];
    return `
      <div class="passos" aria-label="Passo ${passo} de ${N_PASSOS}">
        ${Array.from({ length: N_PASSOS }, (_, i) => `<span class="${i < passo ? 'feito' : ''}"></span>`).join('')}
      </div>
      ${passo === 1 ? `<p class="suave">Olá${nome ? `, ${esc(nome)}` : ''}! Vamos preparar a app para ti. Demora 2 minutos e podes mudar tudo depois.</p>` : ''}
      <div class="cartao">
        <h1>${titulo}</h1>
        <p class="suave">${texto}</p>
        ${corpo}
      </div>
      <div class="botoes" style="justify-content:space-between">
        ${passo > 1 ? '<button class="botao botao-sec" id="voltar">Voltar</button>' : '<span></span>'}
        <button class="botao" id="seguinte">${passo === N_PASSOS ? 'Começar a usar' : 'Seguinte'}</button>
      </div>`;
  }

  // Guarda no objeto "r" o que está escrito no passo atual.
  function lerPasso() {
    if (passo === 1) r.refeicoes = lerRefeicoes(ecra);
    if (passo === 4) {
      r.sonoHabitual = Number($('#sono-habitual', ecra).value);
      r.sonoObjetivo = Number($('#sono-objetivo', ecra).value);
      r.liquidosL = lerNumero($('#liquidos', ecra).value);
      r.treinos = lerNumero($('#treinos', ecra).value);
      r.querPeso = $('#quer-peso', ecra).checked;
      r.pesoObjetivo = r.querPeso ? lerNumero($('#peso-objetivo', ecra).value) : null;
    }
    if (passo === 5) {
      r.meditacao = $('#meditacao', ecra).checked;
      r.leitura = $('#leitura', ecra).checked;
      r.nutricionista = $('#nutricionista', ecra).checked;
      r.primeiraConsulta = $('#primeira', ecra)?.value || '';
      r.proximaConsulta = $('#proxima', ecra)?.value || '';
    }
  }

  function desenhar() {
    let html = '';
    if (passo === 1) {
      html = moldura('As tuas refeições',
        'Que refeições costumas fazer, e a que horas? Ao registar a alimentação, aparecem já com estas horas.',
        htmlRefeicoes(r.refeicoes));
    } else if (passo === 2) {
      html = moldura('O teu exercício',
        'Que atividades costumas fazer? Escolhe as tuas, ou cria novas. Podes acrescentar outras sempre que quiseres.',
        htmlFichasEscolha('atividades', SUGESTOES_ATIVIDADES, r.atividades));
    } else if (passo === 3) {
      html = moldura('O que bebes',
        'Escolhe as bebidas que queres registar ao longo do dia.',
        htmlFichasEscolha('bebidas', SUGESTOES_BEBIDAS, r.bebidas));
    } else if (passo === 4) {
      html = moldura('Os teus objetivos', 'Servem para comparar a tua semana com o que pretendes.', `
        <div class="linha-campos">
          <label class="campo"><span>Quantas horas dormes, normalmente?</span>${seletorHoras('sono-habitual', r.sonoHabitual)}</label>
          <label class="campo"><span>Quantas querias dormir?</span>${seletorHoras('sono-objetivo', r.sonoObjetivo)}</label>
        </div>
        <div class="linha-campos">
          <label class="campo"><span>Líquidos por dia (litros)</span>
            <input id="liquidos" inputmode="decimal" value="${esc(String(r.liquidosL ?? '').replace('.', ','))}"></label>
          <label class="campo"><span>Treinos por semana</span>
            <input id="treinos" type="number" min="0" max="14" value="${esc(r.treinos ?? '')}"></label>
        </div>
        <label class="interruptor"><span>Quero acompanhar um objetivo de peso</span>
          <input type="checkbox" id="quer-peso" ${r.querPeso ? 'checked' : ''}></label>
        <label class="campo" id="campo-peso" ${r.querPeso ? '' : 'hidden'}><span>Peso objetivo (kg)</span>
          <input id="peso-objetivo" inputmode="decimal" value="${esc(String(r.pesoObjetivo ?? '').replace('.', ','))}"></label>
        <p class="suave pequeno">Se não definires um objetivo de peso, a app serve só para os hábitos e o peso fica apenas como registo.</p>`);
    } else if (passo === 5) {
      html = moldura('Hábitos e acompanhamento', 'Escolhe o que queres acompanhar.', `
        <label class="interruptor"><span>Meditação ou relaxamento</span>
          <input type="checkbox" id="meditacao" ${r.meditacao ? 'checked' : ''}></label>
        <label class="interruptor"><span>Leitura</span>
          <input type="checkbox" id="leitura" ${r.leitura ? 'checked' : ''}></label>
        <label class="interruptor"><span>Tenho acompanhamento com nutricionista</span>
          <input type="checkbox" id="nutricionista" ${r.nutricionista ? 'checked' : ''}></label>
        <div id="datas-consulta" class="linha-campos" ${r.nutricionista ? '' : 'hidden'}>
          <label class="campo"><span>Data da primeira consulta</span>
            <input type="date" id="primeira" value="${esc(r.primeiraConsulta)}"></label>
          <label class="campo"><span>Data da próxima consulta</span>
            <input type="date" id="proxima" value="${esc(r.proximaConsulta)}"></label>
        </div>`);
    }
    ecra.innerHTML = html;
    ligarEventos();
  }

  function ligarEventos() {
    $('#voltar', ecra)?.addEventListener('click', () => { lerPasso(); passo--; desenhar(); });
    $('#seguinte', ecra).addEventListener('click', seguinte);

    // Passo 1: acrescentar e remover refeições
    $('#mais-refeicao', ecra)?.addEventListener('click', () => {
      r.refeicoes = lerRefeicoes(ecra);
      r.refeicoes.push({ nome: '', hora: '' });
      desenhar();
      $$('.r-nome', ecra).at(-1).focus();
    });
    $$('[data-remover-refeicao]', ecra).forEach((b) => b.addEventListener('click', () => {
      const linha = b.closest('.lista-edit-linha');
      linha.remove();
    }));

    // Passos 2 e 3: fichas de atividades e bebidas
    $$('[data-fichas] .ficha[data-nome]', ecra).forEach((f) => f.addEventListener('click', () => {
      const conjunto = f.parentElement.dataset.fichas === 'atividades' ? r.atividades : r.bebidas;
      const nome = f.dataset.nome;
      if (conjunto.has(nome)) conjunto.delete(nome); else conjunto.add(nome);
      f.setAttribute('aria-pressed', conjunto.has(nome));
    }));
    $$('[data-nova]', ecra).forEach((b) => b.addEventListener('click', async () => {
      const tipo = b.dataset.nova;
      const resp = await janela({
        titulo: tipo === 'atividades' ? 'Nova atividade' : 'Nova bebida',
        campos: [{ id: 'nome', rotulo: 'Nome', obrigatorio: true }],
        botaoOk: 'Acrescentar',
      });
      if (resp?.nome?.trim()) {
        (tipo === 'atividades' ? r.atividades : r.bebidas).add(resp.nome.trim());
        desenhar();
      }
    }));

    // Passos 4 e 5: mostrar/esconder campos dependentes
    $('#quer-peso', ecra)?.addEventListener('change', (e) => { $('#campo-peso', ecra).hidden = !e.target.checked; });
    $('#nutricionista', ecra)?.addEventListener('change', (e) => { $('#datas-consulta', ecra).hidden = !e.target.checked; });
  }

  async function seguinte(e) {
    lerPasso();
    if (passo === 1 && !r.refeicoes.length) return aviso('Acrescenta pelo menos uma refeição.', 'erro');
    if (passo < N_PASSOS) { passo++; return desenhar(); }

    e.target.disabled = true;
    try {
      await guardarTudo();
      await recarregarBase();
      aviso('Tudo pronto!');
      ir('#/inicio');
    } catch (erro) {
      e.target.disabled = false;
      mostrarErro(erro, 'Não foi possível guardar a configuração');
    }
  }

  async function guardarTudo() {
    const uid = estado.user.id;
    const existentes = await db.listarCategorias();
    const jaExiste = (tipo, nome) => existentes.some((c) => c.tipo === tipo && c.nome === nome);
    let cor = 0;
    for (const nome of r.atividades) {
      if (!jaExiste('atividade', nome)) await db.criarCategoria({ tipo: 'atividade', nome, cor: CORES[cor++ % CORES.length] });
    }
    for (const nome of r.bebidas) {
      if (!jaExiste('bebida', nome)) await db.criarCategoria({ tipo: 'bebida', nome, cor: CORES[cor++ % CORES.length] });
    }
    await db.guardarRefeicoesTipo(r.refeicoes, await db.listarRefeicoesTipo());

    if (r.nutricionista && r.primeiraConsulta) {
      await db.guardarConsulta(uid, { data: r.primeiraConsulta, proxima_data: r.proximaConsulta || null });
    }

    await db.guardarPerfil(uid, {
      sono_habitual_min: r.sonoHabitual,
      sono_objetivo_min: r.sonoObjetivo,
      liquidos_objetivo_ml: r.liquidosL ? Math.round(r.liquidosL * 1000) : null,
      treinos_objetivo_semana: r.treinos,
      peso_objetivo: r.pesoObjetivo,
      acompanha_meditacao: r.meditacao,
      acompanha_leitura: r.leitura,
      tem_nutricionista: r.nutricionista,
      configurado: true,
    });
  }

  desenhar();
}
