-- =====================================================================
--  App de Hábitos — Atualização 3: Tarefas (to-do list)
--
--  Como usar: SQL Editor > New query, cola TUDO e carrega em Run.
--  Corre-se UMA vez. Não mexe nos dados que já tens.
-- =====================================================================

create table tarefas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  titulo         text not null,
  notas          text,
  -- Estados: por fazer → a fazer → feita / não feita
  estado         text not null default 'por_fazer'
                 check (estado in ('por_fazer', 'a_fazer', 'feita', 'nao_feita')),
  data           date,                                -- opcional: para quando é
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()   -- muda quando muda o estado
);
create index on tarefas (user_id, data);

-- Segurança: cada pessoa só vê e altera as suas tarefas
alter table tarefas enable row level security;
create policy "so os meus" on tarefas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Permissões para quem tem sessão iniciada
grant select, insert, update, delete on tarefas to authenticated;
