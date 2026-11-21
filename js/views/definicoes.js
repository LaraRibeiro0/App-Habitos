// =====================================================================
//  Definições: perfil, objetivos, refeições, atividades e bebidas.
// =====================================================================
import { estado, recarregarBase } from '../app.js';
import * as db from '../data.js';
import { $, $$, esc, num, lerNumero, janela, aviso, mostrarErro, CORES } from '../util.js';
import { seletorHoras, htmlRefeicoes, lerRefeicoes } from './partes.js';

export async function mostrar(ecra) {
  const p = estado.perfil;
  let refeicoes = estado.refeicoesTipo.map((r) => ({ ...r, hora: (r.hora || '').slice(0, 5) }));

  function listaCategorias(tipo, titulo) {
    const lista = estado.categorias.filter((c) => c.tipo === tipo);
    return `
      <section class="cartao">
        <div class="cartao-cabeca"><h2>${titulo}</h2>
          <button class="botao botao-texto" data-nova="${tipo}">+ Nova</button></div>
        ${lista.length ? lista.map((c) => `
          <div class="liquido-linha">
            <span style="${c.arquivada ? 'opacity:.5' : ''}"><span class="ponto" style="display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:10px;vertical-align:-1px;background:${esc(c.cor)}"></span>${esc(c.nome)}${c.arquivada ? ' <span class="suave pequeno">(arquivada)</span>' : ''}</span>
            <span class="botoes">
              <button class="botao botao-texto" data-editar="${c.id}">Editar</button>
              <button class="botao botao-texto" data-arquivar="${c.id}">${c.arquivada ? 'Reativar' : 'Arquivar'}</button>
            </span>
          </div>`).join('') : '<p class="suave pequeno">Nenhuma ainda.</p>'}
      </section>`;
  }

  function desenhar() {
    ecra.innerHTML = `
      <h1>Definições</h1>

      <section class="cartao">
        <h2>Conta</h2>
        <label class="campo"><span>Nome</span><input id="nome" value="${esc(p.nome || '')}"></label>
        <p class="suave pequeno">Sessão iniciada como ${esc(estado.user.email || '')}</p>
      </section>

      <section class="cartao">
        <h2>Objetivos e hábitos</h2>
        <div class="linha-campos">
          <label class="campo"><span>Sono habitual</span>${seletorHoras('sono-habitual', p.sono_habitual_min ?? 420)}</label>
          <label class="campo"><span>Objetivo de sono</span>${seletorHoras('sono-objetivo', p.sono_objetivo_min ?? 450)}</label>
        </div>
        <div class="linha-campos">
          <label class="campo"><span>Líquidos por dia (L)</span>
            <input id="liquidos" inputmode="decimal" value="${p.liquidos_objetivo_ml ? num(p.liquidos_objetivo_ml / 1000, 2) : ''}"></label>
          <label class="campo"><span>Treinos por semana</span>
            <input id="treinos" type="number" min="0" max="14" value="${esc(p.treinos_objetivo_semana ?? '')}"></label>
        </div>
        <label class="campo"><span>Peso objetivo em kg (vazio = sem objetivo de peso)</span>
          <input id="peso-objetivo" inputmode="decimal" value="${p.peso_objetivo != null ? num(p.peso_objetivo) : ''}"></label>
        <label class="interruptor"><span>Acompanhar meditação ou relaxamento</span><input type="checkbox" id="meditacao" ${p.acompanha_meditacao ? 'checked' : ''}></label>
        <label class="interruptor"><span>Acompanhar leitura</span><input type="checkbox" id="leitura" ${p.acompanha_leitura ? 'checked' : ''}></label>
        <label class="interruptor"><span>Tenho acompanhamento com nutricionista</span><input type="checkbox" id="nutricionista" ${p.tem_nutricionista ? 'checked' : ''}></label>
        <button class="botao" id="guardar-perfil">Guardar</button>
      </section>

      <section class="cartao">
        <h2>Refeições habituais</h2>
        <p class="suave pequeno">Aparecem no registo diário já com estas horas.</p>
        ${htmlRefeicoes(refeicoes)}
        <button class="botao" id="guardar-refeicoes">Guardar refeições</button>
      </section>

      ${listaCategorias('atividade', 'Atividades')}
      ${listaCategorias('bebida', 'Bebidas')}

      <section class="cartao">
        <button class="botao botao-sec" id="sair">Terminar sessão</button>
        <a class="pequeno" href="privacidade.html">Política de privacidade</a>
      </section>`;
    ligar();
  }

  function ligar() {
    $('#guardar-perfil', ecra).addEventListener('click', async (e) => {
      const liquidos = lerNumero($('#liquidos', ecra).value);
      e.target.disabled = true;
      try {
        await db.guardarPerfil(estado.user.id, {
          nome: $('#nome', ecra).value.trim() || null,
          sono_habitual_min: Number($('#sono-habitual', ecra).value),
          sono_objetivo_min: Number($('#sono-objetivo', ecra).value),
          liquidos_objetivo_ml: liquidos ? Math.round(liquidos * 1000) : null,
          treinos_objetivo_semana: lerNumero($('#treinos', ecra).value),
          peso_objetivo: lerNumero($('#peso-objetivo', ecra).value),
          acompanha_meditacao: $('#meditacao', ecra).checked,
          acompanha_leitura: $('#leitura', ecra).checked,
          tem_nutricionista: $('#nutricionista', ecra).checked,
        });
        await recarregarBase();
        aviso('Definições guardadas');
      } catch (erro) { mostrarErro(erro); }
      e.target.disabled = false;
    });

    // Refeições habituais
    $('#mais-refeicao', ecra).addEventListener('click', () => {
      refeicoes = lerRefeicoes(ecra);
      refeicoes.push({ nome: '', hora: '' });
      desenhar();
      $$('.r-nome', ecra).at(-1).focus();
    });
    $$('[data-remover-refeicao]', ecra).forEach((b) => b.addEventListener('click', () => {
      b.closest('.lista-edit-linha').remove();
    }));
    $('#guardar-refeicoes', ecra).addEventListener('click', async (e) => {
      const lista = lerRefeicoes(ecra);
      if (!lista.length) return aviso('Deixa pelo menos uma refeição.', 'erro');
      e.target.disabled = true;
      try {
        await db.guardarRefeicoesTipo(lista, estado.refeicoesTipo);
        await recarregarBase();
        refeicoes = estado.refeicoesTipo.map((r) => ({ ...r, hora: (r.hora || '').slice(0, 5) }));
        aviso('Refeições guardadas');
        desenhar();
      } catch (erro) { e.target.disabled = false; mostrarErro(erro); }
    });

    // Atividades e bebidas
    $$('[data-nova]', ecra).forEach((b) => b.addEventListener('click', async () => {
      const tipo = b.dataset.nova;
      const resp = await janela({
        titulo: tipo === 'bebida' ? 'Nova bebida' : 'Nova atividade',
        campos: [{ id: 'nome', rotulo: 'Nome', obrigatorio: true },
          { id: 'cor', rotulo: 'Cor no calendário', tipo: 'cor', valor: CORES[estado.categorias.length % CORES.length] }],
        botaoOk: 'Criar',
      });
      if (!resp?.nome?.trim()) return;
      try {
        await db.criarCategoria({ tipo, nome: resp.nome, cor: resp.cor });
        await recarregarBase();
        desenhar();
      } catch (erro) { mostrarErro(erro, erro.code === '23505' ? 'Já existe uma com esse nome' : 'Não foi possível criar'); }
    }));
    $$('[data-editar]', ecra).forEach((b) => b.addEventListener('click', async () => {
      const c = estado.categorias.find((x) => x.id === b.dataset.editar);
      const resp = await janela({
        titulo: `Editar ${c.nome}`,
        texto: 'O nome muda também nos registos antigos.',
        campos: [{ id: 'nome', rotulo: 'Nome', valor: c.nome, obrigatorio: true },
          { id: 'cor', rotulo: 'Cor no calendário', tipo: 'cor', valor: c.cor }],
      });
      if (!resp?.nome?.trim()) return;
      try {
        await db.atualizarCategoria(c.id, { nome: resp.nome.trim(), cor: resp.cor });
        await recarregarBase();
        desenhar();
      } catch (erro) { mostrarErro(erro); }
    }));
    $$('[data-arquivar]', ecra).forEach((b) => b.addEventListener('click', async () => {
      const c = estado.categorias.find((x) => x.id === b.dataset.arquivar);
      try {
        await db.atualizarCategoria(c.id, { arquivada: !c.arquivada });
        await recarregarBase();
        aviso(c.arquivada ? `${c.nome} reativada` : `${c.nome} arquivada; os registos antigos mantêm-se`);
        desenhar();
      } catch (erro) { mostrarErro(erro); }
    }));

    $('#sair', ecra).addEventListener('click', async () => {
      // A app volta ao ecrã de entrada sozinha quando a sessão termina.
      history.replaceState(null, '', location.pathname);
      await db.sair();
    });
  }

  desenhar();
}
