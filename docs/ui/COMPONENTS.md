# Componentes React — guia de consulta

Complementa `DESIGN.md` (medidas, cores, estados) e `mockup.html` (desenho visual).
Aqui está **o que cada componente faz, que props recebe, que dados usa e onde tropeçar**. A escrita do código fica consigo.

## Estrutura de pastas sugerida

```
web/src/
├─ main.jsx
├─ App.jsx
├─ styles/tokens.css            ← variáveis CSS (copiar :root do mockup)
├─ api/client.js                ← funções fetch (get/post/put)
├─ hooks/
│  ├─ useConfig.js
│  ├─ useDeviceStatus.js        ← polling de 5 s
│  ├─ useArticle.js             ← carregar artigo + respostas guardadas
│  └─ useQuestionQueue.js       ← "Preparar todas" (fila)
└─ components/
   ├─ AppHeader/  StatusChip/
   ├─ ArticleLoader/
   ├─ QuestionToolbar/  QuestionList/  QuestionCard/  StatusBadge/
   ├─ AnswerBox/  CardActions/  SourceText/
   ├─ DevicePanel/  CheckRow/  OpenQuestionPanel/
   └─ AdvancedTools/
```

Regra geral: **componentes de apresentação** (`StatusChip`, `StatusBadge`, `CheckRow`, `AnswerBox`) só recebem props. **Quem faz fetch** são os hooks e o `App`/painéis.

---

## 1. Formatos da API (confirmados no código)

**`GET /api/config`** → `{ aiProvider: "mock" | "gemini", deviceMock: boolean }`

**`GET /api/device/status`**
```json
{ "adbAvailable": true, "adbPath": "...", "device": "serial", "deviceAuthorized": true,
  "jwLibraryInstalled": true, "jwLibraryForeground": false, "foregroundPackage": null, "message": "…" }
```

**`POST /api/study/load {url}`** → `{ ok, type: "study"|"midweek", title, week, url, questions: [{ number, label, section, text, hasParagraph }] }`. Em erro: `{ ok:false, error }` (HTTP 400).

**`POST /api/study/answer {url, number}`** → `{ ok, text, model, question, paragraphs, source: {title,url} }`.
Em erro: `{ ok:false, code, error, retryable }` — `code` pode ser `quota`, `auth`, `timeout`, `unavailable`, `empty`, `no_key`…

**`GET /api/answers?url=…`** → respostas guardadas por número. **`PUT /api/answers {url, number, text, model}`** grava.

**`POST /api/device/insert {text, url, number}`** → `{ ok:true, method, targeted, verified }` ou `{ ok:false, code, error }` com `code` ∈ `question_not_visible`, `field_offscreen`, `not_confirmed`, `needs_adbkeyboard`, `adb`, `empty`.

**`POST /api/flow/detect {url}`** → `{ ok, found, number, label, question, answer|null }` ou `{ ok:true, found:false, message }`.

---

## 2. Componentes

### AppHeader
- **Faz:** barra de topo com a marca e os dois chips de estado.
- **Props:** nenhuma (ou `config` e `status`).
- **Dados:** `useConfig()` e `useDeviceStatus()`.
- **Lógica do chip de IA:** `aiProvider === "mock"` → aviso "IA simulada"; senão → ok "IA real".
- **Lógica do chip do telemóvel:** `!adbAvailable || !deviceAuthorized` → erro "Telemóvel desligado"; autorizado mas `!jwLibraryForeground` → aviso "Abra a JW Library"; tudo certo → ok "Telemóvel ligado".
- **Atenção:** em modo `deviceMock` o `/api/device/status` ainda usa o ADB real. Se `deviceMock` for verdadeiro, mostre o chip "Telemóvel simulado" (aviso) e ignore o status.

### StatusChip
- **Faz:** etiqueta arredondada com ponto colorido + texto.
- **Props:** `tone: 'ok'|'warn'|'err'` (por defeito `ok`), `label: string`.
- **Estado:** nenhum. Só desenha.
- **Dicas:** `role="status"` para leitores de ecrã; `currentColor` no ponto evita repetir cores.

### ArticleLoader
- **Faz:** campo de URL + botão **Carregar artigo**; mostra o título, a semana e o nº de perguntas depois de carregar.
- **Props:** `onLoad(url)`, `loading`, `error`, `article` (`{title, week, questions}`).
- **Estado local:** o texto do input (`useState`).
- **Dicas:** Enter também carrega (`<form onSubmit>`); desative o botão com URL vazio ou `loading`; mostre `error` por baixo do input.
- **Atenção:** a API aceita só URLs de `wol.jw.org`/`jw.org`. A mensagem de erro já vem em português.

### QuestionToolbar
- **Faz:** linha com título "Perguntas", barra de progresso ("4 de 15 prontas") e botão **Preparar todas**.
- **Props:** `ready`, `total`, `running`, `onPrepareAll`, `onStop`.
- **Dicas:** `progress` = `ready/total`; enquanto corre a fila, o botão passa a "Parar".
- **Atenção:** a fila pára sozinha em erros de quota, autenticação ou rede (comportamento do `app.js` atual a manter).

### QuestionList
- **Faz:** percorre as perguntas e desenha um `QuestionCard` por cada.
- **Props:** `questions`, `states` (mapa `número → estado`), e as callbacks.
- **Dicas:** use `key={q.number}`; não guarde estado aqui, só reparta.
- **Atenção:** `number` pode repetir-se entre itens do caderno de meio de semana? No parser atual, é único por artigo. Se houver duplicados, use `label`.

