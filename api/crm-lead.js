// ============================================================
// ARQHunter — back-end mínimo: proxy seguro pro CRM RoiData
// ------------------------------------------------------------
// Por que isso existe: a chave do RoiData (x-api-key) NÃO pode ficar no
// front-end (qualquer visitante veria). Então o front chama ESTE endpoint
// (mesmo domínio, sem chave), e aqui dentro — no servidor — a gente adiciona
// a chave, que vem de uma variável de ambiente.
//
// Formato: função serverless no estilo Vercel (coloque o arquivo em /api).
// Também dá pra adaptar fácil pra Express/Next.js.
//
// COMO USAR:
//   1. Faça deploy do projeto na Vercel (ou outro host com /api).
//   2. Defina a variável de ambiente:  ROIDATA_API_KEY = sua_chave_real
//      (NUNCA escreva a chave neste arquivo nem commite ela.)
//   3. No front (assets/js/app.js), troque CRM_API.enabled para true.
// ============================================================

const ROIDATA_URL = "https://roidata.com.br/api/public/leads";

export default async function handler(req, res) {
  // POST = criar lead · PATCH = atualizar status
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Método não permitido (use POST ou PATCH)" });
  }

  const apiKey = process.env.ROIDATA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ROIDATA_API_KEY não configurada no servidor" });
  }

  try {
    // req.body já vem como objeto na Vercel; fallback pra string JSON.
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    let payload;
    if (req.method === "POST") {
      // criar lead
      if (!body.name) {
        return res.status(400).json({ error: "O campo 'name' é obrigatório" });
      }
      payload = {
        name: body.name,            // obrigatório
        phone: body.phone,
        email: body.email,
        company: body.company,
        notes: body.notes,
        source: body.source || "Prospecção Ativa"
      };
    } else {
      // atualizar status (identifica por id OU phone)
      if (!body.id && !body.phone) {
        return res.status(400).json({ error: "Informe 'id' ou 'phone' para atualizar" });
      }
      if (!body.status) {
        return res.status(400).json({ error: "O campo 'status' é obrigatório no update" });
      }
      payload = body.id
        ? { id: body.id, status: body.status }
        : { phone: body.phone, status: body.status };
    }

    // Repassa pro RoiData com a chave (que só existe aqui no servidor),
    // usando o mesmo método recebido (POST cria, PATCH atualiza).
    const resp = await fetch(ROIDATA_URL, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Falha ao falar com o RoiData", detail: String(err) });
  }
}
