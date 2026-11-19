# JW Answer Assistant

## Requisitos
Node.js 20.12+ (testado em 22), ADB e (mais tarde) Scrcpy.

## Configuração
1. `npm install`
2. `cp .env.example .env` e preencha `ADB_PATH` (e `SCRCPY_PATH`). Sem `ADB_PATH` usa-se `adb` do PATH.
3. `npm start` e abra http://localhost:3000

## Scripts
- `npm start` – servidor com a IA **real** (Gemini, gasta quota)
- `npm run start:mock` – servidor com IA **simulada** (sem custo; aparece o aviso "Modo MOCK")
- `npm run dev` – mock + recarrega ao editar código (desenvolvimento da UI/automação)
- `npm run dev:real` – IA real + recarrega ao editar
- No mock, `MOCK_ERROR=quota npm run dev` simula erros (`quota`, `auth`, `timeout`, `unavailable`, `empty`)
- `npm test` – testes dos parsers (sem dispositivo)
- `npm run clipboard` – prova de conceito do clipboard (index.js)

## API
- `POST /api/answer` `{question}` – pesquisa em wol.jw.org (domínio validado no código) e o Gemini responde só com esses trechos; devolve texto + fontes.
- `POST /api/ai/ask` `{question}` – pergunta direta ao Gemini (sem fontes; apenas teste).
- `POST /api/clipboard` `{text}` – copia para o clipboard do macOS (pbcopy).
- `GET /api/device/status` – ADB, dispositivo autorizado, JW Library instalada/em primeiro plano.
