# AI-Powered Intelligent Travel Management Platform

An advanced Travel & Expense Planner utilizing Agentic AI, RAG (Retrieval-Augmented Generation), Background Job Processing, and Real-Time analytics.

## Features

- **Agentic AI Assistant**: Context-aware AI with live tool calling (weather, currency, trip data access) and RAG for knowledge base retrieval.
- **Background AI Jobs**: Long-running operations (like itinerary generation) handled asynchronously via Redis and BullMQ.
- **RAG Architecture**: Vector-search-based document retrieval for travel knowledge grounded responses using LangChain and Memory Vector Store.
- **Real-Time Updates**: Socket.IO authenticated rooms ensure users receive live updates without cross-user data leakage.
- **AI Budget Intelligence**: Deterministic ML prediction of final spending with statistical anomaly detection for unusual expenses. AI expense categorization.
- **Observability**: Prometheus metrics (`/metrics`) and `/health` check endpoints available.
- **CI/CD**: GitHub Actions pipeline for linting, dependency installation, build tests, and Docker Compose validation.
- **Dockerized**: Easy-to-use Docker Compose setup linking Frontend, Backend, MySQL DB, Redis Cache, and Worker nodes.

## Technology Stack

### Frontend
- React, Vite, Tailwind CSS, Axios, Socket.IO Client

### Backend
- Node.js, Express, MySQL, Redis, BullMQ, Socket.IO
- **AI**: Gemini 3.5 Flash, LangChain (`@langchain/core`, `@langchain/google-genai`), RAG Vector Stores

### DevOps
- Docker, Docker Compose, GitHub Actions, Prometheus

## Local Setup

### Environment Variables
Duplicate `.env.example` to `.env` in both `frontend` and `backend` directories and configure the values. Include your `GEMINI_API_KEY`.

### Running with Docker Compose (Recommended)

\`\`\`bash
docker-compose up --build
\`\`\`

The following services will run:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- API Docs (Swagger): `http://localhost:5000/api-docs`
- Prometheus Metrics: `http://localhost:5000/metrics`
- MySQL and Redis will be available internally.

### Database Setup

The database will be automatically initialized using `tripplanner.sql` when using Docker Compose. If running manually, import `tripplanner.sql` to your MySQL instance.

## Testing

Run backend tests using Jest:
\`\`\`bash
cd backend
npm test
\`\`\`

## Architecture Diagram (Logical)

\`\`\`mermaid
flowchart TD
  User((User)) -->|HTTP/WebSockets| React[Frontend React App]
  React -->|REST/Socket.IO| Backend[Backend Express API]
  Backend --> MySQL[(MySQL DB)]
  Backend --> Redis[(Redis Cache/Queue)]
  Backend --> Worker[BullMQ Worker]
  Worker --> Redis
  Worker --> MySQL
  Worker --> Gemini[Google Gemini AI]
  Backend --> AI[AI Agent Service]
  AI --> RAG[(Vector Knowledge Base)]
  AI --> Gemini
\`\`\`
