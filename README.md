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
- CryptoQuant-style market data client
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
CRYPTOQUANT_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## Build

```bash
npm run typecheck
npm run build
```
