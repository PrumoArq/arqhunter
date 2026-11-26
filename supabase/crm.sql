-- ============================================================
-- ARQHunter — tabela do CRM (pipeline) — rode no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Guarda cada negócio que você salva no CRM, por usuário, com o estágio.
-- Assim seus leads NÃO somem quando você atualiza a página.
-- Seguro rodar de novo (if not exists / drop policy if exists).
-- ============================================================

create table if not exists public.crm_leads (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ext_id     text not null,                 -- id do negócio (ex.: Google place id)
  stage      text not null default 'novo',  -- novo|diagnostico|abordado|conversa|followup|fechado
  prospect   jsonb not null,                -- "foto" do negócio (nome, telefone, site, nota…)
  roidata_id text,                          -- id no RoiData (quando a integração ligar)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, ext_id)                    -- um card por negócio, por usuário
);
create index if not exists crm_leads_owner_idx on public.crm_leads (owner);

-- updated_at sempre atual (reusa a função se já existir do outro schema)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists crm_leads_touch on public.crm_leads;
create trigger crm_leads_touch
  before update on public.crm_leads
  for each row execute function public.touch_updated_at();

-- RLS: cada usuário só enxerga/edita os próprios leads
alter table public.crm_leads enable row level security;
drop policy if exists "crm_leads_own" on public.crm_leads;
create policy "crm_leads_own" on public.crm_leads
  for all using (owner = auth.uid()) with check (owner = auth.uid());
