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
  prospectQuery: ""
};

/* Integração com o CRM RoiData.
   IMPORTANTE: a chave (x-api-key) NUNCA fica aqui no front-end — ficaria visível
   pra qualquer um que abrir o site. O front chama o NOSSO back-end (mesmo
   domínio), e o back-end é quem adiciona a chave e fala com a RoiData.
   Veja o arquivo api/crm-lead.js.
   Enquanto o back-end não estiver no ar, deixe enabled=false: o prospect é
   salvo só no pipeline local (o board que você vê). */
const CRM_API = { enabled: false, endpoint: "/api/crm-lead" };

/* ---------- helpers ---------- */
const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const scoreClass = (s) => (s < 40 ? "bad" : s < 70 ? "warn" : "good");

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

  // métricas demonstrativas
  const stats = [
    { label: "Prospects na semana", num: "128", delta: "+12%", up: true, chart: svgSpark([30,45,38,60,52,70,86], "#fff"),     box: "dark" },
    { label: "No CRM",              num: "54",  delta: "+8%",  up: true, chart: svgBars([8,12,9,14,11,16,18], "#16d1b4"),      box: "mint" },
    { label: "Taxa de resposta",    num: "37%", delta: "+4%",  up: true, chart: svgArea([24,28,26,31,30,34,37], "#6366f1"),    box: "blue" },
    { label: "Taxa de convertidos", num: "14%", delta: "+3%",  up: true, chart: svgSpark([8,9,10,11,12,13,14], "#16d1b4"),     box: "plain" }
  ];
  const statCards = stats.map(s => `
    <div class="stat">
      <div class="stat__top"><div class="stat__icon">◴</div><div class="stat__label">${s.label}</div></div>
      <div class="stat__row2">
        <div class="stat__num">${s.num}</div>
        <div class="stat__delta stat__delta--${s.up ? "up" : "down"}">${s.delta}</div>
      </div>
      <div class="stat__chart stat__chart--${s.box}">${s.chart}</div>
    </div>`).join("");

  // funil do pipeline (demo)
  const pipe = [
    { label: "Novos", v: 32 }, { label: "Diagnosticados", v: 24 }, { label: "Abordados", v: 18 },
    { label: "Em conversa", v: 12 }, { label: "Follow-up", v: 7 }, { label: "Fechados", v: 5 }
  ];
  const pipeMax = Math.max(...pipe.map(p => p.v));
  const pipeRows = pipe.map(p => `
    <div class="pipe__row">
      <span class="pipe__label">${p.label}</span>
      <span class="pipe__bar"><span style="width:${(p.v / pipeMax * 100).toFixed(0)}%"></span></span>
      <span class="pipe__val">${p.v}</span>
    </div>`).join("");

  // últimos prospects (do mock)
  const recent = MOCK_PROSPECTS.slice(0, 5).map(p => `
    <div class="mini-list__row">
      <span class="mini-list__dot diag__dot--${p.site ? "warn" : "bad"}"></span>
      <div>
        <div class="mini-list__name">${p.nome}</div>
        <div class="mini-list__cat">${p.categoria} · ${p.cidade.split("—")[0].trim()}</div>
      </div>
      <span class="mini-list__meta" style="color:${p.site ? "var(--warn)" : "var(--bad)"}">${p.site ? p.siteScore + "/100" : "sem site"}</span>
    </div>`).join("");

  root.innerHTML = `
    <div class="stat-row">${statCards}</div>

    <div class="dash-cols">
      <div class="dash-card">
        <div class="dash-card__head">
          <span class="dash-card__title">Prospecções — últimos 7 dias</span>
          <span class="dash-card__hint">346 no total</span>
        </div>
        <div class="barchart">${svgWeekChart([18,24,20,32,28,40,52], ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"])}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card__head"><span class="dash-card__title">Funil do pipeline</span></div>
        <div class="pipe">${pipeRows}</div>
      </div>
    </div>

    <div class="dash-cols">
      <div class="dash-card">
        <div class="dash-card__head">
          <span class="dash-card__title">Últimos prospects</span>
          <span class="dash-card__hint" id="dashSeeAll" style="cursor:pointer;color:var(--indigo)">ver todos ↗</span>
        </div>
        <div class="mini-list">${recent}</div>
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

function runSearch(params) {
  /* TODO BACK-END:
     Substituir este bloco por uma chamada real, ex.:
       const res = await fetch("/api/busca", { method:"POST", body: JSON.stringify(params) });
       App.prospects = await res.json();
     O back-end é quem fala com Google Maps / Instagram / PageSpeed. */
  $("#searchHint").hidden = true;
  const box = $("#searching");
  box.hidden = false;
  const btn = $("#searchBtn");
  btn.disabled = true;

  let i = 0;
  $("#searchingText").textContent = SEARCH_STEPS[0];
  const timer = setInterval(() => {
    i++;
    if (i < SEARCH_STEPS.length) {
      $("#searchingText").textContent = SEARCH_STEPS[i];
    } else {
      clearInterval(timer);
      box.hidden = true;
      btn.disabled = false;

      // filtra o mock conforme os parâmetros
      let results = MOCK_PROSPECTS.filter(p => params.fontes.includes(p.fonte));
      if (params.filtro === "sem-site") results = results.filter(p => !p.site);
      else if (params.filtro === "precisa") results = results.filter(p => !p.site || p.siteScore < 70);

      App.prospects = results.map(p => ({ ...p, nicho: params.nicho, cidade: params.cidade || p.cidade }));
      updateCounts();
      const scope = { brasil: "Brasil inteiro", pais: "outro país" }[params.abrangencia] || (params.cidade || "sua região");
      toast(`${App.prospects.length} negócios · ${scope}`);
      setView("prospects");
    }
  }, 650);
}

/* ============ PROSPECTS ============ */
function renderProspects() {
  const list = $("#prospectList");
  const empty = $("#prospectsEmpty");

  let items = App.prospects.filter(p => {
    if (App.prospectFilter === "sem-site" && p.site) return false;
    if (App.prospectFilter === "site-ruim" && (!p.site || p.siteScore >= 70)) return false;
    if (App.prospectFilter === "instagram" && p.fonte !== "instagram") return false;
    if (App.prospectQuery && !p.nome.toLowerCase().includes(App.prospectQuery.toLowerCase())) return false;
    return true;
  });

  empty.hidden = App.prospects.length > 0;
  list.innerHTML = items.map(cardProspect).join("");

  // resumo dos resultados (igual à "cara" do MIRA)
  const summary = $("#prospectSummary");
  if (summary) {
    const all = App.prospects;
    if (!all.length) { summary.hidden = true; }
    else {
      summary.hidden = false;
      const comTel  = all.filter(p => p.telefone).length;
      const refazer = all.filter(p => p.site).length;
      const semSite = all.filter(p => !p.site).length;
      summary.innerHTML = `
        <span class="rs__item"><b>${all.length}</b> negócios</span>
        <span class="rs__item"><b>${comTel}</b> com telefone</span>
        <span class="rs__item rs__item--warn"><b>${refazer}</b> com site pra refazer</span>
        <span class="rs__item rs__item--bad"><b>${semSite}</b> sem site</span>`;
    }
  }

  $$(".prospect", list).forEach(el =>
    el.addEventListener("click", () => openDrawer(el.dataset.id))
  );
}

function cardProspect(p) {
  const inCrm = !!App.crm[p.id];
  const siteTag = p.site
    ? `<span class="tag tag--warn">Site ruim</span>`
    : `<span class="tag tag--bad">Sem site</span>`;
  const srcTag = `<span class="tag tag--src">${FONTES[p.fonte] || "Maps"}</span>`;
  const crmTag = inCrm ? `<span class="tag tag--good">No CRM</span>` : "";
  const sc = scoreClass(p.siteScore);

  return `
  <article class="prospect" data-id="${p.id}">
    <div class="prospect__main">
      <div class="prospect__name">${p.nome} ${siteTag} ${srcTag} ${crmTag}</div>
      <div class="prospect__meta">
        <span>${p.categoria}</span>
        <span>★ ${p.notaGoogle.toFixed(1)} · ${p.avaliacoes} aval.</span>
        <span>${p.telefone}</span>
        <span>${p.site || "sem site"}</span>
      </div>
    </div>
    <div class="prospect__right">
      <div class="score score--${sc}">
        <div class="score__num">${p.site ? p.siteScore : "—"}</div>
        <div class="score__label">site</div>
      </div>
    </div>
  </article>`;
}

/* Projeção "depois do ARQHunter" (placeholder — vira dado real do back-end
   quando a gente medir o site atual E o site novo que você criar). */
function projectedScore(p) {
  return p.site ? Math.min(97, p.siteScore + 60) : 95;
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
  const p = App.prospects.find(x => x.id === id);
  if (!p) return;

  const proj = projectedScore(p);
  const now = p.site ? p.siteScore : 0;
  const delta = p.site ? proj - now : proj;

  const diagRows = p.diagnostico.map(d => `
    <div class="diag__row">
      <span class="diag__dot diag__dot--${d.status}"></span>
      <span class="diag__name">${d.nome}</span>
      <span class="diag__val">${d.valor}</span>
      <span class="diag__after">→ ${improvedValue(d.nome)}</span>
    </div>`).join("");

  const stage = App.crm[id]?.stage || "";
  const stageOptions = CRM_STAGES.map(s =>
    `<option value="${s.id}" ${s.id === stage ? "selected" : ""}>${s.label}</option>`).join("");

  $("#drawerInner").innerHTML = `
    <div class="drawer__head">
      <h2 class="drawer__title">${p.nome}</h2>
      <button class="drawer__close" id="drawerClose">×</button>
    </div>
    <div class="drawer__meta">
      <span>${p.categoria} · ${p.cidade}</span>
      <span>★ ${p.notaGoogle.toFixed(1)} no Google · ${p.telefone}</span>
      <span>${p.site ? `🌐 ${p.site}` : "Sem site"} · ${p.instagram}</span>
    </div>

    <div class="section-label">Diagnóstico — hoje × depois</div>
    <div class="compare">
      <div class="compare__col compare__col--now">
        <div class="compare__cap">Site hoje</div>
        <div class="compare__score">${p.site ? now : "—"}<small>/100</small></div>
      </div>
      <div class="compare__col compare__col--after">
        <div class="compare__cap">Com o ARQHunter</div>
        <div class="compare__score">${proj}<small>/100</small></div>
        <div class="compare__delta">▲ +${delta} pts</div>
      </div>
    </div>
    <div class="diag">${diagRows}</div>

    <div class="section-label">Abordagem gerada</div>
    <textarea class="message" id="messageBox">${generateMessage(p)}</textarea>
    <div class="drawer__actions">
      <button class="btn btn--sm" id="copyBtn">Copiar mensagem</button>
      <button class="btn btn--sm btn--ghost" id="regenBtn">Gerar outra</button>
    </div>

    <div class="section-label">Contato</div>
    <div class="drawer__actions">
      ${p.site ? `<button class="btn btn--sm" id="openSiteBtn">Abrir site ↗</button>` : ""}
      <button class="btn btn--sm btn--brand" id="waBtn">WhatsApp ↗</button>
      <button class="btn btn--sm" id="igBtn">Instagram ↗</button>
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
  $("#openSiteBtn")?.addEventListener("click", () => window.open("https://" + p.site, "_blank"));
  $("#waBtn").addEventListener("click", () => {
    const msg = encodeURIComponent($("#messageBox").value);
    window.open(`https://wa.me/${p.whatsapp}?text=${msg}`, "_blank");
  });
  $("#igBtn").addEventListener("click", () =>
    window.open("https://instagram.com/" + p.instagram.replace("@", ""), "_blank"));
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
  const problema = !p.site
    ? "não achei um site de vocês — hoje quem procura no Google acaba indo pro concorrente que tem"
    : `dei uma olhada no site de vocês e encontrei alguns pontos que estão custando clientes (${p.diagnostico.filter(d => d.status !== "good").map(d => d.nome.toLowerCase()).slice(0, 2).join(" e ")})`;

  const aberturas = [
    `Oi! Encontrei a ${p.nome} aqui no ${FONTES[p.fonte] === "Instagram" ? "Instagram" : "Google"} e me chamou atenção.`,
    `Olá! Tava procurando ${p.categoria.toLowerCase()} na região e cheguei na ${p.nome}.`
  ];
  const abertura = aberturas[variant ? 1 : 0];

  // ângulo das avaliações (igual ao MIRA): prova social que o site não mostra
  const reviews = p.avaliacoes >= 100
    ? `\n\nVocês têm ${p.avaliacoes} avaliações (${p.notaGoogle.toFixed(1)}★) no Google — mas o site não conta nada dessa história.`
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
      `${p.categoria} · ${p.cidade}`,
      `Site: ${p.site || "sem site"}${p.site ? ` (score ${p.siteScore}/100)` : ""}`,
      `Instagram: ${p.instagram}`,
      `Avaliações: ${p.avaliacoes} (${p.notaGoogle.toFixed(1)}★)`,
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

