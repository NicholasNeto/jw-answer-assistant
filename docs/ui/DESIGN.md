# Design da interface — JW Answer Assistant

Mockup visual: abra `docs/ui/mockup.html` no browser. Este ficheiro dá as medidas, os componentes e os estados.
Explicação de cada componente, hooks e formatos da API: [`COMPONENTS.md`](./COMPONENTS.md).

## 1. Problemas da interface atual
- Tudo numa só coluna, sem hierarquia (h2 grandes, listas sem cartões).
- O estado do telemóvel (cima) está longe das ações que dependem dele (inserir).
- Secções antigas (`Perguntar`, `Inserir resposta`/clipboard) competem com o fluxo principal.
- Estado de cada pergunta só aparece como texto ("✅ pronta"); erros e carregamento não se distinguem.
- Em mock, o banner diz "Telemóvel simulado" mas o estado do ADB continua a mostrar ❌ (usa o ADB real). Mostrar o estado do dispositivo simulado quando `deviceMock` for verdadeiro.

## 2. Layout (desktop ≥ 1024 px)

```
┌─────────────────────────────────────────────────────────────┐
│ AppHeader (56)   JW Answer Assistant     [IA simulada][📱 ligado] │
├───────────────────────────────────────────┬─────────────────┤
│ main (flex 1)                             │ side (340, sticky)│
│ ┌ ArticleLoader ──────────────────────┐   │ ┌ DevicePanel ──┐ │
│ │ [ URL .......................][Carregar]│  │ │ ✓ ADB         │ │
│ │ título · semana · 15 perguntas      │   │ │ ✓ Autorizado  │ │
│ └─────────────────────────────────────┘   │ │ ✓ JW Library  │ │
│ QuestionToolbar: Perguntas ▓▓░ 4/15 [Preparar todas] │ ✕ 1º plano    │ │
│ ┌ QuestionCard (pronta) ──────────────┐   │ └───────────────┘ │
│ │ PERGUNTA 1 · § 1             [✓ Pronta]│  │ ┌ OpenQuestion ─┐ │
│ │ texto da pergunta                   │   │ │ [Detetar]     │ │
│ │ [ caixa da resposta (editável) ]    │   │ │ [Inserir]     │ │
│ │ [Inserir][Copiar][Refazer]  Ver texto-base▾│ │ Diagnóstico▸ │ │
│ └─────────────────────────────────────┘   │ └───────────────┘ │
│ QuestionCard (a gerar / erro / pendente)  │                   │
│ ▸ Ferramentas avançadas                   │                   │
└───────────────────────────────────────────┴─────────────────┘
```

- Largura máxima do conteúdo: **1200 px**, centrado, padding **24 px**.
- Grelha: `grid-template-columns: minmax(0,1fr) 340px; gap: 24px`.
- Barra lateral `position: sticky; top: 24px` (o estado do telemóvel fica sempre visível).
- **Abaixo de 900 px:** uma coluna; a barra lateral passa para cima da lista.

## 3. Tokens

**Espaçamento:** 4 · 8 · 12 · 16 · 24 · 32 (`--s1…--s8`). Entre cartões: 16. Dentro do cartão: 16. Entre linhas de botões: 8.
**Raios:** cartão 12, controlos 8, chips/badges 999.
**Cores:** fundo `#f5f6f8`, cartão `#fff`, borda `#e3e6ea`, texto `#1c2430`, secundário `#667085`, primária `#3b4cca` (fundo suave `#eef0ff`), sucesso `#1a7f4b`/`#e7f6ee`, aviso `#9a6700`/`#fff4d6`, erro `#b42318`/`#fdecea`.
**Tipografia:** system-ui. Corpo 15/1.5; pequeno 13; título de cartão 16 (600); marca 18 (700); etiqueta da pergunta 12 em maiúsculas (700, `letter-spacing .04em`).
**Alturas:** botão 36 (pequeno 30), input 40, chip 28, badge 24, cabeçalho 56.

