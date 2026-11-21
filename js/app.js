// =====================================================================
//  Ponto de partida da app.
//  1. Verifica se há sessão iniciada.
//  2. Carrega o perfil, as categorias e as refeições habituais.
//  3. Mostra o ecrã certo conforme o endereço (#/inicio, #/registar, …).
// =====================================================================
import { supa } from './supa.js';
import { APP_NOME } from './config.js';
import * as db from './data.js';
import { $, $$, mostrarErro } from './util.js';

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

async function mostrar() {
  const meu = ++aMostrar;
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
    ecra.innerHTML = '<p class="a-carregar">A carregar…</p>';
    await modulo.mostrar(ecra, params, () => meu === aMostrar);
    window.scrollTo(0, 0);
  } catch (erro) {
    if (meu !== aMostrar) return;
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
}

arrancar();

// Regista o service worker (o que permite instalar a app).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker:', e));
  });
}