### QuestionCard
- **Faz:** o cartão principal de uma pergunta (etiqueta, texto, badge, caixa de resposta, ações, texto-base).
- **Props:** `question` (`{number,label,text,hasParagraph}`), `state` (ver abaixo), `answer`, `error`, `onPrepare`, `onChange(text)`, `onInsert`, `onCopy`.
- **Estados:** `pending` · `loading` · `ready` · `error` · `inserted` · `no_source` (tabela em `DESIGN.md`).
- **Dicas:** renderize por estado com um `switch` em vez de muitos `&&`; só uma ação primária por cartão.
- **Atenção:** `no_source` vem de `hasParagraph === false` (perguntas pessoais sem texto-base → "responda manualmente").

### StatusBadge
- **Faz:** selo no canto do cartão com o estado.
- **Props:** `state`.
- **Dicas:** um objeto `{ pending: {label, tone}, … }` evita ifs.

### AnswerBox
- **Faz:** `textarea` editável com a resposta.
- **Props:** `value`, `onChange`, `disabled`.
- **Dicas:** grave o texto editado com **debounce** (≈ 600 ms) via `PUT /api/answers`, não a cada tecla.
- **Atenção:** a resposta guardada tem `model`; respostas de `mock` não devem aparecer fora do modo mock (o servidor já filtra no `/api/flow/detect`).

### CardActions
- **Faz:** linha de botões **Inserir no telemóvel** (primário), **Copiar**, **Refazer** e **Ver texto-base**.
- **Props:** `disabled`, `inserting`, `onInsert`, `onCopy`, `onRedo`, `onToggleSource`.
- **Dicas:** `inserting` → texto "A inserir…" e botão desativado (demora cerca de 3 s). Copiar: `navigator.clipboard.writeText` (funciona em `localhost`), ou `POST /api/clipboard`.
- **Atenção:** mostre os erros de inserção por baixo dos botões, com a mensagem `error` da API. Os códigos `question_not_visible` e `field_offscreen` significam "role até à pergunta no telemóvel".

### SourceText
- **Faz:** bloco colapsável com os parágrafos/referências usados (campo `paragraphs` da resposta).
- **Props:** `paragraphs: string[]`, `open`.
- **Dicas:** `<details>` nativo chega.

### DevicePanel
- **Faz:** lista de 4 verificações (ADB, autorizado, JW Library instalada, em primeiro plano) + botão **Atualizar**.
- **Props:** `status`, `onRefresh`.
- **Dados:** `useDeviceStatus()`, que faz polling de 5 s (`setInterval` com limpeza no `useEffect`).
- **Atenção:** limpe o intervalo no `return` do `useEffect`, senão acumula timers.

### CheckRow
- **Faz:** uma linha com ✓/✕ e o texto.
- **Props:** `ok: boolean`, `label`, `hint?`.

### OpenQuestionPanel
- **Faz:** deteta que pergunta está aberta no telemóvel e permite inserir a resposta dela.
- **Props:** `url` (do artigo), `onInserted`.
- **Fluxo:** **Detetar** → `POST /api/flow/detect` → mostra `label` e `question` → **Inserir resposta** usa `answer` (se existir) com `POST /api/device/insert {text, url, number}`.
- **Atenção:** `found:false` não é erro; mostre `message`. Se `answer` for `null`, convide a preparar a resposta no cartão.
- **Diagnóstico:** `<details>` com `GET /api/device/screen` (JSON) para ajudar a depurar.

### AdvancedTools
- **Faz:** `<details>` que agrupa os recursos antigos: "Perguntar com fontes oficiais" (`POST /api/ai/ask`) e "Inserir resposta" por clipboard.
- **Dicas:** deixe fechado por defeito; implemente por último.

---

## 3. Hooks

| Hook | Devolve | Notas |
|---|---|---|
| `useConfig` | `{aiProvider, deviceMock}` | uma vez ao arrancar |
| `useDeviceStatus` | `{status, refresh}` | polling 5 s; limpar o intervalo |
| `useArticle` | `{article, load, loading, error}` | após carregar, buscar `/api/answers?url=` e preencher as respostas |
| `useQuestionQueue` | `{run, stop, running}` | processa **uma** pergunta de cada vez; pára em `quota`/`auth`/`unavailable` |

## 4. Ordem sugerida de construção
1. `tokens.css` + `StatusChip` + `AppHeader` (já vê o resultado no topo).
2. `api/client.js` + `useConfig` + `useDeviceStatus` + `DevicePanel` + `CheckRow`.
3. `ArticleLoader` + `useArticle` (carrega e lista as perguntas em texto simples).
4. `QuestionCard` + `StatusBadge` + `AnswerBox` + `CardActions` (primeiro com dados fixos, depois com a API).
5. `QuestionToolbar` + `useQuestionQueue`.
6. `OpenQuestionPanel`, `SourceText` e `AdvancedTools`.

## 5. Como testar o front sem gastar a IA
Arranque o backend com `npm run dev` (IA simulada) ou `npm run dev:offline` (IA e telemóvel simulados) e, em `web/`, `npm run dev`. O proxy do Vite aponta `/api` para `http://localhost:3000`.