function addToCrm(p, stage) {
  // 1) pipeline local (sempre) — é o que aparece no board do CRM
  App.crm[p.id] = { stage, prospect: p };
  updateCounts();
  renderProspects();
  closeDrawer();
  toast(`${p.nome} → ${CRM_STAGES.find(s => s.id === stage)?.label}`);

  // 2) envia pro RoiData via back-end (a chave fica lá, nunca aqui).
  //    Ative trocando CRM_API.enabled para true quando o back-end estiver no ar.
  if (CRM_API.enabled) roidataSync(p.id, stage);
}

function renderBoard() {
  // resumo de métricas no topo (No CRM é real; os demais são demonstrativos)
  const crmStats = $("#crmStats");
  if (crmStats) {
    const noCrm = Object.keys(App.crm).length;
    const cards = [
      { label: "Prospects na semana", num: "128" },
      { label: "No CRM",              num: String(noCrm) },
      { label: "Taxa de resposta",    num: "37%" },
      { label: "Taxa de convertidos", num: "14%" }
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
      <span>${p.site ? p.siteScore + "/100" : "sem site"}</span>
    </div>
  </div>`;
}

/* ---- drag & drop entre colunas ---- */
function setupDragDrop() {
  let dragId = null;

  $$(".card").forEach(card => {
    card.addEventListener("dragstart", () => {
      dragId = card.dataset.id;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
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
});
