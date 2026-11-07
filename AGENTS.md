# AGENTS.md

Context for AI agents (Claude Code, Copilot, Cursor, OpenCode, ...) working in this repo.
`front-template` is the base of every Neocore micro-frontend (MF): it is cloned/forked to start a
new MF and is never deployed as-is. It is an Angular 22 **remote** loaded at runtime by the host
`frontcontainer` through Native Federation.

This file is the **compass**: a short map of what already exists plus the mandatory rules. Details
live in [`.agents/`](.agents/); open the relevant doc before touching that area.

## Mandatory rules

- **GitHub destination requested by the owner:** publish completed portfolio changes to
  `https://github.com/jerathdesigner-prog/Ultimo-portafolio-.git`
  (remote `ultimo`, branch `main`). Commit and push approved updates there; the owner
  explicitly requested this as the default workflow. Do not push to the older
  `origin` repository (`jerathdesigner-prog/Portafolio`). Never include credentials,
  generated builds, local screenshots/logs or internal legal review notes.

- ⚠️ **Before building anything shared (`src/app/shared/`), check the capability map below** — reuse
  what exists instead of reimplementing it.
- ⚠️ **If you add, change the contract of, or remove a shared capability, update its map row in the
  same commit.** Fork-only capabilities go in [`.agents/capabilities.local.md`](.agents/capabilities.local.md).
