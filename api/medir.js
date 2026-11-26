// ============================================================
// ARQHunter — BACK-END: medição do site (Google PageSpeed Insights)
// ------------------------------------------------------------
// Recebe a URL de um site e devolve o "score" (0-100) + um diagnóstico
// (velocidade, SEO, mobile, SSL, boas práticas). É isso que preenche o
// comparativo "hoje × depois" de verdade.
//
// PageSpeed é GRÁTIS. Usa a mesma chave do Google (env GOOGLE_PLACES_API_KEY):
//   1. Ative a "PageSpeed Insights API" no Google Cloud.
//   2. Libere essa API nas restrições da chave (que hoje só permite Places).
// Mede a versão MOBILE (o Google ranqueia mobile-first).
// ============================================================

export const maxDuration = 60; // PageSpeed pode levar ~15-30s; Vercel precisa desse fôlego

const PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    let url = (body.url || "").trim();
    if (!url) return res.status(400).json({ error: "Informe a url do site" });
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const params = new URLSearchParams();
    params.set("url", url);
    params.set("strategy", "mobile");
    ["performance", "seo", "best-practices", "accessibility"].forEach(c => params.append("category", c));
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (apiKey) params.set("key", apiKey);

    const resp = await fetch(`${PSI_URL}?${params.toString()}`);
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.lighthouseResult) {
      return res.status(resp.status === 200 ? 502 : resp.status).json({
        error: "Não consegui medir o site",
        detail: (data && data.error && data.error.message) || "sem resultado do PageSpeed"
      });
    }

    const lr = data.lighthouseResult;
    const cat = lr.categories || {};
    const audits = lr.audits || {};
    const sc = (c) => (c && typeof c.score === "number") ? Math.round(c.score * 100) : null;
    const cls = (n) => (n == null ? "warn" : n < 50 ? "bad" : n < 90 ? "warn" : "good");
    const dv = (id) => (audits[id] && audits[id].displayValue) || null;

    const perf = sc(cat.performance);
    const seo  = sc(cat.seo);
    const bp   = sc(cat["best-practices"]);
    const a11y = sc(cat.accessibility);

    const finalUrl = lr.finalUrl || url;
    const https = /^https:\/\//i.test(finalUrl);
    const viewportOk = audits.viewport && audits.viewport.score === 1;

    const siteScore = perf != null ? perf : 0;
    const diagnostico = [
      { nome: "Velocidade",     valor: dv("largest-contentful-paint") || dv("first-contentful-paint") || `${perf}/100`, status: cls(perf) },
      { nome: "SEO básico",     valor: seo != null ? `${seo}/100` : "—",  status: cls(seo) },
      { nome: "Mobile",         valor: viewportOk ? "responsivo" : "não responsivo", status: viewportOk ? "good" : "bad" },
      { nome: "SSL (cadeado)",  valor: https ? "ativo (HTTPS)" : "sem HTTPS", status: https ? "good" : "bad" },
      { nome: "Boas práticas",  valor: bp != null ? `${bp}/100` : "—", status: cls(bp) }
    ];

    return res.status(200).json({
      siteScore, perf, seo, bestPractices: bp, acessibilidade: a11y, https,
      finalUrl, diagnostico
    });
  } catch (err) {
    return res.status(502).json({ error: "Falha ao medir o site", detail: String(err) });
  }
}
