# ImmoPilot

ImmoPilot is a React/Vite SaaS workspace for Belgian real-estate agents: dashboard, property CRM, pipeline, contacts, agenda, transfers, commissions, notifications, settings, and admin screens.

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS v4 via `@tailwindcss/vite`
- Supabase Auth/Postgres through `@supabase/supabase-js`
- Lucide React icons
- Self-hosted fonts through `@fontsource`

## Local Development

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill the Supabase values.
3. Start the app:
   `npm run dev`

The dev server runs on `http://127.0.0.1:3000`.

## Verification

Run before committing frontend or dependency changes:

```bash
npm run build
npm run lint
```
