// =====================================================================
//  Ponto de partida da app.
//  1. Verifica se há sessão iniciada.
//  2. Carrega o perfil, as categorias e as refeições habituais.
//  3. Mostra o ecrã certo conforme o endereço (#/inicio, #/registar, …).
// =====================================================================
import { supa } from './supa.js';
import { APP_NOME } from './config.js';
import * as db from './data.js';
import { $, $$, mostrarErro, aviso } from './util.js';

import * as ecraEntrada from './views/entrada.js';
import * as ecraConfiguracao from './views/configuracao.js';
import * as ecraInicio from './views/inicio.js';
import * as ecraRegistar from './views/registar.js';
import * as ecraCalendario from './views/calendario.js';
import * as ecraConsultas from './views/consultas.js';
import * as ecraDefinicoes from './views/definicoes.js';

// Estado partilhado por todos os ecrãs.
export const estado = {
  user: null,          // utilizador com sessão iniciada
  perfil: null,        // linha da tabela perfis
  categorias: [],      // atividades e bebidas (inclui arquivadas)
  refeicoesTipo: [],   // refeições habituais
};

const ROTAS = {
  inicio: ecraInicio,
  registar: ecraRegistar,
  calendario: ecraCalendario,
  consultas: ecraConsultas,
  definicoes: ecraDefinicoes,
};

// Volta a ler da base de dados o que muda pouco (perfil, categorias,
// refeições). Os ecrãs chamam isto depois de alterarem estas coisas.
export async function recarregarBase() {
  const [perfil, categorias, refeicoesTipo] = await Promise.all([
    db.carregarPerfil(estado.user.id),
    db.listarCategorias(),
    db.listarRefeicoesTipo(),
  ]);
  estado.perfil = perfil;
  estado.categorias = categorias;
  estado.refeicoesTipo = refeicoesTipo;
  $('#nav-consultas').hidden = !perfil?.tem_nutricionista;
}

export function ir(caminho) {
  if (location.hash === caminho) mostrar();
  else location.hash = caminho;
}

// Lê o endereço: "#/registar/2026-11-21" → { rota: 'registar', params: ['2026-11-21'] }
function lerRota() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { rota: partes[0] || 'inicio', params: partes.slice(1) };
}

let aMostrar = 0; // evita que um ecrã antigo, mais lento, apareça por cima do novo

// "Sujo" = o ecrã tem alterações por guardar (algo escrito ou escolhido).
// Os ecrãs também podem marcar isto (ex.: o registo, ao tocar num botão).
export const ui = { sujo: false };

