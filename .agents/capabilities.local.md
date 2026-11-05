# Fork-only capabilities

This file is **only for forks** — it is never edited in `front-template`. Extend the capability map
of [`AGENTS.md`](../AGENTS.md) here with what exists only in your fork, using the same row format.
On a merge from `front-template` this file always keeps the fork's version.

<!-- capability-map:start -->

| If you need… | Already exists | Entry point | Read |
| ------------ | -------------- | ----------- | ---- |
| Public portfolio content (also: services, projects, media, /api/public) | `PortfolioService.load()` (Worker-injected `window.jmPortfolioData`, else `/api/public`) | `src/app/modules/portfolio/services/portfolio.service.ts` | `worker/index.mjs` |
| Backend, CMS, uploads (also: D1, R2, /admin, login, Cloudflare) | Cloudflare Worker serving the Angular build and the API | `worker/index.mjs`, `wrangler.jsonc` | `README.md` > Portfolio |
| Scroll scenes, menu, project dialog, brief form | Legacy vanilla script started by `PortfolioHomePage` | `src/app/modules/portfolio/legacy/portfolio-motion.ts` | file header |
| Deploy to Cloudflare (also: publicar, wrangler deploy) | Skill `deploy-cloudflare` (`.claude/skills` links to it) | `bun run deploy` | [`.agents/skills/deploy-cloudflare/SKILL.md`](skills/deploy-cloudflare/SKILL.md) |
| Original hero illustration with cursor-following head and eyes | `HeroCharacterComponent` uses compositor-only CSS motion anchored at the shirt collar, without SVG filters; `HeroEyesComponent` retains pupil tracking; touch/reduced motion stays still | `src/app/modules/portfolio/components/hero-character/`, `src/app/modules/portfolio/components/hero-eyes/` | component comments |

<!-- capability-map:end -->

## Portfolio audience analytics

| If you need… | Already exists | Entry point | Read |
| ------------ | -------------- | ----------- | ---- |
| Anonymous audience metrics, project views, contact clicks, daily trends and period comparisons | First-party event collector with D1 storage and authenticated admin reports | `worker/analytics.mjs`, `public/static/analytics.js`, `/api/admin/analytics?days=7\|30\|90` | `worker/analytics.test.mjs` |

The public Worker injects the tracker into the portfolio shell. Project clicks use
the existing `data-service` project identifier. Reports use America/Guayaquil and
retain 180 calendar days to support two consecutive 90-day periods. Visitors are
daily HMAC pseudonyms, estimated from address and user agent; raw values are never
stored. Visitors and browser sessions can count again on another day. The collector
honors DNT/GPC and excludes known bots and requests with an admin session cookie.
No historical data is backfilled. Tables and the date index initialize automatically
in the existing D1 binding. Run `node --test worker/analytics.test.mjs` and
`bun run test:browser public/static/admin.e2e.ts` for the focused checks.
