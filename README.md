# wcschedules.com

World Cup 2026 schedule with automatic timezone conversion for global fans.

## Stack

- Pure static HTML + Vanilla JS (no build step)
- Vercel serverless functions for `/api/*` endpoints
- Deployed on Vercel, domain via Namecheap

## Local development

No `npm install` required for the frontend. Just open `public/index.html` in a browser.

For testing the `/api/subscribe` endpoint locally:

```bash
npm install -g vercel
vercel dev
```

## Deployment

Connected to GitHub `main` branch. Every push auto-deploys to production.

## Project structure

```
wcschedules/
├── public/              # static assets (deployed as-is)
│   ├── index.html       # homepage
│   ├── css/style.css
│   └── js/app.js
├── api/                 # Vercel serverless functions
│   └── subscribe.js     # email collection endpoint
├── data/                # JSON: matches, teams, stadiums (to be added)
├── vercel.json          # routing config
└── package.json
```

## Roadmap

- [x] v0.1 — Landing page with countdown + email signup
- [ ] v0.2 — Full 104-match schedule with timezone toggle
- [ ] v0.3 — 32 team pages + 16 stadium pages
- [ ] v0.4 — MailerLite integration for match reminders
- [ ] v0.5 — AdSense + affiliate links (VPN, hotels)
