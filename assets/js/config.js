/* ============================================================
   ARQHunter — configuração do Supabase (CHAVES PÚBLICAS)
   ------------------------------------------------------------
   Aqui vão SÓ os dois valores PÚBLICOS do seu projeto Supabase.
   Eles PODEM ficar no front-end — foram feitos pra isso. O que
   protege seus dados é o RLS (as policies que você já rodou).

   ONDE PEGAR (Supabase → ícone de engrenagem "Project Settings"
   → "API keys" / "Data API"):
     • URL             → "Project URL"            (ex.: https://abcd1234.supabase.co)
     • Chave pública   → "anon public" (ou "publishable key")  — começa com "eyJ..." ou "sb_publishable_..."

   ⚠️ NUNCA cole aqui a chave "service_role" (ou "secret key").
      Essa é secreta e vive só nos env vars do servidor (Vercel).
   ============================================================ */

window.ARQHUNTER_CONFIG = {
  SUPABASE_URL:      "https://vnevuzixflwqbviykijb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_MzLzZWbxOy4bCcC7abDkJQ_xB3jiPAV"
};
