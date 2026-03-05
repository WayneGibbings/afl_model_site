# Plan: Add Genie Chat Page

## Context
Add a natural language chat page to the AFL model site that queries data via an existing Databricks Genie Space. Users type questions like "Which team has the best win rate?" and get back SQL-generated results. The Databricks PAT token must never be exposed to the browser, so a Firebase Cloud Function acts as a proxy.

## Architecture

```
Browser (/chat page)  -->  Firebase Hosting rewrite (/api/genie)
                           -->  Cloud Function (genieProxy)
                                -->  Databricks Genie REST API
                                     (token stored as Firebase secret)
```

Same-origin routing via `firebase.json` rewrite eliminates CORS issues.

## Implementation Steps

### 1. Shared types — `src/lib/genie-types.ts`
- `GenieRequest` discriminated union: `start | message | poll | result` actions
- `GenieStartResponse`, `GeniePollResponse`, `GenieQueryResult` response types
- `ChatMessage` type for UI state (role, content, status, queryResult, error)

### 2. Firebase Cloud Function — `functions/`

**New files:**
- `functions/package.json` — deps: `firebase-functions`, `firebase-admin`, `typescript`
- `functions/tsconfig.json` — target Node 20
- `functions/src/index.ts` — single `genieProxy` onRequest handler (2nd gen)

**Function logic (`functions/src/index.ts`):**
- Secrets via `defineSecret()`: `DATABRICKS_HOST`, `DATABRICKS_PAT`, `GENIE_SPACE_ID`
- Single POST endpoint, `action` field routes to Databricks API:
  - `start` → `POST /api/2.0/genie/spaces/{id}/start-conversation` body `{content}`
  - `message` → `POST /api/2.0/genie/spaces/{id}/conversations/{cid}/messages` body `{content}`
  - `poll` → `GET .../messages/{mid}` — returns status + text attachment + hasQueryResult flag
  - `result` → `GET .../messages/{mid}/query-result` — returns columns + data rows
- Simple IP-based rate limiting (~10 req/min)
- Sanitized error responses (never leak token/internals)

### 3. Update `firebase.json`
Add functions config + hosting rewrite:
```json
{
  "hosting": {
    "rewrites": [{ "source": "/api/genie", "function": "genieProxy" }]
  },
  "functions": { "source": "functions", "runtime": "nodejs20" }
}
```

### 4. Frontend API client — `src/lib/genie-client.ts`
- `genieStart(content)`, `genieMessage(conversationId, content)`, `geniePoll(conversationId, messageId)`, `genieResult(conversationId, messageId)`
- `sendAndPoll(content, conversationId?, onStatusChange?)` — orchestrates the full lifecycle: start/message → poll with exponential backoff (2s→5s, 120s timeout) → fetch result if available. Calls `onStatusChange(status)` on each poll so the UI can show real-time progress phases.
- Uses `AbortController` for cancellation on unmount

### 5. Chat components

**`src/components/chat/ResultTable.tsx`**
- Renders query results using `.data-table` CSS class
- Caps display at 100 rows with "showing X of Y" notice

**`src/components/chat/ChatMessageBubble.tsx`**
- User messages: right-aligned, teal background
- Assistant messages: left-aligned, card-like surface
- Embeds `ResultTable` when queryResult is present
- **Rich loading state for 20-30s waits** (see detail below)

**`src/components/chat/ChatInput.tsx`**
- Text input + gold-accented send button
- Disabled while processing; submit on Enter

**`src/components/chat/SampleQuestions.tsx`**
- Grid of clickable suggestion chips shown in empty state
- Example questions relevant to AFL data

### 6. Chat page — `src/app/chat/page.tsx`
- `"use client"` component
- State: `messages: ChatMessage[]`, `conversationId: string | null`, `isProcessing: boolean`
- Page header with `.page-header` / `.page-title` pattern
- Message list (auto-scroll to bottom) + sample questions (empty state) + input bar
- Message lifecycle: add user msg → add placeholder assistant msg → sendAndPoll → update with result
- Cleanup: AbortController on unmount

### 7. Navigation — `src/components/layout/Navbar.tsx`
Add `{ href: "/chat", label: "Ask" }` to `navItems` array (before "How It Works").

### 8. Loading UX (critical — Genie takes 20-30s)

The assistant bubble shows a **multi-phase progress indicator** while waiting:

1. **Animated typing indicator** — three pulsing dots in brand teal, always visible during processing
2. **Status text that updates as polling progresses** — each poll response includes a `status` field:
   - `FETCHING_METADATA` → "Understanding your question..."
   - `ASKING_AI` → "Generating query..."
   - `EXECUTING_QUERY` → "Running query against the data..."
   - `COMPLETED` → replaced with actual result
   - `FAILED` → error message
3. **Elapsed time counter** — subtle "12s" timer below the dots so the user knows it's still active (not frozen)
4. **Shimmer/skeleton on the bubble** — a gentle shimmer gradient animation on the assistant bubble background to reinforce activity

All of this lives in `ChatMessageBubble.tsx` when `message.status` is not yet `COMPLETED`/`FAILED`. The polling loop in `genie-client.ts` calls an `onStatusChange` callback so the UI updates in real-time as Genie progresses through phases.

### 9. CSS — `src/app/globals.css`
- `chatIn` keyframe animation for message bubbles
- `.chat-loading-dot` pulsing animation (three dots, staggered delay)
- `.chat-shimmer` subtle gradient sweep animation on loading bubbles
- `.chat-timer` styling for the elapsed time counter

### 9. Dev environment
- `next.config.ts`: add `rewrites()` for dev proxy to Firebase emulator (`http://localhost:5001/...`)
  - Only used in dev; `output: "export"` ignores rewrites at build time
- `.gitignore`: add `functions/node_modules/`, `functions/lib/`

## Files to create/modify

| File | Action |
|------|--------|
| `src/lib/genie-types.ts` | Create |
| `functions/package.json` | Create |
| `functions/tsconfig.json` | Create |
| `functions/src/index.ts` | Create |
| `firebase.json` | Modify — add functions + rewrite |
| `src/lib/genie-client.ts` | Create |
| `src/components/chat/ResultTable.tsx` | Create |
| `src/components/chat/ChatMessageBubble.tsx` | Create |
| `src/components/chat/ChatInput.tsx` | Create |
| `src/components/chat/SampleQuestions.tsx` | Create |
| `src/app/chat/page.tsx` | Create |
| `src/components/layout/Navbar.tsx` | Modify — add "Ask" nav item |
| `src/app/globals.css` | Modify — add chat animations |
| `next.config.ts` | Modify — add dev rewrites |
| `.gitignore` | Modify — add functions build artifacts |

## Existing patterns to reuse
- `.page-header` / `.page-title` classes (all existing pages)
- `.card` class for message container
- `.data-table` class for query results (`src/app/globals.css`)
- Design variables: `--brand`, `--gold`, `--surface`, etc.
- `navItems` array pattern in Navbar.tsx

## Verification
1. `cd functions && npm install && npm run build` — function compiles
2. `firebase emulators:start` — function runs locally
3. `npm run dev` — chat page renders, dev proxy routes to emulator
4. Send a test question → verify polling → verify result table renders
5. `npm run build` — static export still works (chat page exports as client-only shell)
6. `npm run typecheck && npm run lint` — no errors
