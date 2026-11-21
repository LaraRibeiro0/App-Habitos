// =====================================================================
//  Acesso à base de dados (Supabase).
//  Todas as leituras e escritas passam por aqui, para o resto da app
//  não precisar de saber como as tabelas estão organizadas.
//
//  Não é preciso filtrar por user_id nas leituras: as regras RLS já
//  garantem que cada pessoa só recebe as suas linhas.
// =====================================================================
import { supa } from './supa.js';

// Lança o erro do Supabase (se houver) para ser tratado por quem chamou.
function ok({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Sessão ----------
export async function sessaoAtual() {
  const { data } = await supa.auth.getSession();
  return data.session;
}

export function entrarComGoogle() {
  // Depois do login, a Google devolve a pessoa a esta mesma página.
  return supa.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
}

export function entrarComEmail(email, password) {
  return supa.auth.signInWithPassword({ email, password });
}

export function criarConta(email, password) {
  return supa.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
}

export function sair() {
  return supa.auth.signOut();
}

// ---------- Perfil ----------
export async function carregarPerfil(id) {
  return ok(await supa.from('perfis').select('*').eq('id', id).maybeSingle());
}

export async function guardarPerfil(id, campos) {
  return ok(await supa.from('perfis').update(campos).eq('id', id).select().single());
}

// ---------- Refeições habituais ----------
export async function listarRefeicoesTipo() {
  return ok(await supa.from('refeicoes_tipo').select('*')
    .eq('arquivada', false).order('ordem'));
}

// Recebe a lista completa como deve ficar. As que tinham id são
// atualizadas, as novas são criadas, e as que desapareceram da lista
// são arquivadas (não apagadas, para não perder o histórico).
export async function guardarRefeicoesTipo(lista, existentes = []) {
  const idsMantidos = new Set();
  for (const [i, r] of lista.entries()) {
    const campos = { nome: r.nome, hora: r.hora || null, ordem: i, arquivada: false };
    if (r.id) {
      idsMantidos.add(r.id);
      ok(await supa.from('refeicoes_tipo').update(campos).eq('id', r.id));
    } else {
      ok(await supa.from('refeicoes_tipo').insert(campos));
    }
  }
  const aArquivar = existentes.filter((r) => !idsMantidos.has(r.id)).map((r) => r.id);
  if (aArquivar.length) {
    ok(await supa.from('refeicoes_tipo').update({ arquivada: true }).in('id', aArquivar));
  }
}

// ---------- Categorias (atividades e bebidas) ----------
export async function listarCategorias() {
  return ok(await supa.from('categorias').select('*').order('criado_em'));
}

export async function criarCategoria({ tipo, nome, cor }) {
  return ok(await supa.from('categorias').insert({ tipo, nome: nome.trim(), cor }).select().single());
}

export async function atualizarCategoria(id, campos) {
  return ok(await supa.from('categorias').update(campos).eq('id', id).select().single());
}

// ---------- Dias ----------
// Um dia vem sempre com as suas refeições, atividades e líquidos
// (o Supabase junta-os através das chaves estrangeiras).
const SELECT_DIA = '*, refeicoes_dia(*), atividades_dia(*), liquidos_dia(*)';

export async function carregarDia(data) {
  return ok(await supa.from('dias').select(SELECT_DIA).eq('data', data).maybeSingle());
}

export async function carregarPeriodo(de, ate) {
  return ok(await supa.from('dias').select(SELECT_DIA)
    .gte('data', de).lte('data', ate).order('data'));
}

// Primeira pesagem de sempre (ponto de partida da barra do objetivo).
export async function primeiraPesagem() {
  return ok(await supa.from('dias').select('data, peso')
    .not('peso', 'is', null).order('data').limit(1).maybeSingle());
}

// Pesagens dos últimos tempos, para a linha do peso no dashboard.
export async function pesagensDesde(de) {
  return ok(await supa.from('dias').select('data, peso')
    .not('peso', 'is', null).gte('data', de).order('data'));
}

// Guarda o dia inteiro: primeiro o "cabeçalho" (tabela dias), depois
// substitui as refeições, atividades e líquidos desse dia.
export async function guardarDia(userId, data, { campos, refeicoes, atividades, liquidos }) {
  const dia = ok(await supa.from('dias')
    .upsert({ user_id: userId, data, ...campos, atualizado_em: new Date().toISOString() },
      { onConflict: 'user_id,data' })
    .select().single());

  // Apagar e voltar a inserir é a forma mais simples de refletir
  // linhas acrescentadas, alteradas e removidas no ecrã.
  for (const tabela of ['refeicoes_dia', 'atividades_dia', 'liquidos_dia']) {
    ok(await supa.from(tabela).delete().eq('dia_id', dia.id));
  }
  const comDia = (linhas) => linhas.map((l) => ({ ...l, dia_id: dia.id, user_id: userId }));
  if (refeicoes.length) ok(await supa.from('refeicoes_dia').insert(comDia(refeicoes)));
  if (atividades.length) ok(await supa.from('atividades_dia').insert(comDia(atividades)));
  if (liquidos.length) ok(await supa.from('liquidos_dia').insert(comDia(liquidos)));
  return dia;
}

// ---------- Consultas ----------
export async function listarConsultas() {
  return ok(await supa.from('consultas').select('*, medidas_extra(*)')
    .order('data', { ascending: false }));
}

export async function guardarConsulta(userId, consulta, medidas = []) {
  const { medidas_extra, ...campos } = consulta;
  let id = campos.id;
  delete campos.id;
  // Se já houver uma consulta nessa data (por exemplo, a criada na
  // configuração inicial só com as datas), atualiza-a em vez de dar erro.
  if (!id) {
    const existente = ok(await supa.from('consultas').select('id').eq('data', campos.data).maybeSingle());
    id = existente?.id;
  }
  const linha = id
    ? ok(await supa.from('consultas').update(campos).eq('id', id).select().single())
    : ok(await supa.from('consultas').insert({ ...campos, user_id: userId }).select().single());

  ok(await supa.from('medidas_extra').delete().eq('consulta_id', linha.id));
  const validas = medidas.filter((m) => m.nome && m.valor != null);
  if (validas.length) {
    ok(await supa.from('medidas_extra').insert(validas.map((m) => ({
      nome: m.nome, valor: m.valor, unidade: m.unidade || null,
      consulta_id: linha.id, user_id: userId,
    }))));
  }
  return linha;
}

export async function apagarConsulta(id) {
  ok(await supa.from('consultas').delete().eq('id', id));
}