- ⚠️ [Angular versions are pinned EXACTLY to the host's](.agents/host-integration.md#version-alignment)
  (`@angular/*` 22.2.1, `@angular/build`/`cli` 22.2.1, Native Federation 22.2.2, TypeScript ~6.0.3).
  Federation shares them as strict singletons: a drift breaks loading in the host. Never use `^`/`~`
  on `@angular/*`.
- ⚠️ [Exposes key `./X` must equal the exported symbol `X`](.agents/host-integration.md#exposing-a-module)
  — the host resolves `m[exposedModule]`. [Exposed `Routes` never provide an HttpClient](.agents/host-integration.md#interceptors):
  when hosted, requests use the host's HttpClient and interceptors (auth, errors, loader), like frontcore.
- ⚠️ [`SECRET_KEY` must be identical to the host's](.agents/environment.md) — the access token lives in
  encrypted localStorage written by the host; a different key reads nothing, silently.
- ⚠️ [Talk to the host only through the PubSub topics](.agents/host-integration.md#pubsub-contract)
  (`loading`, `error`, `success`, `warning`, `info`, `login-redirect`, `clearBreadCrumb`). Never
  subscribe to host UI topics from a remote.
- ⚠️ Angular 17+ syntax only: standalone components, `@if`/`@for`/`@switch`, `inject()`, signals,
  OnPush. No NgModules, no `*ngIf`/`*ngFor`, no constructor injection. See
  [`.agents/architecture.md`](.agents/architecture.md).
- ⚠️ [New feature modules come from the generator](.agents/architecture.md#creating-a-module), never
  from copy-paste: `bun run generate:module -- --name=<kebab-name> [--expose]`.
- ⚠️ [Tests next to the file they cover, written first when behavior changes](.agents/testing.md).
- ⚠️ Dates use **Temporal**, never `Date` (lint `no-restricted-globals`). Browsers without native
  Temporal (Safari/iOS) get `temporal-polyfill/global`: from `angular.json` polyfills standalone,
  and from an `import 'temporal-polyfill/global';` in every exposed entry when hosted (a host never
  runs a remote's polyfills).
- ⚠️ Never commit `.env`, `.npmrc`, `src/environments/*`, `dist/` — they are gitignored on purpose.
- ⚠️ **front-template keeps evolving from its forks.** When working in a fork (above all while
  merging front-template into it), if a change is general — a fix, tooling, config, CI, shared
  plumbing, test setup — and would help every new front/MF, propose upstreaming it to
  front-template. Propose, never apply it there on your own; see the
  [merge skill](.agents/skills/merge-fork-from-front-template/SKILL.md).

## Capability map

<!-- capability-map:start -->

| If you need…                                                                                                    | Already exists                                                                                   | Entry point                                                                                     | Read                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| HttpClient with auth for standalone dev (also: interceptor, Bearer, x-device-info; hosted mode uses the host's) | `provideMfHttpClient()` + functional `authInterceptor` (Bearer from host token, `x-device-info`) | `src/app/shared/providers/http.providers.ts`, `src/app/shared/interceptors/auth.interceptor.ts` | [`.agents/host-integration.md`](.agents/host-integration.md#interceptors)    |
| Read/write encrypted localStorage shared with the host (also: token, session, encrypt-storage)                  | `StorageService` + `StorageEnum` (same key names as host/frontcore)                              | `src/app/shared/services/storage.service.ts`, `src/app/shared/enums/storage.enum.ts`            | [`.agents/environment.md`](.agents/environment.md)                           |
| Show loader/toasts in the host (also: notifications, pubsub, events)                                            | `PubSubService` + `PubSubTopic`                                                                  | `src/app/shared/services/pubsub.service.ts`, `src/app/shared/enums/pubsub-topic.enum.ts`        | [`.agents/host-integration.md`](.agents/host-integration.md#pubsub-contract) |
| Permission headers for the gateway (also: x-api-key, resource:action)                                           | `buildPermissionHeaders(resource, action)`                                                       | `src/app/shared/helpers/permission-headers.helper.ts`                                           | [`.agents/architecture.md`](.agents/architecture.md)                         |
| Backend URL prefix (also: ms-core, gateway path)                                                                | `MsPrefixEnum`                                                                                   | `src/app/shared/enums/ms-prefix.enum.ts`                                                        | [`.agents/architecture.md`](.agents/architecture.md)                         |
| Standard response types (also: pagination, envelope)                                                            | `ServiceResponseInterface`, `PaginationResponseInterface`                                        | `src/app/shared/interfaces/response.interface.ts`                                               | —                                                                            |
| Validate a bearer token value                                                                                   | `isUsableBearerToken()`                                                                          | `src/app/shared/helpers/bearer-token.helper.ts`                                                 | —                                                                            |
| Dates and times (also: Temporal, Date, timezone, now)                                                           | Global `Temporal` (native, or `temporal-polyfill/global`)                                        | `Temporal.Now.instant()`, `Temporal.PlainDate.from(...)`                                        | —                                                                            |
| Build-time configuration (also: env, API_URL, environment.ts)                                                   | `load-env.js` → `src/environments/environment.ts`                                                | `bun run env`                                                                                   | [`.agents/environment.md`](.agents/environment.md)                           |
| Create a feature module (also: scaffold, generator)                                                             | Generator cloning `src/app/modules/template`                                                     | `bun run generate:module -- --name=<name> [--expose]`                                           | [`src/app/modules/template/README.md`](src/app/modules/template/README.md)   |

<!-- capability-map:end -->

Fork-only capabilities: [`.agents/capabilities.local.md`](.agents/capabilities.local.md).

## Documentation map

- Architecture, folder layout, module anatomy → [`.agents/architecture.md`](.agents/architecture.md)
- Host integration (manifest row, exposes, interceptors, PubSub, versions) → [`.agents/host-integration.md`](.agents/host-integration.md)
- Environment variables and `SECRET_KEY` → [`.agents/environment.md`](.agents/environment.md)
- Testing → [`.agents/testing.md`](.agents/testing.md)
- Docker, nginx, CI/CD → [`.agents/deployment.md`](.agents/deployment.md)
- Sync a fork with this repo → [`.agents/merge-changes-from-front-template.md`](.agents/merge-changes-from-front-template.md) and the end-to-end [merge skill](.agents/skills/merge-fork-from-front-template/SKILL.md)
- Example module → [`src/app/modules/template/README.md`](src/app/modules/template/README.md)

## Commands

```bash
bun install                  # also creates .env from .env.example (never overwrites) and,
                             # the first time, indexes the repo with CodeGraph (.codegraph/)
bun run start                # load-env + ng serve on http://localhost:4250
bun run build                # load-env + federation build -> dist/browser/remoteEntry.json
bun run test                 # vitest (Angular unit tests) + node:test (scripts)
bun run lint                 # oxlint (warnings fail locally; advisory in CI)
bun run format               # oxfmt (write); format:check verifies
bun run verify               # oxlint + oxfmt --check (verify only, same as CI)
bun run generate:module -- --name=<kebab-name> [--expose]
node scaffold/generate.js --service=mf-template --target=. --force   # regenerate .gitlab-ci.yml
```

## What NOT to do

- No npm/yarn/pnpm, no `package-lock.json`: the lockfile is `bun.lock`.
- Script names say what they do, not the tool (`format`, `format:check`, `verify`, `lint`), and no
  script is named `check`: it would shadow Bun's type checker (`bun check`). Pinned by
  `scripts/package-scripts.test.js`.
- Oxc mirrors backtemplate's Biome rules: 80 columns, single quotes, sorted imports, object keys
  (`sort-keys`) and interface members (`perfectionist/sort-interfaces`) in natural order, all
  autofixed by `bun run lint:fix` and the pre-commit.
- No ESLint/Prettier/Biome configuration: Oxc is the linter (`oxlint.config.ts`) and formatter
  (`oxfmt.config.ts`); a husky pre-commit runs `oxlint --fix` + oxfmt on staged files and reports
  findings without blocking. CI `lint`/`format:check` are advisory (`allow_failure: true`): forks
  carry legacy findings, so they warn instead of blocking `build_app`.
- Do not edit `.gitlab-ci.yml` by hand: it is generated from `scaffold/templates/gitlab-ci.yml`
  (`node scaffold/generate.js --service=mf-template --target=. --force`, see `scaffold/README.md`).
- Do not hardcode Node/Bun versions: `.node-version` and `.bun-version` are the source of truth
  (CI `resolve_versions`, Dockerfile `ARG BUN_VERSION`, `package.json`), pinned by
  `scripts/tool-versions.test.js`.
- No `^`/`~` ranges on `@angular/*`, `@angular/build`, `@angular/cli`, `@angular-architects/native-federation`.
- No `.npmrc` with tokens in the repo (CI generates it with `CI_JOB_TOKEN`).
- No webpack/Module Federation config: this is Native Federation (`federation.config.mjs`).
- Do not rename or remove an exposed symbol without updating the ms-core manifest row.
- Do not edit `src/environments/*` by hand: it is regenerated on every start/build/test.
