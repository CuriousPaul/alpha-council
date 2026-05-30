# Alpha Council

Alpha Council is a multi-agent crypto market research MVP. It turns BTC market signals into a risk score, lets several AI analyst personas vote independently, and produces a Korean risk report with Telegram-ready alert copy.

Production: https://alpha-council-five-brown.vercel.app

## Features

- BTC risk analysis dashboard
- Rule-based signal engine
- Multi-agent council votes
- Korean final report and Telegram alert copy
- Risk score threshold alert flow for Telegram
- Demo data fallback when API keys are not configured

## Stack

- React + TypeScript + Vite
- Node.js + Express
- Vercel static frontend and serverless API
- ApiFuse gateway client for external API calls
- CryptoQuant-style market data integration path
- cocoun MCP integration for council prediction
- Telegram Bot API integration path

## Local Development

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173

API: http://localhost:8787

## Environment Variables

The app runs without secrets in demo data mode. Add these for live integrations:

```bash
APIFUSE_API_KEY=
APIFUSE_CRYPTOQUANT_PROVIDER_ID=cryptoquant
APIFUSE_TELEGRAM_PROVIDER_ID=
APIFUSE_TELEGRAM_SEND_MESSAGE_OPERATION=
COCOUN_API_KEY=
COUNCIL_MCP_URL=https://asia-northeast3-cocouns-v.cloudfunctions.net/mcp
CRYPTOQUANT_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

ApiFuse gateway calls use `POST /v1/{providerId}/{operationId}`. If a provider or operation is not enabled in ApiFuse yet, the app falls back to demo data and reports the gateway warning in the API response.

## Build

```bash
npm run typecheck
npm run build
```