## 4. Componentes React

```
App
├─ AppHeader
│  └─ StatusChip (ia | device)
├─ main
│  ├─ ArticleLoader
│  ├─ QuestionToolbar        (progresso + "Preparar todas")
│  ├─ QuestionList
│  │  └─ QuestionCard × N
│  │     ├─ StatusBadge
│  │     ├─ AnswerBox         (textarea)
│  │     ├─ CardActions       (Inserir · Copiar · Refazer)
│  │     └─ SourceText        (colapsável)
│  └─ AdvancedTools           (<details>)
└─ aside
   ├─ DevicePanel
   │  └─ CheckRow × 4
   └─ OpenQuestionPanel       (Detetar · Inserir · Diagnóstico)
```

| Componente | Props principais | Notas |
|---|---|---|
| `StatusChip` | `tone: 'ok'\|'warn'\|'err'`, `label` | ponto + texto; `warn` para IA simulada |
| `ArticleLoader` | `onLoad(url)`, `loading`, `error` | Enter também carrega |
| `QuestionCard` | `question`, `state`, `answer`, `onPrepare/onInsert/onCopy/onChange` | ver estados abaixo |
| `StatusBadge` | `state` | pendente · a gerar · pronta · erro · inserida |
| `DevicePanel` | `status` | refresca a cada 5 s |
| `OpenQuestionPanel` | `detected`, `onDetect`, `onInsert` | usa `/api/flow/detect` |

### Estados do `QuestionCard`
| Estado | Badge | Conteúdo | Ações |
|---|---|---|---|
| `pending` | cinzento "Pendente" | só a pergunta | **Preparar resposta** (primário) |
| `loading` | azul "A gerar…" | skeleton de 96 px | nenhuma (desativadas) |
| `ready` | verde "✓ Pronta" | textarea editável | **Inserir** (primário), Copiar, Refazer, Ver texto-base |
| `error` | vermelho "Erro" | alerta com a mensagem amigável | Tentar de novo |
| `inserted` | roxo "Inserida" | textarea | Inserir de novo, Copiar |
| `no_source` | cinzento "Sem texto-base" | "responda manualmente" | nenhuma |

Só **uma** ação primária por cartão. Ao inserir: o botão mostra "A inserir…" (demora cerca de 3 s) e desativa-se. Se a API devolver erro, mostrar `error` por baixo dos botões (não num `alert`).

## 5. API que o React vai usar
| Ação | Pedido |
|---|---|
| Config / modo mock | `GET /api/config` → `{aiProvider, deviceMock}` |
| Estado do telemóvel | `GET /api/device/status` (poll 5 s) |
| Carregar artigo | `POST /api/study/load {url}` |
| Gerar resposta | `POST /api/study/answer {url, number}` |
| Guardar/ler respostas | `PUT/GET /api/answers` |
| Inserir na pergunta certa | `POST /api/device/insert {text, url, number}` |
| Pergunta aberta | `POST /api/flow/detect {url}` |

## 6. Setup sugerido
- **Vite + React** (`npm create vite@latest web -- --template react`) numa pasta `web/`. Em `vite.config.js`: `server.proxy = { '/api': 'http://localhost:3000' }`. Em produção, `npm run build` e o Express serve `web/dist`.
- **Sem bibliotecas de UI.** O desenho usa CSS puro com variáveis (CSS Modules ou um `styles.css`).
- Opcionais (só se quiser): `@tanstack/react-query` (polling e estados de pedido), `lucide-react` (ícones). Nenhuma é obrigatória.

## 7. Melhorias sugeridas (por prioridade)
1. Estado por cartão com cores (secção 4) — maior ganho visual.
2. Barra lateral fixa com o telemóvel — evita rolar para ver o estado.
3. Barra de progresso "4 de 15 prontas".
4. Mover `Perguntar` e `Inserir resposta` (clipboard) para "Ferramentas avançadas".
5. Mostrar, em cada cartão, se a pergunta está visível no telemóvel (futuro).
