-- =====================================================================
--  App de Hábitos Saudáveis — Base de dados (Supabase / PostgreSQL)
--  Versão 1
--
--  Como usar: no painel do Supabase, abre "SQL Editor" > "New query",
--  cola este ficheiro todo e carrega em "Run". Só se corre UMA vez.
--
--  Ideia geral:
--   - Cada tabela tem uma coluna user_id = o dono da linha.
--   - O Supabase já tem uma tabela de utilizadores (auth.users), criada
--     por ele, onde ficam as contas (Google ou email). Ligamo-nos a ela.
--   - No fim, ativamos "Row Level Security" (RLS): o PostgreSQL passa a
--     filtrar sozinho, e cada pessoa só lê e altera as SUAS linhas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PERFIS — uma linha por utilizador, com as definições da app
-- ---------------------------------------------------------------------
create table perfis (
  -- A chave primária é o próprio id da conta: 1 perfil por pessoa.
  id                       uuid primary key references auth.users on delete cascade,
  nome                     text,
  peso_objetivo            numeric(5,1),            -- opcional (null = só hábitos)
  sono_habitual_min        integer,                 -- ex: 7h = 420 minutos
  sono_objetivo_min        integer,                 -- ex: 7h30 = 450 minutos
  liquidos_objetivo_ml     integer,                 -- ex: 1,5 L = 1500
  treinos_objetivo_semana  integer,                 -- ex: 3
  acompanha_meditacao      boolean not null default true,
  acompanha_leitura        boolean not null default true,
  tem_nutricionista        boolean not null default false,
  configurado              boolean not null default false, -- já fez a configuração inicial?
  criado_em                timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. REFEIÇÕES DO PERFIL — as refeições habituais de cada pessoa
--    (ex: Pequeno-almoço 06:30, Almoço 13:00, ...)
-- ---------------------------------------------------------------------
create table refeicoes_tipo (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  nome       text not null,
  hora       time,                                  -- hora habitual
  ordem      integer not null default 0,            -- ordem em que aparecem
  arquivada  boolean not null default false         -- "apagar" sem perder o histórico
);


-- ---------------------------------------------------------------------
-- 3. CATEGORIAS — as atividades e bebidas que cada pessoa cria
-- ---------------------------------------------------------------------
create table categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  tipo       text not null check (tipo in ('atividade', 'bebida')),
  nome       text not null,
  cor        text not null default '#4f7cff',       -- cor usada no calendário
  arquivada  boolean not null default false,
  criado_em  timestamptz not null default now(),
  unique (user_id, tipo, nome)                      -- não repetir "CrossFit" duas vezes
);


-- ---------------------------------------------------------------------
-- 4. DIAS — um registo por pessoa por dia
-- ---------------------------------------------------------------------
create table dias (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  data            date not null,
  sono_deitar     time,                             -- hora a que adormeceu (noite anterior)
  sono_acordar    time,                             -- hora a que acordou
  sono_qualidade  text check (sono_qualidade in ('bem', 'mais_ou_menos', 'mal')),
  meditacao_min   integer check (meditacao_min >= 0),
  leitura_min     integer check (leitura_min >= 0),
  leitura_livro   text,
  peso            numeric(5,1),                     -- só nos dias em que se pesou
  notas           text,
  atualizado_em   timestamptz not null default now(),
  unique (user_id, data),                           -- nunca dois registos do mesmo dia
  unique (id, user_id)                              -- necessário para as ligações abaixo
);


-- ---------------------------------------------------------------------
-- 5. REFEIÇÕES DO DIA — o que comeu em cada refeição
--    Um dia tem várias refeições → tabela própria (relação 1:N)
-- ---------------------------------------------------------------------
create table refeicoes_dia (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid(),
  dia_id            uuid not null,
  refeicao_tipo_id  uuid references refeicoes_tipo on delete set null, -- null = refeição extra
  nome              text not null,                  -- ex: "Almoço" ou "Extra"
  hora              time,
  descricao         text,                           -- o que comeu
  categoria         text not null check (categoria in ('plano', 'parcial', 'livre')),
  -- Chave estrangeira composta: o dia tem de ser do MESMO utilizador.
  foreign key (dia_id, user_id) references dias (id, user_id) on delete cascade
);


