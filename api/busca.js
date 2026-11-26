// ============================================================
// ARQHunter — BACK-END: busca real de negócios (Google Places API New)
// ------------------------------------------------------------
// O front chama ESTE endpoint (mesmo domínio, sem chave). Aqui dentro,
// no servidor, a gente adiciona a chave secreta do Google (env var) e
// consulta a Places API "Text Search" com o nicho + cidade que o usuário
// digitou. Devolve a lista real de negócios no formato que o front usa.
//
// COMO USAR:
//   1. Na Vercel → Settings → Environment Variables:
//        GOOGLE_PLACES_API_KEY = sua_chave_do_google  (NUNCA no código)
//   2. Deploy. Pronto — o front passa a trazer dados reais.
//
// OBS: o "score do site" (diagnóstico hoje×depois) é OUTRA etapa, via
// PageSpeed. Aqui o siteScore vem null ("a medir") — o front mostra isso.
// ============================================================

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

// campos que pedimos ao Google (quanto menos, mais barato — e estes bastam)
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "nextPageToken"               // pra paginar (puxar mais que 20)
].join(",");

// "site falso": quando o Google devolve como site um link de WhatsApp, rede
// social ou agregador de links (Linktree etc.) — não é site de verdade, então
// pra prospecção isso conta como OPORTUNIDADE (sem site real).
const SITE_FALSO = /(wa\.me|whatsapp\.com|instagram\.com|facebook\.com|fb\.com|fb\.me|linktr\.ee|linktree|bio\.link|beacons\.ai|linkme\.bio|about\.me|t\.me|telegram\.me|linkbio|campsite\.bio|flowpage|solo\.to)/i;
const siteEhReal = (url) => !!url && !SITE_FALSO.test(url);

// telefone -> só dígitos, com DDI do Brasil, pra montar link de WhatsApp
function soDigitosWhats(tel) {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, "");
  if (!d) return null;
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY não configurada no servidor" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const nicho  = (body.nicho  || "").trim();
    const cidade = (body.cidade || "").trim();
    const filtro = body.filtro || "todos";
    if (!nicho) return res.status(400).json({ error: "Informe o nicho" });

    const textQuery = cidade ? `${nicho} em ${cidade}` : nicho;

    // Pagina até 3 páginas (~60 negócios). Cada página = 1 requisição (SKU).
    const places = [];
    let pageToken = null;
    for (let page = 0; page < 3; page++) {
      const reqBody = { textQuery, languageCode: "pt-BR", regionCode: "BR", pageSize: 20 };
      if (pageToken) reqBody.pageToken = pageToken;

      const resp = await fetch(PLACES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK
        },
        body: JSON.stringify(reqBody)
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (page === 0) {
          return res.status(resp.status).json({
            error: "O Google Places recusou a busca",
            detail: (data && data.error && data.error.message) || data
          });
        }
        break; // erro só a partir da 2ª página: fica com o que já veio
      }

      if (Array.isArray(data.places)) places.push(...data.places);
      pageToken = data.nextPageToken || null;
      if (!pageToken) break;
    }
    let prospects = places.map(p => {
      const tel = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
      const rawSite = p.websiteUri || null;
      const real = siteEhReal(rawSite);
      return {
        id:         p.id,
        nome:       (p.displayName && p.displayName.text) || "(sem nome)",
        categoria:  (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || nicho,
        cidade:     cidade || "",
        endereco:   p.formattedAddress || "",
        telefone:   tel,
        whatsapp:   soDigitosWhats(tel),
        instagram:  null,                       // o Google não fornece Instagram
        site:       real ? rawSite : null,      // só site de VERDADE aqui (null = oportunidade)
        siteFraco:  (!real && rawSite) ? rawSite : null, // só link (WhatsApp/Linktree) = oportunidade
        notaGoogle: (typeof p.rating === "number") ? p.rating : null,
        avaliacoes: p.userRatingCount || 0,
        mapsUrl:    p.googleMapsUri || null,
        fonte:      "maps",
        siteScore:  null,                       // a medir (PageSpeed, próxima etapa)
        diagnostico: []
      };
    });

    // Filtro. O "score do site" ainda não é medido aqui (PageSpeed = próxima
    // etapa), então "sem-site"/"precisa" focam em quem NÃO tem site REAL — o que
    // já inclui quem só tem link de WhatsApp/Linktree (oportunidade). "todos" = tudo.
    if (filtro === "sem-site" || filtro === "precisa") {
      prospects = prospects.filter(p => !p.site);
    }

    return res.status(200).json({ prospects, total: prospects.length });
  } catch (err) {
    return res.status(502).json({ error: "Falha ao buscar no Google Places", detail: String(err) });
  }
}
