# Workflow dashboard

Admin UI for the AI business workflow. Next.js (App Router) + Tailwind + shadcn/ui + Recharts.

```
copy .env.example .env.local   # set API_URL if FastAPI is not on http://localhost:8000
npm install
npm run dev                    # http://localhost:3000
```

Sign in with the API's `ADMIN_API_KEY`. See the root [README](../README.md#dashboard) for setup.

## How it fits together

- Pages are Server Components that call FastAPI through [src/lib/api.ts](src/lib/api.ts) with the key from an
  httpOnly cookie. Approve, reject, retry, login and logout are Server Actions in [src/app/actions.ts](src/app/actions.ts).
- [src/proxy.ts](src/proxy.ts) redirects visitors without a session to `/login`; FastAPI checks the key on every call.
- Filters are URL query parameters (`/emails?status=failed`, `/?days=30`), so views can be bookmarked.
- Email pages refresh themselves every few seconds while the agent is still working on an email.
- Chart colours are tokens in [src/app/globals.css](src/app/globals.css) (`--chart-*`, `--status-*`) and follow the
  OS light/dark setting.
