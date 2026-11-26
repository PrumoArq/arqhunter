# ARQHunter

Ferramenta de prospecção inspirada no funcionamento do MIRA (Forza):
encontra negócios com site ruim ou sem site, mede o site, gera a abordagem
e acompanha tudo em um CRM.

> **Status:** protótipo de **front-end apenas**. Usa dados fictícios.
> Sem back-end ainda. Identidade visual aplicada (claro/minimalista, acento
> mint-teal + periwinkle, logo em alvo) — baseada na referência do cliente.

---

## Como abrir

Como o app carrega CSS e JavaScript em arquivos separados, ele precisa ser
servido por um servidor local (abrir o `index.html` com dois cliques pode não
funcionar em alguns navegadores). Dentro da pasta do projeto:

```bash
python3 -m http.server 8777
```

Depois abra: `http://localhost:8777/index.html`

---

## Estrutura

```
ARQHunter/
├─ index.html              → telas do app (painel, busca, prospects, CRM)
├─ assets/
│  ├─ css/styles.css       → estilo (variáveis de cor/identidade no topo)
│  └─ js/
│     ├─ config.js         → chaves PÚBLICAS do Supabase (URL + anon key)
│     ├─ data.js           → DADOS FICTÍCIOS + estágios do CRM
│     ├─ app.js            → lógica (painel, busca, diagnóstico, abordagem, kanban, CRM)
│     └─ auth.js           → login/cadastro/sair (Supabase Auth) + trava do app
├─ api/
│  └─ crm-lead.js          → BACK-END: proxy seguro pro RoiData (guarda a chave)
├─ supabase/
│  └─ schema.sql           → tabelas do banco (rode no SQL Editor do Supabase)
└─ README.md
```

## O que o app faz hoje (simulado)

0. **Painel** (tela inicial) — visão geral com cards de número (prospects na semana, no CRM, taxa de resposta, taxa de convertidos), gráfico da semana, funil do pipeline e atalhos. O mesmo resumo de 4 métricas aparece no topo da tela de **CRM**. Gráficos em SVG puro (sem bibliotecas); números são demonstrativos até o back-end entrar (exceto "No CRM", que já reflete o pipeline real).
1. **Nova busca** — escolhe nicho + **fontes (Maps / Instagram / Meta Ads)** + **abrangência (cidade / Brasil inteiro / outro país)** + filtro.
2. **Prospects** — **resumo no topo** (X negócios · Y com telefone · Z com site pra refazer · W sem site, igual à "cara" do MIRA); lista com nota + **nº de avaliações** do Google, telefone, site e **score do site**; filtros. No detalhe de cada prospect há **ações de contato**: abrir site, **WhatsApp** (já com a mensagem) e Instagram.
3. **Diagnóstico "hoje × depois"** — ao abrir um prospect, mostra a nota atual do site × a nota projetada com o ARQHunter, item por item (mobile, velocidade, SSL, SEO…). É o argumento de venda do "entregar antes de pedir". Hoje os números são simulados; viram reais quando o back-end medir o site atual **e** o site novo que você criar.
4. **Abordagem** — gera uma mensagem de prospecção pronta pra copiar, usando o diagnóstico e o **nº de avaliações** ("vocês têm 508 avaliações no Google, mas o site não conta nada dessa história" — ângulo do MIRA). Hoje é um texto montado localmente; vira IA no back-end.
5. **CRM** — pipeline em kanban (Novos → Diagnosticados → Abordados → Em conversa → Follow-up → Fechados) com **arrastar e soltar**.

> Tudo roda em memória: ao recarregar a página, o estado reinicia (ainda não tem banco de dados).

---

## O que precisa de back-end (próxima etapa)

O navegador sozinho **não** faz essas partes (e não deve, por segurança —
chaves de API nunca ficam no front-end). Cada ponto abaixo está marcado no
código com `// TODO BACK-END`:

