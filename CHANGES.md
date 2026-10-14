# AI Travel Planner - Added Features

## 1. AI Chat Assistant
- Added a floating AI assistant available after login.
- Reuses the existing Gemini integration.
- Supports recent conversation context, Markdown replies, quick prompts, loading state and auto-scroll.
- New backend endpoint: `POST /api/ai/chat` (JWT protected).

## 2. Itinerary Download
- Added **Download / Save PDF** to the generated itinerary.
- Uses the browser print dialog, so no extra PDF package is required. Choose **Save as PDF** in the print dialog.

## 3. AI Planner UI polish
- Added a gradient background, glass-style planner card, improved CTA, icons and responsive spacing.

## Files changed
- `backend/controllers/aiController.js`
- `backend/routes/aiRoutes.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/AIPlanner.jsx`

## File added
- `frontend/src/components/AIChatAssistant.jsx`

## Setup
No new npm packages are required. The project already contains `react-icons` and `react-markdown`.

Keep the existing backend environment variable:

`GEMINI_API_KEY=your_gemini_api_key`

Do not commit real API keys to GitHub.


## Input validation hardening
- AI Planner now validates destination format, budget, and 1-30 day duration before calling Gemini.
- Backend repeats the same critical checks, so direct API/Postman requests cannot bypass validation.
- Create Trip validates trip name, destination, budget, date order, and a maximum 30-day trip duration.
- Common non-Earth destinations are rejected as outside this application's real-world travel scope.
- Invalid backend requests return HTTP 400 with a useful message; Gemini is not called.
- No new npm packages or environment variables are required.

Note: format validation cannot prove every city/place exists. Production-grade destination verification should use a geocoding/Places API before AI generation.

## Chatbot reliability and RAG updates
- Bound and validate chat messages and recent history; stopped logging user message contents.
- Added per-user rate limiting to the authenticated chat route.
- Changed expense tool behavior to prepare a draft. A separate authenticated endpoint revalidates ownership, category, amount, and trip dates before saving, after explicit UI confirmation.
- Hardened weather tool input, timeouts, HTTP status handling, and response-shape checks.
- Replaced the process-local JSON embedding store with Qdrant. Knowledge chunks are embedded with Gemini, stored with source/hash metadata, and re-indexed only when the source file changes. Qdrant uses a persistent Docker volume locally and can be configured as a managed service.
- Updated the quick prompts and architecture/setup documentation. Added a secret-free `.env.example`; Compose now requires an explicit JWT secret.
- Chat conversations and messages are stored in MySQL with per-user ownership checks; the browser stores only the conversation ID and restores prior turns after refresh. The model receives only the latest eight turns.

