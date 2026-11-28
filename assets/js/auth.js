/* ============================================================
   ARQHunter — Autenticação (Supabase Auth)
   ------------------------------------------------------------
   Controla a "porta de entrada": enquanto não houver sessão, o
   app fica travado e aparece a tela de login. Ao entrar, o app
   aparece. O botão "Sair" encerra a sessão.

   Usa as chaves PÚBLICAS de assets/js/config.js. A verificação de
   senha e o "esqueci minha senha" são feitos pelo Supabase — a
   gente não guarda senha nenhuma aqui.
   ============================================================ */

(function () {
  const cfg = window.ARQHUNTER_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.startsWith("COLE_AQUI") &&
    !cfg.SUPABASE_ANON_KEY.startsWith("COLE_AQUI");

  // Cliente Supabase (só cria se as chaves estiverem preenchidas)
  let sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  window.ARQHUNTER_SB = sb; // disponível pro resto do app (prospects, crm…)

  /* ---------- elementos ---------- */
  const gate   = document.getElementById("authGate");
  const form   = document.getElementById("authForm");
  const email  = document.getElementById("authEmail");
  const pass   = document.getElementById("authPass");
  const submit = document.getElementById("authSubmit");
  const toggle = document.getElementById("authToggle");
  const note   = document.getElementById("authNote");
  const title  = document.getElementById("authTitle");
  const sub    = document.getElementById("authSub");
  const guest  = document.getElementById("authGuest");
  const warn   = document.getElementById("authConfigWarn");
  const whoami = document.getElementById("authWhoami");
  const logout = document.getElementById("authLogout");

  let mode = "login"; // "login" | "signup"

  /* ---------- travar / liberar o app ---------- */
  function lock()   { document.body.classList.add("is-locked"); }
  function unlock() { document.body.classList.remove("is-locked"); }

  function showGate() { if (gate) gate.hidden = false; lock(); }
  function hideGate() { if (gate) gate.hidden = true;  unlock(); }

  function setWhoami(userEmail) {
    if (whoami) whoami.textContent = userEmail || "";
    if (logout) logout.hidden = !userEmail;
  }

  function setNote(msg, kind) {
    if (!note) return;
    note.textContent = msg || "";
    note.hidden = !msg;
    note.className = "auth__note" + (kind ? " auth__note--" + kind : "");
  }

  /* ---------- alternar entrar / criar conta ---------- */
  function setMode(next) {
    mode = next;
    if (mode === "signup") {
      title.textContent  = "Criar conta";
      sub.textContent    = "Cadastre seu e-mail e uma senha para começar.";
      submit.textContent = "Criar conta";
      toggle.innerHTML   = "Já tem conta? <b>Entrar</b>";
    } else {
      title.textContent  = "Entrar no skadi";
      sub.textContent    = "Acesse sua operação de prospecção.";
      submit.textContent = "Entrar";
      toggle.innerHTML   = "Ainda não tem conta? <b>Criar conta</b>";
    }
    setNote("", null);
  }

  /* ---------- enviar (login ou cadastro) ---------- */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!sb) { setNote("Login ainda não configurado (faltam as chaves do Supabase).", "bad"); return; }

    const mail = email.value.trim();
    const pwd  = pass.value;
    if (!mail || !pwd) { setNote("Preencha e-mail e senha.", "bad"); return; }
    if (mode === "signup" && pwd.length < 6) { setNote("A senha precisa ter pelo menos 6 caracteres.", "bad"); return; }

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = mode === "signup" ? "Criando…" : "Entrando…";

    try {
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email: mail, password: pwd });
        if (error) throw error;
        if (data.session) {
          // confirmação de e-mail desligada → já entra
          onSignedIn(data.session);
        } else {
          // confirmação de e-mail ligada → precisa confirmar
          setNote("Conta criada! Confira seu e-mail para confirmar o acesso e depois entre.", "ok");
          setMode("login");
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email: mail, password: pwd });
        if (error) throw error;
        onSignedIn(data.session);
      }
    } catch (err) {
      setNote(traduzErro(err), "bad");
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  }

  /* mensagens de erro do Supabase em português amigável */
  function traduzErro(err) {
    const m = (err && err.message || "").toLowerCase();
    if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
    if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
    if (m.includes("already registered") || m.includes("already been registered")) return "Esse e-mail já tem conta. Tente entrar.";
    if (m.includes("rate limit")) return "Muitas tentativas. Espere um pouco e tente de novo.";
    return err && err.message ? err.message : "Algo deu errado. Tente de novo.";
  }

  /* ---------- sessão entrou / saiu ---------- */
  function onSignedIn(session) {
    const userEmail = session && session.user && session.user.email;
    setWhoami(userEmail);
    hideGate();
  }

  async function doLogout() {
    if (sb) { try { await sb.auth.signOut(); } catch (_) {} }
    setWhoami(null);
    if (email) email.value = "";
    if (pass)  pass.value  = "";
    setMode("login");
    showGate();
  }

  /* ---------- bypass de protótipo (sem back-end) ---------- */
  function enterAsGuest() {
    setWhoami(null);
    hideGate();
  }

  /* ---------- liga os eventos ---------- */
  if (form)   form.addEventListener("submit", handleSubmit);
  if (toggle) toggle.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
  if (guest)  guest.addEventListener("click", enterAsGuest);
  if (logout) logout.addEventListener("click", doLogout);

  /* ---------- arranque ---------- */
  async function boot() {
    setMode("login");

    if (!configured) {
      // ainda sem chaves: mostra a tela, avisa o que falta, mas deixa ver o protótipo
      if (warn)  warn.hidden = false;
      if (guest) guest.hidden = false;
      setWhoami(null);
      showGate();
      return;
    }

    if (!sb) {
      // chaves ok, mas a biblioteca do Supabase não carregou (ex.: sem internet
      // no preview). O login funciona quando o site estiver publicado.
      setNote("Não consegui carregar o Supabase agora (conexão). O login vai funcionar quando o site estiver publicado.", "bad");
      if (guest) guest.hidden = false;
      setWhoami(null);
      showGate();
      return;
    }

    if (warn) warn.hidden = true;
    // chaves ok: o bypass de protótipo some (porta de verdade)
    if (guest) guest.hidden = true;

    // já existe sessão salva? então entra direto.
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      onSignedIn(data.session);
    } else {
      setWhoami(null);
      showGate();
    }

    // reage a login/logout feitos em outras abas
    sb.auth.onAuthStateChange((_event, session) => {
      if (session) onSignedIn(session);
      else { setWhoami(null); showGate(); }
    });
  }

  // trava o app antes de qualquer coisa aparecer
  lock();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
