// ============================================================
// ARQHunter — BACK-END: autocomplete de CIDADE (Google Places Autocomplete)
// ------------------------------------------------------------
// O front manda o que o usuário digitou (ex.: "ribeir") e recebe sugestões
// de cidades do Brasil (ex.: "Ribeirão Preto, SP, Brasil") pra ele escolher.
// A chave do Google fica só aqui no servidor (env var), nunca no front.
// ============================================================

const AC_URL = "https://places.googleapis.com/v1/places:autocomplete";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY não configurada no servidor" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const q = (body.q || "").trim();
    if (q.length < 2) return res.status(200).json({ cidades: [] });

    const resp = await fetch(AC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.text"
      },
      body: JSON.stringify({
        input: q,
        includedPrimaryTypes: ["locality", "administrative_area_level_2"],
        includedRegionCodes: ["br"],
        languageCode: "pt-BR"
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "Autocomplete recusado",
        detail: (data && data.error && data.error.message) || data
      });
    }

    const cidades = (data.suggestions || [])
      .map(s => s.placePrediction && s.placePrediction.text && s.placePrediction.text.text)
      .filter(Boolean);

    return res.status(200).json({ cidades });
  } catch (err) {
    return res.status(502).json({ error: "Falha no autocomplete de cidade", detail: String(err) });
  }
}
