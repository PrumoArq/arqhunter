/* ============================================================
   ArcHunter — lógica do front-end (protótipo)
   Sem dependências. Estado em memória (reinicia ao recarregar).
   Pontos "TODO BACK-END" e "TODO CRM" marcam onde o servidor entra.
   ============================================================ */

const App = {
  prospects: [],          // resultados da última busca
  crm: {},                // { prospectId: { stage, prospect } }
  activeView: "busca",
  prospectFilter: "todos",
  prospectQuery: "",
  searched: false         // já rodou alguma busca? (pra mensagem de "vazio")
};

/* Integração com o CRM RoiData.
   IMPORTANTE: a chave (x-api-key) NUNCA fica aqui no front-end — ficaria visível
   pra qualquer um que abrir o site. O front chama o NOSSO back-end (mesmo
   domínio), e o back-end é quem adiciona a chave e fala com a RoiData.
   Veja o arquivo api/crm-lead.js.
   Enquanto o back-end não estiver no ar, deixe enabled=false: o prospect é
   salvo só no pipeline local (o board que você vê). */
const CRM_API = { enabled: false, endpoint: "/api/crm-lead" };

/* Busca real: o front chama nosso back-end /api/busca, que fala com o Google
   Places (a chave fica só no servidor). Se o back-end não responder (ex.: rodando
   local sem a chave), cai no modo demonstração com os dados de exemplo. */
const SEARCH_API = { endpoint: "/api/busca" };

/* ---------- helpers ---------- */
const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const scoreClass = (s) => (typeof s !== "number" ? "na" : s < 40 ? "bad" : s < 70 ? "warn" : "good");
const hasScore = (p) => typeof p.siteScore === "number";   // site já medido (PageSpeed)?
const notaStr  = (p) => (typeof p.notaGoogle === "number") ? p.notaGoogle.toFixed(1) : null;
const siteUrl  = (p) => p.site ? (/^https?:\/\//.test(p.site) ? p.site : "https://" + p.site) : null;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2200);
}

/* ============ NAVEGAÇÃO ============ */
function setView(view) {
  App.activeView = view;
  $$(".nav__item").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));
  $$(".view").forEach(v => v.classList.toggle("is-active", v.id === `view-${view}`));
  if (view === "painel") renderDashboard();
  if (view === "prospects") renderProspects();
  if (view === "crm") renderBoard();
}

/* ============ PAINEL / DASHBOARD ============ */
/* Gráficos em SVG puro (sem bibliotecas). Números são demonstrativos.
   TODO BACK-END: trocar os valores por métricas reais da conta do usuário. */
