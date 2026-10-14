::: {align="center"}
# ✈️ Roamly

### AI-Powered Intelligent Travel & Expense Management Platform

**Plan trips. Track spending. Ask your data. Get grounded AI
recommendations.**

[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/Database-MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Cache%20%2F%20Queue-Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/DevOps-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![LangChain](https://img.shields.io/badge/AI-LangChain-1C3C3C?style=for-the-badge)](https://www.langchain.com/)
[![Gemini](https://img.shields.io/badge/LLM-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
:::

------------------------------------------------------------------------

## 🧭 What is Roamly?

Roamly is a full-stack **AI travel and expense management platform**
designed around one idea:

> **Your travel planner should understand your trip, your spending, and
> your questions---not just generate a static itinerary.**

The platform combines a conventional travel-management backend with
modern AI and infrastructure patterns:

-   🤖 **Tool-calling travel assistant** with Gemini + LangChain
-   📚 **RAG** with Gemini embeddings and a persistent Qdrant vector database
-   ⚡ **Redis caching** to reduce repeated AI calls
-   📨 **BullMQ background processing** for asynchronous jobs
-   🔴 **Socket.IO real-time updates** with trip-scoped rooms
-   📊 **Budget intelligence** using deterministic statistical
    prediction
-   🚨 **Expense anomaly detection**
-   🗺️ **AI-generated map locations** rendered with Leaflet
-   🩺 **Prometheus metrics + health checks**
-   🐳 **Docker Compose multi-service environment**
-   🔄 **GitHub Actions CI**

------------------------------------------------------------------------

## ✨ Why this project is different

This is not just:

``` text
React → Express → MySQL
```

It is a small production-style system where different engineering
patterns solve different problems:

  Problem                             Solution
  ----------------------------------- ---------------------------
  Secure user access                  JWT + bcrypt
  Repeated AI requests                Redis cache
  Long-running operations             BullMQ + Redis Worker
  Application-specific AI knowledge   RAG
  AI actions over application data    LangChain tool calling
  Live trip updates                   Socket.IO rooms
  Spending forecasting                Statistical prediction
  Unusual expense detection           Mean + standard deviation
  API visibility                      Swagger/OpenAPI
  Runtime observability               Prometheus
  Reproducible local environment      Docker Compose
  Automated validation                GitHub Actions

------------------------------------------------------------------------

## 🏗️ Architecture

![Roamly Architecture](docs/architecture.png)

### High-level request flow

``` text
User
  ↓
React Frontend
  ↓
Express API
  ├── MySQL
  ├── Redis
  ├── Chat tool loop → Gemini
  │          └→ RAG Knowledge Base
  ├── Socket.IO
  └── BullMQ → Redis → Worker
```

------------------------------------------------------------------------

# 🧠 AI Architecture

## 1. Chat and tool calling

The app uses **React + Node.js/Express + MySQL** for the application stack. It is not currently a MERN application. The chat endpoint calls Gemini through LangChain and exposes a small set of server-side tools. Gemini selects a tool and returns structured arguments; Express validates and executes the tool, then sends the result back to Gemini for a user-facing answer. The model never gets direct database credentials.

Current chat tools:

- List the authenticated user's trips.
- Read one owned trip's budget and expense totals.
- Prepare an expense draft. The app saves it only after the user clicks **Confirm expense**; the confirmation endpoint rechecks ownership, category, amount, and trip dates.
- Search the travel policy knowledge base.
- Fetch current conditions and a short forecast from wttr.in.

Chat turns are stored in MySQL and each conversation is owned by its authenticated user. The browser stores only the conversation ID; the backend loads the latest eight turns for model context and returns up to 50 messages when restoring the conversation. Chat requests are JWT-protected and limited to 30 per user per 15 minutes using the default in-memory limiter. Horizontal deployments need a shared limiter store (for example Redis) to enforce one limit across replicas.

```text
React chat → authenticated Express route → Gemini (LangChain)
                                      ↕ function/tool calls
                  MySQL trip tools / Qdrant retrieval / weather API
```

This is a **bounded tool-calling assistant**, not an autonomous general-purpose agent. Side-effecting expense writes require an explicit UI confirmation.

## 2. RAG with Qdrant

The backend reads `backend/knowledge_base.txt`, splits it into overlapping chunks, embeds each chunk with Gemini `gemini-embedding-2` (768 dimensions), and stores vectors and source metadata in Qdrant. A content hash avoids re-indexing an unchanged file. When the file changes, its old chunks are replaced. Qdrant persists locally through the `qdrant_data` Docker volume; for deployment, configure a managed Qdrant endpoint and API key.

At query time, the knowledge tool embeds the question, searches Qdrant for the nearest chunks, applies a relevance threshold, and returns the chunk text and source filename to Gemini. If there is no sufficiently relevant result or Qdrant is unavailable, the tool says so; the system prompt directs the assistant not to present an unsupported policy answer as verified.

```text
knowledge_base.txt → chunking → Gemini embeddings → Qdrant collection
User policy question → query embedding → Qdrant top-k + threshold
                   → source-labelled context → Gemini answer
```

RAG reduces the need to rely on the model's general knowledge for app-specific policies. It does not guarantee correctness; the source content, retrieval threshold, and generated answer still need evaluation.

## 3. Model provider and orchestration

Gemini remains the language and embedding provider. LangChain provides message and tool-call abstractions; it does not replace the Gemini API. Application code is responsible for authorization, validation, tool execution, confirmation, and handling failures.
# ⚡ 3. Redis Caching

AI generation can be expensive and slow when the same request is
repeated.

Roamly caches generated itineraries.

``` text
AI Request
    ↓
Redis GET
    │
    ├── Cache HIT ─────→ Return cached itinerary
    │
    └── Cache MISS
             ↓
           Gemini
             ↓
          Redis SET
             ↓
        Return result
```

Generated itinerary cache entries are stored with a **24-hour TTL**.

Redis also acts as the infrastructure layer for BullMQ.

So Redis has two roles:

``` text
Redis
 ├── Fast application cache
 └── BullMQ queue backend
```

------------------------------------------------------------------------

# 📨 4. Background Job Processing

Long-running operations can be moved away from the request-response path
using BullMQ.

``` text
API / Producer
      ↓
   BullMQ
      ↓
    Redis
      ↓
 Background Worker
      ↓
 AI / Database Work
      ↓
 Job Status / Result
```

This architecture allows the API and background processing to scale
independently.

> **Note:** The current synchronous AI planner endpoint can generate an
> itinerary directly, while the repository also contains the BullMQ
> worker architecture for asynchronous AI jobs.

------------------------------------------------------------------------

# 🔴 5. Real-Time Trip Updates

Roamly uses Socket.IO to keep users viewing a trip synchronized.

Each trip gets its own Socket.IO room.

``` text
Trip #101
 ├── User A
 ├── User B
 └── User C

        ↓

Socket Room: "101"
```

When an expense changes:

``` text
Expense Update
     ↓
Database Update
     ↓
Socket.IO Event
     ↓
trip_updated
     ↓
Only clients in that trip room refresh
```

This prevents unrelated users/trips from receiving unnecessary updates.

------------------------------------------------------------------------

# 💰 Budget Intelligence

Roamly does not pretend that a simple formula is a sophisticated trained
ML model.

The current budget intelligence layer uses **deterministic statistical
methods**.

## Spending projection

``` text
Total Spent
    ↓
Active Spending Days
    ↓
Average Daily Spend
    ↓
Remaining Days
    ↓
Projected Final Spend
```

Conceptually:

``` text
Average Daily Spend = Total Spent / Active Days

Projected Spend =
Current Spend + Average Daily Spend × Remaining Days
```

## Anomaly detection

Expense values are evaluated using mean and standard deviation.

``` text
Expenses
   ↓
Mean + Standard Deviation
   ↓
Upper Threshold
   ↓
Unusually large expense?
   ├── No → Normal
   └── Yes → Anomaly
```

This keeps the feature explainable and deterministic.

------------------------------------------------------------------------

# 🔐 Security

Security is handled at multiple layers:

-   **bcrypt** password hashing
-   **JWT** authentication
-   Protected API routes
-   User/trip ownership checks
-   Input validation
-   Request-size limits
-   Helmet security headers
-   Environment-based secrets
-   Trip-scoped Socket.IO rooms

### Authentication flow

``` text
Login
  ↓
Validate credentials
  ↓
Fetch user
  ↓
bcrypt.compare()
  ↓
JWT signed with secret
  ↓
Client stores token
  ↓
Protected request
  ↓
JWT verification middleware
  ↓
req.user
  ↓
Authorized controller
```

------------------------------------------------------------------------

# 🗄️ Data Model

The core relational model is centered around users, trips and expenses.

``` text
User
 ├── Trips
 │    └── Expenses
 │
 ├── Preferences
 │
 └── AI Jobs
```

This relational design allows trip ownership, expense aggregation and
user-specific AI operations to remain consistent.

------------------------------------------------------------------------

# 🐳 Docker Architecture

The application can be started as a multi-container stack:

``` text
┌─────────────────────────────────────┐
│           Docker Compose            │
│                                     │
│  Frontend                           │
│      │                              │
│      ▼                              │
│  Backend ───────► MySQL             │
│      │                              │
│      ├───────────► Redis             │
│      │               │              │
│      │               ▼              │
│      └──────────► Worker             │
│                                     │
└─────────────────────────────────────┘
```

### Services

  Service      Purpose
  ------------ -------------------------------------
  `frontend`   React/Vite application
  `backend`    Express REST API + AI orchestration
  `mysql`      Persistent relational data
  `redis`      Cache + BullMQ backend
  `worker`     Background job processing

------------------------------------------------------------------------

# 📈 Observability

Two important endpoints are exposed:

### Health

``` text
GET /health
```

Used to verify application and database health.

### Metrics

``` text
GET /metrics
```

Exposes Prometheus-compatible metrics such as HTTP request duration and
request information.

This creates a foundation for monitoring the application in a production
environment.

------------------------------------------------------------------------

# 🔄 CI

GitHub Actions is used to validate changes automatically.

The CI workflow covers:

-   Dependency installation
-   Frontend build/lint validation
-   Docker Compose configuration validation
-   Pull-request / main-branch checks

This helps catch integration and build problems before deployment.

------------------------------------------------------------------------

# 🧰 Technology Stack

### Frontend

-   React
-   Vite
-   Tailwind CSS
-   Axios
-   React Router
-   Socket.IO Client
-   React Leaflet
-   Recharts

### Backend

-   Node.js
-   Express
-   MySQL
-   JWT
-   bcrypt
-   Socket.IO
-   Redis
-   BullMQ
-   Qdrant (travel knowledge vector store)

### AI

-   Google Gemini
-   LangChain
-   Tool Calling
-   RAG
-   Gemini Embeddings
-   Statistical budget intelligence

### DevOps / Observability

-   Docker
-   Docker Compose
-   GitHub Actions
-   Prometheus
-   Swagger / OpenAPI

------------------------------------------------------------------------

# 📁 Project Structure

``` text
trip-plannerv2/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   └── ...
│   ├── Dockerfile
│   └── package.json
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── config/
│   ├── worker.js
│   ├── server.js
│   └── package.json
│
├── tripplanner.sql
├── docker-compose.yml
├── .github/
│   └── workflows/
│
└── docs/
    └── architecture.png
```

------------------------------------------------------------------------

# 🚀 Run Locally

## Prerequisites

Make sure you have:

-   Docker
-   Docker Compose
-   Git

For AI chat and RAG, configure a Gemini API key and start Qdrant. See the chatbot setup notes below.

------------------------------------------------------------------------

## 1. Clone

``` bash
git clone https://github.com/Vikramshivraj/trip-plannerv2.git
cd trip-plannerv2
```

## 2. Configure environment

Copy the repository's `.env.example` to a root `.env` file and replace both placeholder secrets. Do not commit `.env`.

``` bash
cp .env.example .env
```

At minimum, configure:

``` env
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_long_random_secret
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=travel_knowledge
RAG_MIN_SCORE=0.35
```

Keep secrets out of Git.

## 3. Start the complete stack

``` bash
docker compose up --build
```

### Available services

  Service              URL
  -------------------- --------------------------------
  Frontend             http://localhost:5173
  Backend API          http://localhost:5000
  Swagger              http://localhost:5000/api-docs
  Prometheus metrics   http://localhost:5000/metrics
  Health               http://localhost:5000/health
  Qdrant               http://localhost:6333 (local development; persistent qdrant_data volume)

MySQL and Redis are available to the application through the Docker
Compose network.

------------------------------------------------------------------------

# 🧪 Testing

Backend tests:

``` bash
cd backend
npm test
```

Frontend:

``` bash
cd frontend
npm install
npm run dev
```

Backend without Docker:

Start Qdrant separately and set `QDRANT_URL=http://localhost:6333` in the backend process environment (the Compose default `http://qdrant:6333` is only reachable from containers).


``` bash
cd backend
npm install
npm run dev
```

------------------------------------------------------------------------

# 🔌 API Overview

The backend exposes REST endpoints for:

-   Authentication
-   User preferences
-   Trips
-   Expenses
-   Trip analytics
-   AI itinerary generation
-   AI assistant chat (`POST /api/ai/chat`)
-   Restore a conversation (`GET /api/ai/chat/:conversationId`)
-   Confirm an expense draft (`POST /api/ai/chat/confirm-expense`)
-   Health checks
-   Prometheus metrics

Interactive API documentation:

``` text
http://localhost:5000/api-docs
```

------------------------------------------------------------------------

# 🧠 Engineering Decisions

### Why MySQL?

The application has strongly relational entities such as users → trips →
expenses. MySQL provides transactions, foreign keys and reliable
relational queries.

### Why Qdrant?

Qdrant stores the travel knowledge vectors and source payloads independently of the application container. The local Compose setup mounts a persistent named volume; deployments should use a secured managed Qdrant endpoint.

### Why Redis?

Redis provides low-latency caching and also acts as the backend for
BullMQ.

### Why BullMQ?

AI and other long-running operations can be processed asynchronously
without keeping the HTTP request open.

### Why RAG?

RAG allows the assistant to retrieve application-specific knowledge
dynamically without retraining the LLM.

### Why tool calling?

Gemini can request a named tool, while the Express backend enforces authorization and validation before accessing data or preparing an action. Expense writes require a separate user confirmation.

### Why Socket.IO?

It provides event-driven real-time updates without repeatedly polling
the server.

### Why Docker Compose?

The application consists of multiple dependent services. Compose
provides one reproducible environment for running the complete stack.

------------------------------------------------------------------------

# 🎯 Interview Highlights

If you are presenting this project in an interview, focus on these
engineering stories:

``` text
1. Authentication
   JWT + bcrypt + authorization

2. AI Architecture
   Gemini + LangChain + Tool Calling

3. RAG
   Chunking → Embeddings → Similarity Search → Context

4. Performance
   Redis caching + 24h itinerary TTL

5. Async Architecture
   BullMQ + Redis + Worker

6. Real-Time Systems
   Socket.IO trip rooms

7. Data Consistency
   MySQL transactions + ownership checks

8. Intelligence
   Spending projection + anomaly detection

9. Observability
   Prometheus + health checks

10. DevOps
    Docker Compose + GitHub Actions
```

------------------------------------------------------------------------

# 📌 What I learned building this

This project was built to go beyond CRUD and explore how modern
applications combine:

**Full-Stack Development + AI Engineering + Backend Architecture +
Distributed Processing + Real-Time Systems + DevOps + Observability**

The goal was not only to make the application work, but to understand
**why each architectural component exists and what problem it solves.**

------------------------------------------------------------------------

::: {align="center"}
### ✈️ Plan smarter. Spend better. Travel further.

Built with React, Node.js, MySQL, Redis, LangChain, Gemini and Docker.
:::