-- ---------------------------------------------------------------------
-- 6. ATIVIDADES DO DIA — treinos feitos
-- ---------------------------------------------------------------------
create table atividades_dia (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  dia_id        uuid not null,
  categoria_id  uuid not null references categorias on delete restrict,
  duracao_min   integer check (duracao_min > 0),
  intensidade   text check (intensidade in ('leve', 'moderada', 'intensa')),
  foreign key (dia_id, user_id) references dias (id, user_id) on delete cascade
);


-- ---------------------------------------------------------------------
-- 7. LÍQUIDOS DO DIA — bebidas e quantidades
-- ---------------------------------------------------------------------
create table liquidos_dia (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  dia_id        uuid not null,
  categoria_id  uuid not null references categorias on delete restrict,
  quantidade_ml integer not null check (quantidade_ml > 0),
  foreign key (dia_id, user_id) references dias (id, user_id) on delete cascade
);


-- ---------------------------------------------------------------------
-- 8. CONSULTAS — resultados de cada consulta com o nutricionista
-- ---------------------------------------------------------------------
create table consultas (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  data               date not null,
  proxima_data       date,                          -- data da consulta seguinte
  peso               numeric(5,1),
  imc                numeric(4,1),
  massa_gorda_pct    numeric(4,1),
  massa_muscular_kg  numeric(5,1),                  -- massa isenta de gordura
  gordura_visceral   integer,
  cintura_cm         numeric(5,1),
  anca_cm            numeric(5,1),
  notas              text,
  unique (user_id, data),
  unique (id, user_id)
);


-- ---------------------------------------------------------------------
-- 9. MEDIDAS EXTRA — medidas personalizadas numa consulta
--    (ex: perímetro do braço)
-- ---------------------------------------------------------------------
create table medidas_extra (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  consulta_id  uuid not null,
  nome         text not null,
  valor        numeric not null,
  unidade      text,
  foreign key (consulta_id, user_id) references consultas (id, user_id) on delete cascade
);


-- ---------------------------------------------------------------------
-- 10. ÍNDICES — tornam rápidas as pesquisas mais comuns (por dia)
-- ---------------------------------------------------------------------
create index on refeicoes_dia  (dia_id);
create index on atividades_dia (dia_id);
create index on liquidos_dia   (dia_id);
create index on medidas_extra  (consulta_id);


-- ---------------------------------------------------------------------
-- 11. SEGURANÇA (Row Level Security)
--     Depois de ativar o RLS, ninguém vê nada... até criarmos uma
--     "policy" (regra) que diga quem pode ver o quê.
--     auth.uid() = o id de quem está com sessão iniciada.
-- ---------------------------------------------------------------------
alter table perfis          enable row level security;
alter table refeicoes_tipo  enable row level security;
alter table categorias      enable row level security;
alter table dias            enable row level security;
alter table refeicoes_dia   enable row level security;
alter table atividades_dia  enable row level security;
alter table liquidos_dia    enable row level security;
alter table consultas       enable row level security;
alter table medidas_extra   enable row level security;

-- Perfis: a linha é minha se o id dela for o meu.
create policy "perfil proprio" on perfis
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Restantes tabelas: a linha é minha se o user_id for o meu.
--   using       → que linhas posso LER, ALTERAR e APAGAR
--   with check  → que linhas posso CRIAR ou deixar depois de alterar
create policy "so os meus" on refeicoes_tipo
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "so os meus" on categorias
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "so os meus" on dias
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "so os meus" on refeicoes_dia
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "so os meus" on atividades_dia
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "so os meus" on liquidos_dia
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "so os meus" on consultas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "so os meus" on medidas_extra
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 12. PERFIL AUTOMÁTICO — quando alguém cria conta, cria-se logo
--     a linha dele na tabela perfis (vazia, por configurar).
-- ---------------------------------------------------------------------
create function criar_perfil_novo_utilizador()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into perfis (id, nome)
  values (new.id, new.raw_user_meta_data ->> 'full_name');  -- nome vem do Google, se houver
  return new;
end;
$$;

create trigger ao_criar_utilizador
  after insert on auth.users
  for each row execute function criar_perfil_novo_utilizador();


-- ---------------------------------------------------------------------
-- 13. PERMISSÕES — autorizar os utilizadores com sessão iniciada a
--     usar as tabelas. (O RLS acima continua a decidir QUE LINHAS cada
--     pessoa vê.) Os projetos novos do Supabase já não fazem isto sozinhos.
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
