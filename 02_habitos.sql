-- =====================================================================
--  App de Hábitos — Atualização 2: "Outros hábitos" (ex.: creatina)
--
--  Como usar: SQL Editor > New query, cola TUDO e carrega em Run.
--  Corre-se UMA vez. Não apaga nem altera os dados que já tens.
-- =====================================================================

-- 1. As categorias passam a aceitar um terceiro tipo: 'habito'
--    (atividade = desporto, bebida = líquidos, habito = suplementos, etc.)
alter table categorias drop constraint if exists categorias_tipo_check;
alter table categorias add constraint categorias_tipo_check
  check (tipo in ('atividade', 'bebida', 'habito'));

-- 2. Que hábitos foram cumpridos em cada dia (uma linha por hábito feito)
create table habitos_dia (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  dia_id        uuid not null,
  categoria_id  uuid not null references categorias on delete cascade,
  foreign key (dia_id, user_id) references dias (id, user_id) on delete cascade,
  unique (dia_id, categoria_id)          -- cada hábito no máximo 1 vez por dia
);
create index on habitos_dia (dia_id);

-- 3. Segurança: cada pessoa só vê e altera as suas linhas
alter table habitos_dia enable row level security;
create policy "so os meus" on habitos_dia
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. Permissões para quem tem sessão iniciada
grant select, insert, update, delete on habitos_dia to authenticated;