function svgSpark(vals, stroke) {
  const w = 120, h = 46, max = Math.max(...vals), min = Math.min(...vals);
  const pts = vals.map((v, i) => [i / (vals.length - 1) * w, h - 5 - ((v - min) / ((max - min) || 1)) * (h - 12)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${stroke}"/></svg>`;
}
function svgBars(vals, fill) {
  const w = 120, h = 46, n = vals.length, gap = 3, bw = (w - gap * (n - 1)) / n, max = Math.max(...vals);
  const r = vals.map((v, i) => {
    const bh = Math.max(3, (v / max) * (h - 6)), x = i * (bw + gap), y = h - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${fill}"/>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${r}</svg>`;
}
function svgArea(vals, stroke) {
  const w = 120, h = 46, max = Math.max(...vals), min = Math.min(...vals);
  const pts = vals.map((v, i) => [i / (vals.length - 1) * w, h - 5 - ((v - min) / ((max - min) || 1)) * (h - 12)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${line} L ${w} ${h} L 0 ${h} Z" fill="${stroke}" opacity=".18"/>
    <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function svgWeekChart(vals, labels) {
  const w = 580, h = 190, padX = 10, padB = 26, padT = 10;
  const n = vals.length, gap = 16, bw = ((w - padX * 2) - gap * (n - 1)) / n, max = Math.max(...vals);
  const bars = vals.map((v, i) => {
    const bh = (v / max) * (h - padB - padT), x = padX + i * (bw + gap), y = h - padB - bh;
    const last = i === n - 1;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="6" fill="${last ? "var(--brand)" : "#cfd4fb"}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="11" fill="var(--text-3)" font-weight="600">${labels[i]}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--text-2)" font-weight="700">${v}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}">${bars}</svg>`;
}

function renderDashboard() {
  const root = $("#dashRoot");
  if (!root) return;

  /* Métricas REAIS, a partir do estado atual do app.
     Começa zerado e vai preenchendo conforme você busca e move no CRM.
     (Em memória por enquanto: reinicia ao recarregar, até ter persistência.) */
  const prospectsWeek = App.prospects.length;
  const crmList = Object.values(App.crm);
  const noCrm = crmList.length;

  const c = { novo:0, diagnostico:0, abordado:0, conversa:0, followup:0, fechado:0 };
  crmList.forEach(e => { if (c[e.stage] != null) c[e.stage]++; });

  const contatados  = c.abordado + c.conversa + c.followup + c.fechado;
  const responderam = c.conversa + c.followup + c.fechado;
  const pct = (part, whole) => whole ? Math.round(part / whole * 100) + "%" : "—";
  const taxaResposta    = pct(responderam, contatados);
  const taxaConvertidos = pct(c.fechado, noCrm);

  const flat = [1,1,1,1,1,1,1]; // sem histórico ainda → linha neutra (decorativa)
  const stats = [
    { label: "Prospects na semana", num: String(prospectsWeek), chart: svgSpark(flat, "#fff"),   box: "dark"  },
    { label: "No CRM",              num: String(noCrm),         chart: svgSpark(flat, "#16d1b4"), box: "mint"  },
    { label: "Taxa de resposta",    num: taxaResposta,          chart: svgSpark(flat, "#6366f1"), box: "blue"  },
    { label: "Taxa de convertidos", num: taxaConvertidos,       chart: svgSpark(flat, "#16d1b4"), box: "plain" }
  ];
  const statCards = stats.map(s => `
    <div class="stat">
      <div class="stat__top"><div class="stat__icon">◴</div><div class="stat__label">${s.label}</div></div>
      <div class="stat__row2">
        <div class="stat__num">${s.num}</div>
      </div>
      <div class="stat__chart stat__chart--${s.box}">${s.chart}</div>
    </div>`).join("");

  // funil do pipeline (real)
  const pipe = [
    { label: "Novos", v: c.novo }, { label: "Diagnosticados", v: c.diagnostico }, { label: "Abordados", v: c.abordado },
    { label: "Em conversa", v: c.conversa }, { label: "Follow-up", v: c.followup }, { label: "Fechados", v: c.fechado }
  ];
  const pipeMax = Math.max(1, ...pipe.map(p => p.v));
  const pipeInner = noCrm === 0
    ? `<div class="dash-empty">Seu funil aparece aqui quando você mandar prospects pro CRM.</div>`
    : pipe.map(p => `
      <div class="pipe__row">
        <span class="pipe__label">${p.label}</span>
        <span class="pipe__bar"><span style="width:${(p.v / pipeMax * 100).toFixed(0)}%"></span></span>
        <span class="pipe__val">${p.v}</span>
      </div>`).join("");

  // últimos prospects (reais, da busca atual)
  const recentInner = prospectsWeek === 0
    ? `<div class="dash-empty">Nenhum prospect ainda. Rode uma busca em <b>Nova busca</b>.</div>`
    : App.prospects.slice(0, 5).map(p => `
      <div class="mini-list__row">
        <span class="mini-list__dot diag__dot--${p.site ? "warn" : "bad"}"></span>
        <div>
          <div class="mini-list__name">${p.nome}</div>
          <div class="mini-list__cat">${p.categoria} · ${(p.cidade || "").split("—")[0].trim()}</div>
        </div>
        <span class="mini-list__meta" style="color:${p.site ? "var(--warn)" : "var(--bad)"}">${p.site ? (hasScore(p) ? p.siteScore + "/100" : "a medir") : "sem site"}</span>
      </div>`).join("");

  root.innerHTML = `
    <div class="stat-row">${statCards}</div>

    <div class="dash-cols">
      <div class="dash-card">
        <div class="dash-card__head">
          <span class="dash-card__title">Prospecções — últimos 7 dias</span>
        </div>
        <div class="dash-empty">Sua atividade dos últimos 7 dias aparece aqui conforme você usar o ARQHunter.</div>
      </div>
      <div class="dash-card">
        <div class="dash-card__head"><span class="dash-card__title">Funil do pipeline</span></div>
        <div class="pipe">${pipeInner}</div>
      </div>
    </div>

    <div class="dash-cols">
      <div class="dash-card">
        <div class="dash-card__head">
          <span class="dash-card__title">Últimos prospects</span>
          <span class="dash-card__hint" id="dashSeeAll" style="cursor:pointer;color:var(--indigo)">ver todos ↗</span>
        </div>
        <div class="mini-list">${recentInner}</div>
      </div>
      <div class="cta-card">
        <div class="cta-card__title">Rode a busca do dia</div>
        <div class="cta-card__text">30 minutos por dia é o que separa quem espera indicação de quem escolhe cliente. Comece agora.</div>
        <button class="btn btn--sm" id="dashNewSearch">Nova busca</button>
      </div>
    </div>
  `;

  $("#dashNewSearch")?.addEventListener("click", () => setView("busca"));
  $("#dashSeeAll")?.addEventListener("click", () => setView("prospects"));
}

/* ============ BUSCA (simulada) ============ */
const SEARCH_STEPS = [
  "Conectando ao Google Maps…",
  "Coletando negócios do nicho…",
  "Buscando perfis no Instagram…",
  "Varrendo a biblioteca de anúncios (Meta)…",
  "Medindo os sites encontrados…",
  "Separando quem precisa de você…"
];

async function runSearch(params) {
  $("#searchHint").hidden = true;
  const box = $("#searching");
  box.hidden = false;
  const btn = $("#searchBtn");
  btn.disabled = true;

  // animação das etapas enquanto a busca acontece
  let i = 0;
  $("#searchingText").textContent = SEARCH_STEPS[0];
  const timer = setInterval(() => {
    i = (i + 1) % SEARCH_STEPS.length;
    $("#searchingText").textContent = SEARCH_STEPS[i];
  }, 650);

  let prospects = [];
  let usouDemo = false;

  try {
    // busca REAL: nosso back-end consulta o Google Places (chave fica no servidor)
    const res = await fetch(SEARCH_API.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nicho: params.nicho,
        cidade: params.cidade,
        filtro: params.filtro,
        fontes: params.fontes,
        abrangencia: params.abrangencia
      })
    });
    if (!res.ok) throw new Error("backend respondeu " + res.status);
    const data = await res.json();
    prospects = (data.prospects || []).map(p => ({ ...p, nicho: params.nicho }));
  } catch (err) {
    // sem back-end/chave (ex.: rodando local) → modo demonstração com os exemplos
    console.warn("Busca real indisponível, usando demonstração:", err);
    usouDemo = true;
    let results = MOCK_PROSPECTS.filter(p => params.fontes.includes(p.fonte));
    if (params.filtro === "sem-site") results = results.filter(p => !p.site);
    else if (params.filtro === "precisa") results = results.filter(p => !p.site || p.siteScore < 70);
    prospects = results.map(p => ({ ...p, nicho: params.nicho, cidade: params.cidade || p.cidade }));
  }

  clearInterval(timer);
  box.hidden = true;
  btn.disabled = false;

  App.prospects = prospects;
  App.searched = true;
  updateCounts();
  const scope = params.cidade || "sua busca";
  toast(usouDemo
    ? `Modo demonstração · ${App.prospects.length} negócios`
    : `${App.prospects.length} negócios · ${scope}`);
  setView("prospects");
}

/* ============ PROSPECTS ============ */
function renderProspects() {
  const list = $("#prospectList");
  const empty = $("#prospectsEmpty");

  let items = App.prospects.filter(p => {
    if (App.prospectFilter === "sem-site" && p.site) return false;          // sem site real (inclui "só link")
    if (App.prospectFilter === "site-fraco" && !(!p.site && p.siteFraco)) return false; // só link
    if (App.prospectQuery && !p.nome.toLowerCase().includes(App.prospectQuery.toLowerCase())) return false;
    return true;
  });

  empty.hidden = App.prospects.length > 0;
  if (!App.prospects.length) {
    empty.innerHTML = App.searched
      ? `<p>Nenhum negócio com esses filtros. Tente outra <b>cidade</b> ou deixe o filtro em <b>“Todos os negócios”</b>. <br><span style="color:var(--text-3)">(muitos nichos já têm site — o filtro de <b>site ruim</b> por velocidade/SEO chega com a medição do PageSpeed, a próxima etapa.)</span></p>`
      : `<p>Nenhum prospect ainda. Rode uma busca em <b>Nova busca</b>.</p>`;
  }
  list.innerHTML = items.map(cardProspect).join("");

  // resumo dos resultados (igual à "cara" do MIRA)
  const summary = $("#prospectSummary");
  if (summary) {
    const all = App.prospects;
    if (!all.length) { summary.hidden = true; }
    else {
      summary.hidden = false;
      const comTel  = all.filter(p => p.telefone).length;
      const fracos  = all.filter(p => !p.site && p.siteFraco).length;
      const semSite = all.filter(p => !p.site && !p.siteFraco).length;
      summary.innerHTML = `
        <span class="rs__item"><b>${all.length}</b> negócios</span>
        <span class="rs__item"><b>${comTel}</b> com telefone</span>
        <span class="rs__item rs__item--warn"><b>${fracos}</b> só link</span>
        <span class="rs__item rs__item--bad"><b>${semSite}</b> sem site</span>`;
    }
  }

  $$(".prospect", list).forEach(el =>
    el.addEventListener("click", () => openDrawer(el.dataset.id))
  );
}

function cardProspect(p) {
  const inCrm = !!App.crm[p.id];
  const fraco = !p.site && !!p.siteFraco;   // só link (WhatsApp/Linktree) = oportunidade
  // sem site / site fraco = oportunidade; com site = "a medir" até rodar o PageSpeed
  const siteTag = p.site
    ? (hasScore(p) ? `<span class="tag tag--warn">Site ruim</span>` : `<span class="tag tag--src">Com site</span>`)
    : (fraco ? `<span class="tag tag--warn">Site fraco</span>` : `<span class="tag tag--bad">Sem site</span>`);
  const srcTag = `<span class="tag tag--src">${FONTES[p.fonte] || "Maps"}</span>`;
  const crmTag = inCrm ? `<span class="tag tag--good">No CRM</span>` : "";

  // bloco do score
  const sc = p.site ? (hasScore(p) ? scoreClass(p.siteScore) : "na") : (fraco ? "warn" : "bad");
  const scoreNum = (p.site && hasScore(p)) ? p.siteScore : "–";
  const scoreLbl = p.site ? (hasScore(p) ? "site" : "a medir") : (fraco ? "só link" : "sem site");

  const nota = notaStr(p);
  const avalTxt = nota ? `★ ${nota} · ${p.avaliacoes} aval.` : (p.avaliacoes ? `${p.avaliacoes} aval.` : "sem avaliações");

  return `
  <article class="prospect" data-id="${p.id}">
    <div class="prospect__main">
      <div class="prospect__name">${p.nome} ${siteTag} ${srcTag} ${crmTag}</div>
      <div class="prospect__meta">
        <span>${p.categoria}</span>
        <span>${avalTxt}</span>
        <span>${p.telefone || "sem telefone"}</span>
        <span>${p.site || (fraco ? "só link (WhatsApp/Linktree)" : "sem site")}</span>
      </div>
    </div>
    <div class="prospect__right">
      <div class="score score--${sc}">
        <div class="score__num">${scoreNum}</div>
        <div class="score__label">${scoreLbl}</div>
      </div>
    </div>
  </article>`;
}

/* Projeção "depois do ARQHunter" (placeholder — vira dado real do back-end
   quando a gente medir o site atual E o site novo que você criar). */
function projectedScore(p) {
  if (typeof p.previewScore === "number") return p.previewScore; // MEDIDO (site novo real)
  if (!p.site) return 95;                 // sem site → site novo nasce forte
  return hasScore(p) ? Math.min(97, p.siteScore + 60) : null; // estimativa até medir
}
function improvedValue(nome) {
  const map = {
    "Site existe": "Novo site no ar",
    "Mobile": "100% responsivo",
    "Velocidade": "~1,0s",
    "SSL (cadeado)": "Ativo (HTTPS)",
    "SEO básico": "Títulos + metas ok",
    "Presença": "Site + Maps + Insta",
    "Agendamento online": "Online no site",
    "Agendamento": "Online no site",
    "Portfólio": "Portfólio no site",
    "Link na bio": "Site próprio",
    "Matrícula online": "Matrícula no site",
    "Cardápio online": "Cardápio rápido",
    "Busca de imóveis": "Busca rápida",
    "Design": "Design atual 2026"
  };
  return map[nome] || "Resolvido";
}

/* ============ DRAWER (detalhe + abordagem) ============ */
function openDrawer(id) {
  // procura na última busca; se não achar, pega do CRM (negócio já salvo)
  const p = App.prospects.find(x => x.id === id) || (App.crm[id] && App.crm[id].prospect);
  if (!p) return;

  const temDiag = Array.isArray(p.diagnostico) && p.diagnostico.length > 0;
  const proj = projectedScore(p);
  const nota = notaStr(p);
  const site = siteUrl(p);

  let diagnosticoHtml;
  if (temDiag) {
    const now = p.site ? p.siteScore : 0;
    const delta = (proj != null) ? proj - now : null;
    const diagRows = p.diagnostico.map(d => `
      <div class="diag__row">
        <span class="diag__dot diag__dot--${d.status}"></span>
        <span class="diag__name">${d.nome}</span>
        <span class="diag__val">${d.valor}</span>
        <span class="diag__after">→ ${improvedValue(d.nome)}</span>
      </div>`).join("");
    diagnosticoHtml = `
      <div class="section-label">Diagnóstico — hoje × depois</div>
      <div class="compare">
        <div class="compare__col compare__col--now">
          <div class="compare__cap">Site hoje</div>
          <div class="compare__score">${p.site ? now : "—"}<small>/100</small></div>
        </div>
        <div class="compare__col compare__col--after">
          <div class="compare__cap">Com o ARQHunter ${typeof p.previewScore === "number" ? "(medido)" : "(estimado)"}</div>
          <div class="compare__score">${proj}<small>/100</small></div>
          ${delta != null ? `<div class="compare__delta">▲ +${delta} pts</div>` : ""}
        </div>
      </div>
      <div class="diag">${diagRows}</div>`;
  } else {
    // dados reais do Google: o site ainda não foi medido (PageSpeed = próxima etapa)
    const fraco = !p.site && p.siteFraco;
    diagnosticoHtml = `
      <div class="section-label">Diagnóstico do site</div>
      <div class="diag-pending">
        ${p.site
          ? `Site encontrado: <a href="${site}" target="_blank" rel="noopener">${p.site.replace(/^https?:\/\//, "")}</a>.<br>Meça agora pra ver o score real e o “hoje × depois”.<div style="margin-top:12px"><button class="btn btn--sm btn--brand" id="medirBtn">⚡ Medir site (~20s)</button></div>`
          : (fraco
              ? `Este negócio <b>não tem site de verdade</b> — só um link (<a href="${p.siteFraco}" target="_blank" rel="noopener">${p.siteFraco.replace(/^https?:\/\//, "").slice(0, 40)}…</a>). Oportunidade clara pra criar um site profissional. 🎯`
              : `Este negócio <b>não tem site</b> — oportunidade clara pra criar um do zero. 🎯`)}
      </div>`;
  }

  const stage = App.crm[id]?.stage || "";
  const stageOptions = CRM_STAGES.map(s =>
    `<option value="${s.id}" ${s.id === stage ? "selected" : ""}>${s.label}</option>`).join("");

  $("#drawerInner").innerHTML = `
    <div class="drawer__head">
      <h2 class="drawer__title">${p.nome}</h2>
      <button class="drawer__close" id="drawerClose">×</button>
    </div>
    <div class="drawer__meta">
      <span>${p.categoria}${p.cidade ? " · " + p.cidade : ""}</span>
      <span>${nota ? `★ ${nota} no Google` : "sem nota no Google"} · ${p.telefone || "sem telefone"}</span>
      <span>${p.site ? `🌐 ${p.site}` : "Sem site"}${p.instagram ? " · " + p.instagram : ""}</span>
    </div>

    ${diagnosticoHtml}

    <div class="section-label">Abordagem gerada</div>
    <textarea class="message" id="messageBox">${generateMessage(p)}</textarea>
    <div class="drawer__actions">
      <button class="btn btn--sm" id="copyBtn">Copiar mensagem</button>
      <button class="btn btn--sm btn--ghost" id="regenBtn">Gerar outra</button>
    </div>

    <div class="section-label">Contato</div>
    <div class="drawer__actions">
      ${p.site ? `<button class="btn btn--sm" id="openSiteBtn">Abrir site ↗</button>` : ""}
      ${p.whatsapp ? `<button class="btn btn--sm btn--brand" id="waBtn">WhatsApp ↗</button>` : ""}
      ${p.instagram ? `<button class="btn btn--sm" id="igBtn">Instagram ↗</button>` : ""}
      ${p.mapsUrl ? `<button class="btn btn--sm btn--ghost" id="mapsBtn">Ver no Maps ↗</button>` : ""}
    </div>

    <div class="section-label">Referência pro site novo</div>
    <div class="siteref">
      <input class="field__input" id="refLink" placeholder="Cole um link de referência (site que você curtiu)…" value="${(p.refLink || "").replace(/"/g, "&quot;")}" />
      <div class="siteref__row">
        <label class="btn btn--sm btn--ghost" for="refFile">📎 Anexar imagem</label>
        <input type="file" id="refFile" accept="image/*" hidden />
        <span class="siteref__name" id="refFileName">${p.refImageUrl ? "imagem anexada ✓" : ""}</span>
      </div>
      ${p.refImageUrl ? `<a href="${p.refImageUrl}" target="_blank" rel="noopener"><img src="${p.refImageUrl}" class="siteref__thumb" alt="referência" /></a>` : ""}
      <button class="btn btn--sm btn--brand btn--block" id="refSaveBtn">Salvar referência</button>
      <p class="siteref__hint">Fica salvo no negócio (entra no seu CRM). Na hora de gerar o site, eu uso essa referência.</p>

      <div class="siteref__div"></div>
      <span class="field__label" style="font-size:11px">Prévia do site novo</span>
      <input class="field__input" id="previewUrl" placeholder="Cole o link da prévia gerada (arqhunter.vercel.app/p/…)" value="${(p.previewUrl || "").replace(/"/g, "&quot;")}" />
      <button class="btn btn--sm btn--block" id="previewSaveBtn">Salvar prévia</button>
      ${p.previewUrl ? `
      <div class="siteref__row">
        <a class="btn btn--sm btn--brand" href="${p.previewUrl}" target="_blank" rel="noopener">🔗 Abrir prévia</a>
        <button class="btn btn--sm btn--ghost" id="medirNovoBtn">⚡ Medir site novo</button>
      </div>
      ${typeof p.previewScore === "number"
        ? `<p class="siteref__hint">✅ Site novo: <b style="color:var(--good)">${p.previewScore}/100</b>${hasScore(p) ? ` &nbsp;·&nbsp; hoje <b>${p.siteScore}</b> → depois <b style="color:var(--good)">${p.previewScore}</b>` : ""}</p>`
        : `<p class="siteref__hint">Clique em “Medir site novo” pra preencher o “depois” real.</p>`}
      ` : ""}
    </div>

    <div class="section-label">CRM</div>
    <div class="status-row">
      <select class="field__input" id="stageSelect">
        <option value="">— escolher estágio —</option>
        ${stageOptions}
      </select>
    </div>
    <div class="drawer__actions">
      <button class="btn btn--primary btn--block" id="toCrmBtn">
        ${App.crm[id] ? "Atualizar no CRM" : "Adicionar ao CRM"}
      </button>
    </div>
  `;

  // listeners
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#copyBtn").addEventListener("click", () => {
    navigator.clipboard?.writeText($("#messageBox").value);
    toast("Mensagem copiada.");
  });
  $("#regenBtn").addEventListener("click", () => {
    $("#messageBox").value = generateMessage(p, true);
  });
  /* Ações de contato. TODO BACK-END: registrar no CRM que o contato foi aberto. */
  $("#openSiteBtn")?.addEventListener("click", () => window.open(siteUrl(p), "_blank"));
  $("#medirBtn")?.addEventListener("click", async () => {
    const btn = $("#medirBtn");
    btn.disabled = true;
    btn.textContent = "Medindo o site… (~20s)";
    try {
      const r = await fetch("/api/medir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: p.site })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "falhou");
      p.siteScore = d.siteScore;
      p.diagnostico = Array.isArray(d.diagnostico) ? d.diagnostico : [];
      // se já está no CRM, salva a medição junto (persiste no Supabase)
      if (App.crm[p.id]) { App.crm[p.id].prospect = p; crmSave(App.crm[p.id]); }
      renderProspects();
      openDrawer(p.id);                 // re-renderiza já com o "hoje × depois" real
      toast(`Site medido: ${d.siteScore}/100`);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "⚡ Medir site (~20s)";
      toast("Não consegui medir agora. Tente de novo em instantes.");
      console.warn("medir:", e.message || e);
    }
  });
  $("#waBtn")?.addEventListener("click", () => {
    const msg = encodeURIComponent($("#messageBox").value);
    window.open(`https://wa.me/${p.whatsapp}?text=${msg}`, "_blank");
  });
  $("#igBtn")?.addEventListener("click", () =>
    window.open("https://instagram.com/" + p.instagram.replace("@", ""), "_blank"));
  $("#mapsBtn")?.addEventListener("click", () => window.open(p.mapsUrl, "_blank"));
  // referência pro site novo (link + imagem)
  $("#refFile")?.addEventListener("change", (e) => {
    const f = e.target.files[0];
    $("#refFileName").textContent = f ? f.name : "";
  });
  $("#refSaveBtn")?.addEventListener("click", async () => {
    const btn = $("#refSaveBtn");
    const link = $("#refLink").value.trim();
    const file = $("#refFile").files[0];
    if (!link && !file && !p.refImageUrl) { toast("Cole um link ou anexe uma imagem."); return; }
    btn.disabled = true; btn.textContent = "Salvando…";
    try {
      let imgUrl = p.refImageUrl || null;
      if (file) {
        const sb = window.ARQHUNTER_SB;
        if (!sb) throw new Error("sem supabase");
        const { data: { session } } = await sb.auth.getSession();
        const uid = session && session.user && session.user.id;
        if (!uid) throw new Error("sem sessão");
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${p.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await sb.storage.from("referencias").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        imgUrl = sb.storage.from("referencias").getPublicUrl(path).data.publicUrl;
      }
      p.refLink = link || null;
      p.refImageUrl = imgUrl;
      // persiste junto do negócio (cria no CRM se ainda não estiver)
      if (!App.crm[p.id]) App.crm[p.id] = { stage: "novo", prospect: p };
      App.crm[p.id].prospect = p;
      crmSave(App.crm[p.id]);
      updateCounts(); renderProspects();
      openDrawer(p.id);
      toast("Referência salva. ✓");
    } catch (err) {
      btn.disabled = false; btn.textContent = "Salvar referência";
      const msg = /bucket|not found|referencias|storage/i.test(String(err.message || err))
        ? "Pra anexar imagem, rode o SQL do Storage primeiro (te mandei). O link já salva."
        : "Não consegui salvar agora. Tente de novo.";
      toast(msg);
      console.warn("ref salvar:", err.message || err);
    }
  });

  // prévia do site novo
  $("#previewSaveBtn")?.addEventListener("click", () => {
    const url = $("#previewUrl").value.trim();
    p.previewUrl = url || null;
    if (!url) p.previewScore = null;
    if (!App.crm[p.id]) App.crm[p.id] = { stage: "novo", prospect: p };
    App.crm[p.id].prospect = p;
    crmSave(App.crm[p.id]);
    updateCounts(); renderProspects(); renderBoard();
    openDrawer(p.id);
    toast(url ? "Prévia salva. ✓" : "Prévia removida.");
  });
  $("#medirNovoBtn")?.addEventListener("click", async () => {
    const btn = $("#medirNovoBtn");
    btn.disabled = true; btn.textContent = "Medindo… (~20s)";
    try {
      const r = await fetch("/api/medir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: p.previewUrl })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "falhou");
      p.previewScore = d.siteScore;
      if (App.crm[p.id]) { App.crm[p.id].prospect = p; crmSave(App.crm[p.id]); }
      renderProspects();
      openDrawer(p.id);
      toast(`Site novo: ${d.siteScore}/100 🎉`);
    } catch (e) {
      btn.disabled = false; btn.textContent = "⚡ Medir site novo";
      toast("Não consegui medir agora. Tente de novo.");
    }
  });

  $("#toCrmBtn").addEventListener("click", () => {
    const st = $("#stageSelect").value || "novo";
    addToCrm(p, st);
  });

  $("#drawer").hidden = false;
  $("#drawerOverlay").hidden = false;
}
function closeDrawer() {
  $("#drawer").hidden = true;
  $("#drawerOverlay").hidden = true;
}

/* ---- gerador de abordagem (placeholder da IA) ---- */
function generateMessage(p, variant = false) {
  /* TODO BACK-END:
     Trocar por chamada à IA no servidor (a chave NUNCA fica no front):
       const r = await fetch("/api/abordagem", { method:"POST", body: JSON.stringify(p) });
       return (await r.json()).mensagem;
     Abaixo, só um texto montado com os dados do diagnóstico. */
  const pontos = (p.diagnostico || []).filter(d => d.status !== "good").map(d => d.nome.toLowerCase()).slice(0, 2).join(" e ");
  const problema = !p.site
    ? "não achei um site de vocês — hoje quem procura no Google acaba indo pro concorrente que tem"
    : (pontos
        ? `dei uma olhada no site de vocês e encontrei alguns pontos que estão custando clientes (${pontos})`
        : "achei o site de vocês e acho que dá pra deixar ele bem mais forte — mais rápido, aparecendo melhor no Google e redondo no celular");

  const aberturas = [
    `Oi! Encontrei a ${p.nome} aqui no ${FONTES[p.fonte] === "Instagram" ? "Instagram" : "Google"} e me chamou atenção.`,
    `Olá! Tava procurando ${p.categoria.toLowerCase()} na região e cheguei na ${p.nome}.`
  ];
  const abertura = aberturas[variant ? 1 : 0];

  // ângulo das avaliações (igual ao MIRA): prova social que o site não mostra
  const reviews = p.avaliacoes >= 100
    ? `\n\nVocês têm ${p.avaliacoes} avaliações${notaStr(p) ? ` (${notaStr(p)}★)` : ""} no Google — mas o site não conta nada dessa história.`
    : "";

  return `${abertura}

Pra ajudar, ${problema}.${reviews}

Tomei a iniciativa de montar um diagnóstico rápido e uma prévia de como ficaria melhor — sem compromisso. Posso te mandar?

Com quem eu falo sobre isso?`;
}

/* ============ CRM ============ */
/* Monta o corpo exatamente como a API do RoiData espera
   (name obrigatório; phone, email, company, notes, source). */
function buildLeadPayload(p, stage) {
  const etapa = CRM_STAGES.find(s => s.id === stage)?.label || "";
  return {
    name: p.nome,
    phone: p.whatsapp,
    // email: não temos no protótipo — viria do enriquecimento no back-end
    company: p.nome,
    notes: [
      "Origem: ARQHunter",
      `${p.categoria}${p.cidade ? " · " + p.cidade : ""}`,
      `Site: ${p.site || "sem site"}${(p.site && hasScore(p)) ? ` (score ${p.siteScore}/100)` : ""}`,
      p.instagram ? `Instagram: ${p.instagram}` : "",
      `Avaliações: ${p.avaliacoes}${notaStr(p) ? ` (${notaStr(p)}★)` : ""}`,
      etapa ? `Etapa: ${etapa}` : ""
    ].filter(Boolean).join(" · "),
    source: "ARQHunter"
  };
}

/* Mapa: estágio do nosso kanban → status aceito pelo RoiData.
   (Mapeamento sugerido pelo RoiData; edite à vontade.) */
const ROIDATA_STATUS = {
  novo:        "novo",
  diagnostico: "novo",
  abordado:    "primeiro_contato",
  conversa:    "primeiro_contato",
  followup:    "em_negociacao",
  fechado:     "ganho"
};
const statusFor = (stage) => ROIDATA_STATUS[stage] || "novo";

/* Fala com o RoiData SEMPRE via nosso back-end (api/crm-lead.js), que injeta a
   chave. method "POST" cria o lead; "PATCH" atualiza o status. */
async function roidataSend(method, payload) {
  const res = await fetch(CRM_API.endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/* Cria o lead no RoiData, guarda o id retornado e já acerta o status
   conforme a coluna escolhida. Best-effort (não trava o pipeline local). */
async function roidataSync(prospectId, stage) {
  const entry = App.crm[prospectId];
  if (!entry) return;
  try {
    const created = await roidataSend("POST", buildLeadPayload(entry.prospect, stage));
    if (created && created.id) {
      entry.roidataId = created.id;
      await roidataSend("PATCH", { id: created.id, status: statusFor(stage) });
    }
  } catch (err) {
    console.warn("CRM RoiData (criar):", err);
  }
}

/* ---- Persistência do CRM no Supabase (tabela crm_leads) ----
   Se não houver login/Supabase (ex.: rodando local), fica só na memória. */
async function crmSave(entry) {
  const sb = window.ARQHUNTER_SB;
  if (!sb || !entry || !entry.prospect) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    const uid = session && session.user && session.user.id;
    if (!uid) return;  // sem sessão → não dá pra salvar
    const { error } = await sb.from("crm_leads").upsert(
      { owner: uid, ext_id: entry.prospect.id, stage: entry.stage, prospect: entry.prospect },
      { onConflict: "owner,ext_id" }
    );
    if (error) throw error;
  } catch (e) { console.warn("CRM salvar:", e.message || e); }
}

async function crmLoad() {
  const sb = window.ARQHUNTER_SB;
  if (!sb) return;
  try {
    const { data, error } = await sb.from("crm_leads").select("ext_id, stage, prospect, roidata_id");
    if (error) throw error;
    App.crm = {};
    (data || []).forEach(r => {
      if (r.prospect) App.crm[r.ext_id] = { stage: r.stage, prospect: r.prospect, roidataId: r.roidata_id || null };
    });
    updateCounts();
    renderBoard();
    if (App.activeView === "painel") renderDashboard();
  } catch (e) { console.warn("CRM carregar:", e.message || e); }
}

function addToCrm(p, stage) {
  // 1) pipeline local (sempre) — é o que aparece no board do CRM
  App.crm[p.id] = { stage, prospect: p };
  updateCounts();
  renderProspects();
  closeDrawer();
  toast(`${p.nome} → ${CRM_STAGES.find(s => s.id === stage)?.label}`);

  // 2) salva no Supabase pra NÃO sumir ao atualizar a página
  crmSave(App.crm[p.id]);

  // 3) (parado) envia pro RoiData via back-end quando CRM_API.enabled = true
  if (CRM_API.enabled) roidataSync(p.id, stage);
}

function renderBoard() {
  // resumo de métricas no topo (reais, a partir do estado atual)
  const crmStats = $("#crmStats");
  if (crmStats) {
    const crmList = Object.values(App.crm);
    const noCrm = crmList.length;
    const c = { novo:0, diagnostico:0, abordado:0, conversa:0, followup:0, fechado:0 };
    crmList.forEach(e => { if (c[e.stage] != null) c[e.stage]++; });
    const contatados  = c.abordado + c.conversa + c.followup + c.fechado;
    const responderam = c.conversa + c.followup + c.fechado;
    const pct = (part, whole) => whole ? Math.round(part / whole * 100) + "%" : "—";
    const cards = [
      { label: "Prospects na semana", num: String(App.prospects.length) },
      { label: "No CRM",              num: String(noCrm) },
      { label: "Taxa de resposta",    num: pct(responderam, contatados) },
      { label: "Taxa de convertidos", num: pct(c.fechado, noCrm) }
    ];
    crmStats.innerHTML = cards.map(c => `
      <div class="crm-stat">
        <div class="crm-stat__label">${c.label}</div>
        <div class="crm-stat__num">${c.num}</div>
      </div>`).join("");
  }

  const board = $("#board");
  board.innerHTML = CRM_STAGES.map(stage => {
    const cards = Object.values(App.crm).filter(c => c.stage === stage.id);
    const cardsHtml = cards.length
      ? cards.map(c => cardCrm(c.prospect)).join("")
      : `<div class="card__empty">—</div>`;
    return `
      <div class="column">
        <div class="column__head">
          <span class="column__title">${stage.label}</span>
          <span class="column__count">${cards.length}</span>
        </div>
        <div class="column__body" data-stage="${stage.id}">${cardsHtml}</div>
      </div>`;
  }).join("");

  setupDragDrop();
}

function cardCrm(p) {
  return `
  <div class="card" draggable="true" data-id="${p.id}">
    <div class="card__name">${p.nome}</div>
    <div class="card__meta">
      <span>${p.categoria}</span>
      <span>·</span>
      <span>${p.site ? (hasScore(p) ? p.siteScore + "/100" : "a medir") : "sem site"}</span>
    </div>
  </div>`;
}

/* ---- drag & drop entre colunas ---- */
function setupDragDrop() {
  let dragId = null;

  $$(".card").forEach(card => {
    let moved = false;
    card.addEventListener("dragstart", () => {
      dragId = card.dataset.id;
      moved = true;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      setTimeout(() => (moved = false), 0);
    });
    // clicar no card (sem arrastar) reabre o detalhe do negócio
    card.addEventListener("click", () => { if (!moved) openDrawer(card.dataset.id); });
  });

  $$(".column__body").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("is-drop"); });
    col.addEventListener("dragleave", () => col.classList.remove("is-drop"));
    col.addEventListener("drop", e => {
      e.preventDefault();
      col.classList.remove("is-drop");
      if (dragId && App.crm[dragId]) {
        const entry = App.crm[dragId];
        entry.stage = col.dataset.stage;
        renderBoard();
        crmSave(entry);   // persiste o novo estágio no Supabase

        // atualiza o status no RoiData (via back-end). Usa o id do lead;
        // se ainda não tiver, o RoiData aceita identificar pelo telefone.
        if (CRM_API.enabled) {
          const payload = entry.roidataId
            ? { id: entry.roidataId, status: statusFor(entry.stage) }
            : { phone: entry.prospect.whatsapp, status: statusFor(entry.stage) };
          roidataSend("PATCH", payload).catch(err => console.warn("CRM RoiData (status):", err));
        }
      }
    });
  });
}

/* ============ CONTADORES ============ */
function updateCounts() {
  $("#navProspectsCount").textContent = App.prospects.length;
  $("#navCrmCount").textContent = Object.keys(App.crm).length;
}

/* ============ COMBOBOX (nicho e cidade) ============
   Clicar no campo abre uma lista; digitar filtra (nicho) ou puxa sugestões
   do Google (cidade). Dá pra escolher uma opção OU digitar livre. */
function setupCombo(input, { source, minChars = 0, debounce = 0, caret = false }) {
  if (!input) return;
  const field = input.closest(".field") || input.parentElement;
  field.classList.add("field--combo");
  if (caret) field.classList.add("field--combo-caret");
  const pop = document.createElement("div");
  pop.className = "combo-pop";
  pop.hidden = true;
  field.appendChild(pop);

  let items = [];
  let active = -1;

  function render(list) {
    items = list || [];
    active = -1;
    if (!items.length) { pop.hidden = true; return; }
    pop.innerHTML = items.map((t, i) => `<div class="combo-opt" data-i="${i}">${t}</div>`).join("");
    pop.hidden = false;
  }
  async function update() {
    const q = input.value.trim();
    if (q.length < minChars) { if (minChars === 0) render(await source("")); else pop.hidden = true; return; }
    render(await source(q));
  }
  function pick(i) {
    if (items[i] == null) return;
    input.value = items[i];
    pop.hidden = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  let t;
  const fire = () => { if (debounce) { clearTimeout(t); t = setTimeout(update, debounce); } else update(); };
  input.addEventListener("focus", update);
  input.addEventListener("click", update);
  input.addEventListener("input", fire);
  input.addEventListener("blur", () => setTimeout(() => (pop.hidden = true), 140));
  input.addEventListener("keydown", (e) => {
    if (pop.hidden) return;
    const opts = [...pop.children];
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, opts.length - 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(active); return; }
    else if (e.key === "Escape") { pop.hidden = true; return; }
    else return;
    opts.forEach((o, i) => o.classList.toggle("is-active", i === active));
    if (opts[active]) opts[active].scrollIntoView({ block: "nearest" });
  });
  pop.addEventListener("mousedown", (e) => {        // mousedown p/ vir antes do blur
    const opt = e.target.closest(".combo-opt");
    if (!opt) return;
    e.preventDefault();
    pick(+opt.dataset.i);
  });
}

/* fonte de sugestões de cidade: nosso back-end -> Google Places Autocomplete */
async function cidadeSource(q) {
  if (q.length < 3) return [];
  try {
    const r = await fetch("/api/autocomplete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q })
    });
    if (!r.ok) return [];
    const d = await r.json();
    return d.cidades || [];
  } catch { return []; }
}