| Função | Como o back-end resolve |
|---|---|
| Lista de negócios (nome, telefone, site, nota, **nº de avaliações**) | **Google Places API** (ou serviço de scraping do Maps) |
| Busca no Instagram | Scraping / serviço de terceiros (não há API oficial pra isso) |
| **Busca no Meta Ads** (biblioteca de anúncios do Facebook) | Scraping / serviço de terceiros — pega quem está anunciando |
| Medir o site / diagnóstico | **Google PageSpeed Insights API** ou Lighthouse. O MIRA mostra: TTFB, primeira pintura (FCP), load completo, nº de requisições, peso do site (KB), nós no DOM, + checagem de SSL/mobile/WhatsApp |
| Auditoria de UX/conteúdo | IA analisa o site e aponta seções vazias, contadores zerados, nomes errados, contraste ruim, CTA ausente (prioridades de credibilidade) |
| Escrever a abordagem | Modelo de IA (ex.: **Claude**) chamado no servidor |
| Guardar prospects e pipeline | Banco de dados (ex.: Postgres) |
| Login / contas | Autenticação (o "criar conta" que você mencionou) |

### Stack planejada (Vercel + Supabase — são complementares, não substitutos)

| Camada | O que faz | Onde |
|---|---|---|
| Hospedar o app ARQHunter (as telas) | serve o front-end | **Vercel** |
| Banco de dados (prospects, CRM, usuários, prévias + validade) | guarda os dados | **Supabase** (Postgres) |
| Login / contas | autenticação | **Supabase Auth** |
| Imagens/arquivos gerados | storage | **Supabase Storage** |
| Lógica de servidor (proxy RoiData, PageSpeed, IA) + segredos | roda código no servidor | **Vercel Functions** ✅ (decidido) |
| Hospedar as prévias dos clientes (temporárias, 7 dias) | cria/serve/apaga sites | **Vercel** (tem API de deploy) |

**Decisão:** a lógica de servidor fica em **Vercel Functions** — ou seja, o
proxy do CRM continua como `api/crm-lead.js` (já está pronto). A chave do RoiData
mora nos *env vars* da Vercel. O Supabase cuida de banco, Auth e Storage.

---

## Integração com o CRM (RoiData) — já montada

O CRM é o **RoiData**. A API: `POST https://roidata.com.br/api/public/leads`,
autenticada pelo header `x-api-key`, com os campos `name` (obrigatório),
`phone`, `email`, `company`, `notes`, `source`.

**Arquitetura segura (importante):** a chave **nunca** fica no front-end — se
ficasse, qualquer visitante veria. O fluxo é:

```
Front-end (ARQHunter)  →  nosso back-end (api/crm-lead.js)  →  RoiData
   (sem chave)              (adiciona a x-api-key, que        (recebe o lead)
                             vem de variável de ambiente)
```

Peças já prontas:
- `assets/js/app.js` → `buildLeadPayload()` monta o corpo no formato do RoiData, e `addToCrm()` envia pro nosso back-end (controlado por `CRM_API.enabled`).
- `api/crm-lead.js` → o proxy serverless (estilo Vercel) que guarda a chave e repassa pro RoiData.

**Como ligar de verdade:**
1. Deploy do projeto na Vercel (ou host com suporte a `/api`).
2. Definir a variável de ambiente `ROIDATA_API_KEY = sua_chave` (nunca no código, nunca na pasta).
3. Em `assets/js/app.js`, trocar `CRM_API.enabled` para `true`.

> **Nunca** escreva a chave real em nenhum arquivo do projeto nem a coloque no
> front-end. Ela vive só na variável de ambiente do servidor.

### Sincronização do kanban (já ligada)

Ao mover um card no CRM, o ARQHunter faz `PATCH` no RoiData atualizando o
`status` (identificando o lead pelo `id` retornado na criação, ou pelo
`phone`). O proxy `api/crm-lead.js` aceita `POST` (criar) e `PATCH` (atualizar).

Mapeamento das colunas → `status` do RoiData (em `ROIDATA_STATUS`, `app.js`):

| Coluna (ARQHunter) | `status` (RoiData) |
|---|---|
| Novos | `novo` |
| Diagnosticados | `novo` |
| Abordados | `primeiro_contato` |
| Em conversa | `primeiro_contato` |
| Follow-up | `em_negociacao` |
| Fechados | `ganho` |

Valores aceitos pelo RoiData: `novo`, `primeiro_contato`, `proposta_enviada`,
`em_negociacao`, `ganho`, `perdido`. (Dá pra refinar o kanban depois pra usar
todos — ex.: adicionar colunas "Proposta enviada" e "Perdido".)

