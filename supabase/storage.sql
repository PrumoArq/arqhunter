-- ============================================================
-- ARQHunter — Storage pra imagens de referência — rode no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Cria um "balde" (bucket) chamado "referencias" onde as imagens que você
-- anexa a um prospect ficam guardadas. Cada usuário só sobe na própria pasta.
-- Seguro rodar de novo.
-- ============================================================

-- 1) o bucket (público pra leitura: a imagem pode ser usada no site gerado)
insert into storage.buckets (id, name, public)
values ('referencias', 'referencias', true)
on conflict (id) do nothing;

-- 2) quem está logado pode SUBIR só dentro da própria pasta (prefixo = seu id)
drop policy if exists "ref_upload_own" on storage.objects;
create policy "ref_upload_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'referencias'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) quem está logado pode ATUALIZAR/substituir os próprios arquivos
drop policy if exists "ref_update_own" on storage.objects;
create policy "ref_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'referencias'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4) leitura pública (bucket público) — pra a imagem abrir pelo link
drop policy if exists "ref_read_public" on storage.objects;
create policy "ref_read_public" on storage.objects
  for select to public
  using (bucket_id = 'referencias');