/* ============ BOOT ============ */
document.addEventListener("DOMContentLoaded", () => {
  // nav
  $$(".nav__item").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  // busca
  $("#searchForm").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    runSearch({
      nicho: fd.get("nicho"),
      cidade: fd.get("cidade"),
      fontes: fd.getAll("fonte"),
      abrangencia: fd.get("abrangencia"),
      filtro: fd.get("filtro")
    });
  });

  // comboboxes do formulário de busca
  const semAcento = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  setupCombo($('input[name="nicho"]'), {
    minChars: 0, caret: true,
    source: (q) => { const ql = semAcento(q.trim()); return ql ? NICHOS.filter(n => semAcento(n).includes(ql)) : NICHOS; }
  });
  setupCombo($('input[name="cidade"]'), { minChars: 3, debounce: 300, source: cidadeSource });

  // filtros prospects
  $$(".filter").forEach(f => f.addEventListener("click", () => {
    $$(".filter").forEach(x => x.classList.remove("is-active"));
    f.classList.add("is-active");
    App.prospectFilter = f.dataset.filter;
    renderProspects();
  }));
  $("#prospectSearch").addEventListener("input", e => {
    App.prospectQuery = e.target.value;
    renderProspects();
  });

  // drawer overlay
  $("#drawerOverlay").addEventListener("click", closeDrawer);

  updateCounts();
  renderDashboard();

  // carrega o CRM salvo no Supabase (persistência) e reage a login/logout
  const sb = window.ARQHUNTER_SB;
  if (sb) {
    crmLoad();
    sb.auth.onAuthStateChange((_e, session) => {
      if (session) crmLoad();
      else { App.crm = {}; updateCounts(); renderBoard(); renderDashboard(); }
    });
  }
});