---

## Login / contas (Supabase Auth) — já montado

O ARQHunter tem uma **tela de login/cadastro** (porta de entrada): enquanto não
há sessão, o app fica travado e aparece a tela; ao entrar, o app aparece e surge
o botão **Sair** no topo. Quem valida e-mail/senha é o **Supabase Auth** — nenhuma
senha é guardada no front-end.

**Como ativar:**
1. No Supabase → **Project Settings → API**. Copie:
   - **Project URL** (ex.: `https://abcd1234.supabase.co`)
   - **anon public** (a chave pública; começa com `eyJ...` ou `sb_publishable_...`)
2. Cole os dois em `assets/js/config.js`. **São valores PÚBLICOS** — podem ficar
   no front-end (quem protege os dados é o RLS). **Nunca** cole aqui a chave
   `service_role` (secreta) — essa vive só nos env vars do servidor.
3. (Opcional, p/ testar rápido) No Supabase → **Authentication → Providers →
   Email**, desligue **"Confirm email"** pra entrar sem precisar confirmar por
   e-mail. Ou deixe ligado e confirme pelo link que chega no e-mail.

> Enquanto `config.js` estiver com os placeholders, a tela mostra um aviso e um
> atalho **"Ver o protótipo sem login"** (bypass) — pra você continuar navegando
> o protótipo. Assim que as chaves entram, o bypass some e a porta vale de verdade.

Peças: `assets/js/auth.js` (lógica) + a tela `#authGate` no `index.html` + o
`<script>` do cliente Supabase (via CDN) + `assets/js/config.js`.

---

## Identidade visual

Aplicada. Visual claro/minimalista baseado na referência do cliente: cards
brancos arredondados, sombras suaves, botões em pílula, acento **mint-teal**
(`--brand`) + **periwinkle** (`--indigo`), logo em **alvo/mira** (SVG inline no
`index.html`). As cores são variáveis no topo de `assets/css/styles.css` —
trocar ali muda o visual inteiro.

---

## Módulo futuro: geração do site do cliente

Depois de achar o prospect, o ARQHunter **monta um site novo e melhor**
reaproveitando as fotos/infos do negócio + referências de template e animação.
Fluxo: achar → diagnosticar → **gerar o site novo** → abordar com a prévia
pronta. Isso fecha o comparativo "hoje × depois" com números reais (site atual
medido × site novo medido).

**Como o criador do MIRA faz isso (da análise do vídeo passo a passo):** ele
não faz dentro do MIRA — faz no Claude Code, à parte. O passo a passo:
1. Pega referências de **templates/animações** no `framer.com/resources/templates` (filtra por nicho, ex.: estética/minimalista) — às vezes o site inteiro, às vezes só um botão, uma transição ou um fundo.
2. Pede pro Claude **recriar o site mantendo a estrutura e a copy**, seguindo a referência e melhorando contraste/cores, com uma skill de front-end design.
3. Gera as **imagens da hero** com IA de imagem (close no rosto, crop, upscale).
4. Vai **ajustando por conversa** (contraste, tipografia em 2 linhas, antes/depois, pílulas, parallax…).
5. **Deploy na Vercel** e compara o PageSpeed: no vídeo foi de **66/73** (mobile/desktop) pra **91/100**.

Pra construir isso no ARQHunter: engine de geração (provavelmente o próprio
Claude via API no back-end) + biblioteca de referências de template/animação
que o cliente vai enviar + geração de imagem + deploy automatizado.

**Hospedagem das prévias + validade de 7 dias (requisito do cliente):** cada
site-prévia gerado pro prospect é publicado num endereço temporário próprio. Se
o prospect **não responder em 7 dias**, a página **sai do ar automaticamente**,
pra não acumular páginas nem custo. Como fazer: guardar no banco a data de
criação de cada prévia e rodar um **cron diário** que apaga da Vercel as que
passaram de 7 dias (via API da Vercel); alternativa mais simples é a própria
página "se expirar" (checa a data e mostra "prévia expirada"). Isso é **separado
da hospedagem da ferramenta ARQHunter**, que fica fixa no ar.
