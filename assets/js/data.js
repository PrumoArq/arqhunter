/* ============================================================
   ARQHunter — dados fictícios (mock)
   ------------------------------------------------------------
   TODO BACK-END: tudo aqui será substituído por chamadas reais:
   - GOOGLE MAPS (Places API) → lista de negócios + nº de avaliações
   - INSTAGRAM → perfis
   - META ADS (biblioteca de anúncios do Facebook) → quem anuncia
   - PAGESPEED / Lighthouse → diagnóstico do site
   - IA (ex.: Claude) → geração da abordagem
   Veja os pontos marcados "TODO BACK-END" em app.js.
   ============================================================ */

// Estágios do CRM (pipeline). Edite os nomes aqui se quiser.
const CRM_STAGES = [
  { id: "novo",       label: "Novos" },
  { id: "diagnostico",label: "Diagnosticados" },
  { id: "abordado",   label: "Abordados" },
  { id: "conversa",   label: "Em conversa" },
  { id: "followup",   label: "Follow-up" },
  { id: "fechado",    label: "Fechados" }
];

// Rótulos das fontes de busca.
const FONTES = {
  maps:      "Maps",
  instagram: "Instagram",
  meta:      "Meta Ads"
};

// Base de prospects fictícios usada para simular uma busca.
const MOCK_PROSPECTS = [
  {
    id: "p1", nome: "Pet Zoyde", categoria: "Pet shop", cidade: "Rio de Janeiro — RJ",
    telefone: "(21) 98888-1234", whatsapp: "5521988881234", instagram: "@petzoyde",
    site: "petzoyde.com.br", notaGoogle: 4.6, avaliacoes: 212, fonte: "maps", siteScore: 32,
    diagnostico: [
      { nome: "Site existe", valor: "Sim", status: "good" },
      { nome: "Mobile", valor: "Quebra em celular", status: "bad" },
      { nome: "Velocidade", valor: "7,8s para carregar", status: "bad" },
      { nome: "SSL (cadeado)", valor: "Ausente", status: "bad" },
      { nome: "SEO básico", valor: "Sem título/descrição", status: "warn" }
    ]
  },
  {
    id: "p2", nome: "Odonto Sorriso Pleno", categoria: "Clínica odontológica", cidade: "Rio de Janeiro — RJ",
    telefone: "(21) 97777-4521", whatsapp: "5521977774521", instagram: "@sorrisopleno",
    site: null, notaGoogle: 4.8, avaliacoes: 508, fonte: "maps", siteScore: 0,
    diagnostico: [
      { nome: "Site existe", valor: "Não encontrado", status: "bad" },
      { nome: "Presença", valor: "Só Instagram + Maps", status: "warn" },
      { nome: "Agendamento online", valor: "Inexistente", status: "bad" }
    ]
  },
  {
    id: "p3", nome: "Cantina da Nonna", categoria: "Restaurante", cidade: "Rio de Janeiro — RJ",
    telefone: "(21) 96666-8080", whatsapp: "5521966668080", instagram: "@cantinadanonna",
    site: "cantinadanonna.com", notaGoogle: 4.4, avaliacoes: 341, fonte: "meta", siteScore: 48,
    diagnostico: [
      { nome: "Site existe", valor: "Sim", status: "good" },
      { nome: "Mobile", valor: "Ok", status: "good" },
      { nome: "Velocidade", valor: "4,1s para carregar", status: "warn" },
      { nome: "Cardápio online", valor: "PDF pesado", status: "warn" },
      { nome: "SSL (cadeado)", valor: "Ok", status: "good" }
    ]
  },
  {
    id: "p4", nome: "Studio Bianca Arquitetura", categoria: "Escritório de arquitetura", cidade: "Rio de Janeiro — RJ",
    telefone: "(21) 95555-7712", whatsapp: "5521955557712", instagram: "@biancarq",
    site: null, notaGoogle: 5.0, avaliacoes: 87, fonte: "instagram", siteScore: 0,
    diagnostico: [
      { nome: "Site existe", valor: "Não encontrado", status: "bad" },
      { nome: "Portfólio", valor: "Só no Instagram", status: "warn" },
      { nome: "Link na bio", valor: "Linktree genérico", status: "warn" }
    ]
  },
  {
    id: "p5", nome: "Academia Corpo & Movimento", categoria: "Academia", cidade: "Rio de Janeiro — RJ",
    telefone: "(21) 94444-3030", whatsapp: "5521944443030", instagram: "@corpoemovimento",
    site: "corpoemovimento.fit", notaGoogle: 4.2, avaliacoes: 96, fonte: "maps", siteScore: 27,
    diagnostico: [
      { nome: "Site existe", valor: "Sim", status: "good" },
      { nome: "Mobile", valor: "Texto minúsculo", status: "bad" },
      { nome: "Velocidade", valor: "9,2s para carregar", status: "bad" },
      { nome: "SSL (cadeado)", valor: "Ausente", status: "bad" },
      { nome: "Matrícula online", valor: "Inexistente", status: "warn" }
    ]
  },
  {
    id: "p6", nome: "Belle Hair Salão", categoria: "Salão de beleza", cidade: "Rio de Janeiro — RJ",
    telefone: "(21) 93333-1177", whatsapp: "5521933331177", instagram: "@bellehair",
    site: null, notaGoogle: 4.9, avaliacoes: 263, fonte: "instagram", siteScore: 0,
    diagnostico: [
      { nome: "Site existe", valor: "Não encontrado", status: "bad" },
      { nome: "Agendamento", valor: "Só WhatsApp", status: "warn" },
      { nome: "Presença", valor: "Instagram ativo", status: "good" }
    ]
  },
  {
    id: "p7", nome: "Imobiliária Vista Mar", categoria: "Imobiliária", cidade: "Rio de Janeiro — RJ",
    telefone: "(21) 92222-6565", whatsapp: "5521922226565", instagram: "@vistamarimoveis",
    site: "vistamarimoveis.com.br", notaGoogle: 3.9, avaliacoes: 54, fonte: "meta", siteScore: 41,
    diagnostico: [
      { nome: "Site existe", valor: "Sim", status: "good" },
      { nome: "Mobile", valor: "Parcial", status: "warn" },
      { nome: "Velocidade", valor: "6,3s para carregar", status: "bad" },
      { nome: "Busca de imóveis", valor: "Lenta e confusa", status: "bad" }
    ]
  },
  {
    id: "p8", nome: "Dr. Henrique Advocacia", categoria: "Advocacia", cidade: "Rio de Janeiro — RJ",
    telefone: "(21) 91111-9090", whatsapp: "5521911119090", instagram: "@henriqueadv",
    site: "henriqueadvocacia.adv.br", notaGoogle: 4.7, avaliacoes: 156, fonte: "maps", siteScore: 55,
    diagnostico: [
      { nome: "Site existe", valor: "Sim", status: "good" },
      { nome: "Mobile", valor: "Ok", status: "good" },
      { nome: "Velocidade", valor: "3,4s para carregar", status: "warn" },
      { nome: "Design", valor: "Template datado (2015)", status: "warn" }
    ]
  }
];
