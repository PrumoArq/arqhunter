-- ============================================================
-- ARQHunter — Schema do banco (Supabase / Postgres) — v1
-- ------------------------------------------------------------
-- COMO RODAR (sem me dar nenhuma chave):
--   1. No painel do Supabase, menu lateral → "SQL Editor".
--   2. "New query", cole TODO este arquivo e clique em "Run".
--   3. Se aparecer erro, me mande o texto do erro que eu corrijo.
--
-- Seguro rodar de novo: usa "if not exists" / "drop policy if exists".
-- O login dos usuários é o Supabase Auth (tabela auth.users, já existe).
-- Cada linha tem um "owner" = o usuário dono (auth.uid()), e o RLS garante
-- que cada pessoa só enxerga os próprios dados.
-- ============================================================

-- ---------- 1. PROSPECTS (negócios encontrados na busca) ----------
create table if not exists public.prospects (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  name          text not null,              -- nome do negócio
  category      text,                       -- nicho/categoria
  city          text,
  phone         text,
  whatsapp      text,                        -- só dígitos, ex.: 5521999999999
  instagram     text,
  site          text,                        -- null = sem site
  google_rating numeric(2,1),                -- ex.: 4.6
  reviews_count integer,                     -- nº de avaliações no Google
  source        text,                        -- 'maps' | 'instagram' | 'meta'
  site_score    integer,                     -- 0..100
  diagnosis     jsonb                        -- lista de itens do diagnóstico
);
create index if not exists prospects_owner_idx on public.prospects (owner);

-- ---------- 2. CRM_CARDS (prospect dentro do pipeline) ----------
create table if not exists public.crm_cards (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  stage       text not null default 'novo', -- novo|diagnostico|abordado|conversa|followup|fechado
  roidata_id  text,                          -- id do lead retornado pelo RoiData
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (prospect_id)                       -- um card por prospect
);
create index if not exists crm_cards_owner_stage_idx on public.crm_cards (owner, stage);

-- mantém o updated_at sempre atual
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists crm_cards_touch on public.crm_cards;
create trigger crm_cards_touch
  before update on public.crm_cards
  for each row execute function public.touch_updated_at();

-- ---------- 3. PREVIEW_SITES (prévias geradas pros clientes) ----------
-- Cada prévia tem validade: por padrão expira em 7 dias (o cron apaga depois).
create table if not exists public.preview_sites (
  id                   uuid primary key default gen_random_uuid(),
  owner                uuid not null references auth.users (id) on delete cascade,
  prospect_id          uuid references public.prospects (id) on delete set null,
  url                  text,                 -- endereço da prévia na Vercel
  vercel_deployment_id text,                 -- id do deploy (pra apagar depois)
  status               text not null default 'live', -- live|expired|removed
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null default (now() + interval '7 days')
);
create index if not exists preview_sites_expires_idx on public.preview_sites (expires_at)
  where status = 'live';

-- ============================================================
-- RLS (Row Level Security): cada usuário só acessa os próprios dados.
-- ============================================================
alter table public.prospects     enable row level security;
alter table public.crm_cards     enable row level security;
alter table public.preview_sites enable row level security;

-- prospects
drop policy if exists "prospects_own" on public.prospects;
create policy "prospects_own" on public.prospects
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- crm_cards
drop policy if exists "crm_cards_own" on public.crm_cards;
create policy "crm_cards_own" on public.crm_cards
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- preview_sites
drop policy if exists "preview_sites_own" on public.preview_sites;
create policy "preview_sites_own" on public.preview_sites
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- ============================================================
-- Pronto. Depois, no back-end (Vercel Functions), a gente usa a
-- SERVICE ROLE key do Supabase (guardada em env var, nunca no front)
-- pra inserir/atualizar esses registros.
-- ============================================================