// opcoes.silencioso: redesenha sem mostrar "A carregar…" e sem voltar ao
// topo (usado pela atualização automática).
async function mostrar(opcoes = {}) {
  const silencioso = opcoes?.silencioso === true;
  const meu = ++aMostrar;
  ui.sujo = false;
  const ecra = $('#ecra');
  const comSessao = Boolean(estado.user);
  const configurado = Boolean(estado.perfil?.configurado);

  $('#topo').hidden = !comSessao || !configurado;
  $('#nav').hidden = !comSessao || !configurado;

  try {
    if (!comSessao) return await ecraEntrada.mostrar(ecra);
    if (!configurado) return await ecraConfiguracao.mostrar(ecra);

    const { rota, params } = lerRota();
    const modulo = ROTAS[rota] || ecraInicio;
    $$('#nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === rota));
    const y = window.scrollY;
    if (!silencioso) ecra.innerHTML = '<p class="a-carregar">A carregar…</p>';
    await modulo.mostrar(ecra, params, () => meu === aMostrar);
    window.scrollTo(0, silencioso ? y : 0);
  } catch (erro) {
    if (meu !== aMostrar) return;
    if (silencioso) throw erro; // a atualização automática trata o erro
    mostrarErro(erro, 'Algo correu mal ao abrir este ecrã');
    ecra.innerHTML = `<div class="cartao"><h2>Não foi possível carregar</h2>
      <p class="suave">Verifica a ligação à internet e tenta de novo.</p>
      <button class="botao" onclick="location.reload()">Tentar de novo</button></div>`;
  }
}
export { mostrar };

// Chamada sempre que a sessão muda (entrar, sair, renovar).
async function aoMudarSessao(sessao) {
  const antes = estado.user?.id;
  estado.user = sessao?.user ?? null;
  if (estado.user?.id === antes && estado.perfil) return; // só renovou a sessão
  if (estado.user) {
    try {
      await recarregarBase();
    } catch (erro) {
      mostrarErro(erro, 'Não foi possível ler o teu perfil');
    }
  } else {
    estado.perfil = null;
  }
  mostrar();
}

async function arrancar() {
  document.title = APP_NOME;
  $('#marca').textContent = APP_NOME;

  // Depois do login com Google, o endereço vem com ?code=…; o Supabase
  // já o usou para criar a sessão, por isso limpamos o endereço.
  const sessao = await db.sessaoAtual();
  if (location.search.includes('code=')) {
    history.replaceState(null, '', location.pathname + location.hash);
  }
  await aoMudarSessao(sessao);

  supa.auth.onAuthStateChange((evento, novaSessao) => {
    if (evento === 'INITIAL_SESSION') return; // já tratado acima
    // setTimeout: o Supabase recomenda não esperar por outras chamadas
    // dentro deste callback.
    setTimeout(() => aoMudarSessao(novaSessao), 0);
  });

  window.addEventListener('hashchange', mostrar);
  ligarAtualizacao();
}

// =====================================================================
//  Atualização dos dados
//  No telemóvel, a app instalada fica "adormecida" em segundo plano e
//  não sabe que os dados mudaram noutro dispositivo. Por isso voltamos
//  a ler os dados do Supabase:
//    - quando se volta à app;
//    - a cada 30 segundos, enquanto está visível;
//    - no botão ↻ do cabeçalho.
// =====================================================================
const INTERVALO_MS = 30_000;
let aAtualizar = false;
let ultimaAtualizacao = Date.now();

// Há um formulário ou janela aberta com coisas por guardar?
function haFormularioAberto() {
  if ($('.janela-fundo')) return true;                    // janela (modal) aberta
  const ativo = document.activeElement;
  if (ativo?.matches?.('input, textarea, select') && $('#ecra').contains(ativo)) return true; // a escrever
  return ui.sujo;                                          // alterações por guardar
}

export async function atualizar({ manual = false } = {}) {
  if (aAtualizar || !estado.user || !estado.perfil?.configurado) return;
  // Evita duas atualizações automáticas seguidas (ex.: visibilitychange + pageshow)
  if (!manual && Date.now() - ultimaAtualizacao < 2000) return;

  aAtualizar = true;
  const botao = $('#atualizar');
  botao?.classList.add('a-girar');
  try {
    await recarregarBase();             // perfil, categorias, refeições
    const bloqueado = haFormularioAberto();
    if (!bloqueado) await mostrar({ silencioso: true }); // volta a ler os dados do ecrã
    ultimaAtualizacao = Date.now();
    if (manual) {
      aviso(bloqueado
        ? 'Dados atualizados. Guarda ou fecha o que estás a editar para veres o ecrã atualizado.'
        : 'Dados atualizados');
    }
  } catch (erro) {
    if (manual) mostrarErro(erro, 'Não foi possível atualizar');
    else console.warn('Atualização automática falhou:', erro);
  } finally {
    aAtualizar = false;
    botao?.classList.remove('a-girar');
  }
}

function ligarAtualizacao() {
  // Qualquer coisa escrita no ecrã conta como "alterações por guardar"
  // (exceto controlos marcados com data-nao-suja, como o filtro de período)
  const marcar = (e) => { if (!e.target.closest('[data-nao-suja]')) ui.sujo = true; };
  $('#ecra').addEventListener('input', marcar);
  $('#ecra').addEventListener('change', marcar);

  // Quando se volta à app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') atualizar();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) atualizar(); });

  // A cada 30 segundos, só com a app visível
  setInterval(() => {
    if (document.visibilityState === 'visible') atualizar();
  }, INTERVALO_MS);

  // Botão ↻
  $('#atualizar').addEventListener('click', () => atualizar({ manual: true }));
}

arrancar();

// Regista o service worker (o que permite instalar a app).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker:', e));
  });
}
