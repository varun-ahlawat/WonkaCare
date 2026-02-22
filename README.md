# Meredith

Hospital voice agent powered by Vapi. Call a phone number, talk to Meredith.

## Setup

1. Copy `.env.example` to `.env.local` and add your Vapi private API key

## Dev

```
npm run dev
```

## How it works

- `scripts/setup-vapi.ts` — one-time script that provisions the assistant + phone number via Vapi API
- `src/app/api/vapi/route.ts` — webhook handler for Vapi server events (call reports, etc.)
- `src/app/page.tsx` — status page showing the phone number
