# Guardian Tech-Stack Alignment

> Status: **Tier 1 implemented** (shared configs, pnpm, tooling, Tailwind removal, committed
> Prisma migrations, Dependabot + Makefile). **Tier 2 evaluated** — adopted Source's accessible
> focus token (value inlined; the package itself isn't a fit yet); a full component migration and
> `@guardian/libs` are not a fit right now (see Tier 2 below). Tiers 3–4 remain proposals.

## Purpose & the dual goal

Bunting is built for **The Guardian** and as a **general open-source** feature-flag tool. Those
goals pull in slightly different directions:

- **Guardian-maintainable** — a Guardian engineer who works in
  [`dotcom-rendering`](https://github.com/guardian/dotcom-rendering),
  [`frontend`](https://github.com/guardian/frontend), or (the closest analog)
  [`support-admin-console`](https://github.com/guardian/support-admin-console) should open this
  repo and feel at home: recognizable configs, libraries, deploy story, and project shape.
- **OSS-friendly** — a team with no AWS/Guardian infrastructure should still be able to `docker
compose up` and self-host without adopting anything Guardian-specific.

The resolving principle for this whole document:

> **A generic, portable core that runs anywhere, plus an optional, well-documented "Guardian
> profile" layered on top.** Adopting Guardian conventions should never become a tax on outside
> adopters, and self-hosting generically should never make the repo feel foreign to a Guardian dev.

A useful reality check up front: **the closest Guardian analog, `support-admin-console`, is itself
not "pure modern Guardian."** It uses **MUI** (not the Source design system) and a plain Webpack
React frontend served by a Scala Play backend. So "feels Guardian" is mostly about **shared configs,
the deploy path, auth, and repo conventions** — not about chasing every cutting-edge `@guardian/*`
package. That keeps the highest-value changes cheap.

---

## Alignment scorecard

| Area             | Bunting today                                                                           | Guardian norm                                           | Verdict                                               |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Language         | TypeScript strict                                                                       | TS strict + `@guardian/tsconfig`                        | ✅ close — extend their base                          |
| FE framework     | React 19                                                                                | React 18                                                | ✅ aligned                                            |
| App framework    | Next.js full-stack (App Router)                                                         | React + Webpack served by a backend                     | ⚠️ biggest divergence                                 |
| Styling          | Tailwind **+** MUI 7 **+** Emotion                                                      | Emotion + Source (analog uses MUI)                      | ⚠️ drop Tailwind; consolidate                         |
| Lint / format    | `next/core-web-vitals`, no `.prettierrc`, a 2nd flat config misnamed `esling.config.js` | shared `@guardian/eslint-config` + `@guardian/prettier` | ❌ easy, high-signal win                              |
| Package manager  | npm                                                                                     | pnpm                                                    | ⚠️ migrate                                            |
| Tests            | Jest + Playwright + MSW                                                                 | Jest + Playwright                                       | ✅ aligned (widen coverage scope)                     |
| Data             | Postgres + Prisma                                                                       | DynamoDB common in admin tools                          | ✅ keep (OSS-friendlier); commit migrations           |
| Auth             | NextAuth v5 **beta**, pluggable OIDC/proxy/OAuth                                        | Google Workspace / pan-domain                           | ⚠️ keep pluggable; add Guardian profile; resolve beta |
| Deploy           | Docker-first                                                                            | `@guardian/cdk` + Riff-Raff                             | ⚠️ keep Docker default; add an easy Riff-Raff path    |
| Config / secrets | env vars + AWS KMS                                                                      | SSM Parameter Store                                     | ✅ keep default; document SSM in Guardian profile     |
| Updates / CI     | GitHub Actions                                                                          | GH Actions + Dependabot + `guardian/actions-riff-raff`  | ✅ add Dependabot + riff-raff action                  |

Legend: ✅ already aligned / keep · ⚠️ change recommended · ❌ clear gap, do early.

---

## Tier 1 — Cheap, high-signal wins (do first)

These make the repo _read_ as Guardian-built at near-zero architectural risk. This is where most of
the "feels familiar" value lives.

### 1.1 Adopt the shared Guardian configs

The single most recognizable Guardian signal. Replace bespoke config with the shared packages:

- **`@guardian/tsconfig`** — `extends` it in `tsconfig.json`, keep Bunting's path aliases and
  Next-specific overrides. Their base adds `noUncheckedIndexedAccess`, `noUnusedLocals`, etc.
- **`@guardian/eslint-config`** — use its `.typescript` / `.react` / `.jest` presets in a single
  flat config. **Delete the misnamed `esling.config.js`** and collapse the two ESLint configs into
  one. (Keep `next/core-web-vitals`'s useful rules by composing, not replacing wholesale.)
- **`@guardian/prettier`** — add a `.prettierrc` that points at it. Note the Guardian house style:
  **tabs** (accessibility), `printWidth: 80`, single quotes, `semi: true`, `trailingComma: 'all'`.
  Expect a one-time repo-wide reformat in its own commit.

> Files: `tsconfig.json`, `.eslintrc.json`, `esling.config.js` (delete), new `.prettierrc`.

### 1.2 Migrate npm → pnpm

pnpm is the Guardian standard for new JS projects (`dotcom-rendering`, `support-admin-console`).
Generate `pnpm-lock.yaml`, remove `package-lock.json`, and update the `scripts`, CI workflows,
`Dockerfile`, and README setup commands (`npm ci` → `pnpm install --frozen-lockfile`, etc.).

### 1.3 Loosen the Node version pin

`engines.node` is currently `>=24 <25` — single-major and brittle. Widen to a maintained LTS range
that matches what Guardian CI runs (and what the existing GH Actions matrix already tests: 20 & 24).

### 1.4 Consolidate styling — remove Tailwind

Bunting runs **three** styling systems: Tailwind, MUI, and Emotion (MUI's engine). Tailwind is the
outlier — **no Guardian repo uses it.** MUI + Emotion already matches `support-admin-console`.

- Remove Tailwind (`tailwind.config.js`, `@tailwind` directives in `src/app/globals.css`, the
  `@tailwindcss/forms` plugin).
- Fold the Tailwind CSS-variable color theme into the existing MUI theme `src/theme/buntingTheme.ts`.
- Result: one styling system, already Guardian-shaped, and a smaller dependency surface.

### 1.5 Commit Prisma migrations & widen coverage scope

- The schema is currently synced with `db push` and **migrations aren't committed**. Switch to
  `prisma migrate dev` / `migrate deploy` and commit the migration history — standard practice and
  expected by any reviewer auditing schema change.
- The 90% coverage gate is real but **only collects from `src/lib/db.ts`.** Widen
  `collectCoverageFrom` to the broader `src/lib/**` (and key API/route logic) so the gate means
  something.

### 1.6 Add Dependabot + a Makefile

- **Dependabot** (`.github/dependabot.yml`) — Guardian repos use it; cheap and expected.
- **Makefile** wrapping `setup` / `dev` / `test` / `lint` / `build`. Guardian devs reach for
  `make` out of muscle memory (`dotcom-rendering`, `frontend` both ship one). It can simply call the
  pnpm scripts — the value is the familiar entry point.

---

## Tier 2 — Design-system & convention depth (optional, forward-looking)

Higher effort, more aspirational. Not required to "feel Guardian," because the closest analog hasn't
adopted these either — present as opt-in.

### 2.1 Evaluate `@guardian/source`

[Source](https://theguardian.design) (`@guardian/source/foundations` tokens +
`@guardian/source/react-components`) is the **modern** Guardian design system and would feel most
"Guardian" to someone coming from `dotcom-rendering`. **But** `support-admin-console` still runs on
MUI, so MUI is a perfectly defensible, lower-effort resting point.

Recommendation: treat Source as a **later, optional** migration, not a Tier 1 requirement. If
pursued, do it incrementally (foundations/tokens first, then swap components screen by screen).

**Outcome (foundations adopted, components deferred).** Bunting has a deliberate, distinct brand
— custom palette (teal/mint/yellow/orange), Belanosima/Nunito fonts, playful pill components in
`src/theme/buntingTheme.ts`. A full Source **component** migration would erase that identity for
little familiarity gain (a Guardian dev is already at home in MUI + Emotion, which Source uses under
the hood, and `support-admin-console` itself uses MUI). So we took the **foundations-first** step:
adopted Source's accessible **focus** token (`focus[400]` = `#0077B6`) in the theme — which also
fixed a real bug where the focus ring resolved to `undefined` (no visible keyboard focus). The token
**value is inlined** rather than depending on `@guardian/source`: only this one token applied, and
its `@guardian/source/foundations` subpath export does not resolve under Turbopack + pnpm. Re-add the
real package (with a Turbopack resolution fix) if/when a broader set of Source foundations is used.
Full component adoption stays deferred and brand-gated.

### 2.2 Pull in `@guardian/libs` where it duplicates hand-rolled code

**Outcome: not applicable right now — skipped.** `@guardian/libs` targets dotcom concerns
(consent/CMP, commercial, cookies, browser `storage`, `switches`, country/locale, ophan). An audit
of `src/lib/` found **no matching surface**: no `localStorage`/`sessionStorage`/`document.cookie`
usage, and the hand-rolled utilities are flag-domain-specific (key normalization, validation,
bucketing, JWS signing) with no `@guardian/libs` equivalent. Adopting it here would be artificial.
Revisit if/when a client-side storage, cookie, or consent surface appears.

---

## Tier 3 — Easy Riff-Raff release path (Docker stays the default)

**Decision:** Docker-first remains the canonical, generic deploy story. Nothing prescriptive is
forced on outside adopters — but the path to release **via Riff-Raff must be frictionless** for
Guardian.

This is the **optional Guardian profile** in concrete form:

- **Keep** the multi-stage `Dockerfile` (standalone output, non-root) and `docker-compose.yml` as
  the canonical local + generic-host path. The one-click Render/Heroku/Vercel buttons stay.
- **Add an optional `deploy/` CDK app** using **`@guardian/cdk`** — a containerized `GuEc2App` (or
  ECS task) fronting the existing standalone Next.js image, emitting `CODE` / `PROD` CloudFormation
  templates. This lives alongside, and does not replace, the Docker path.
- **Add `riff-raff.yaml`** plus a GitHub Actions job using **`guardian/actions-riff-raff`** to build
  and upload the image/artifact. A Guardian engineer should be able to ship to `CODE`/`PROD` with
  the deploy tooling they already know, no bespoke pipeline to learn.
- **Document SSM Parameter Store** as the Guardian config/secrets source (env vars remain the
  generic default; the CDK wires Parameter Store → container env).

### Auth: a Guardian profile, not a new auth system

Bunting already has a **proxy-header auth mode** (`src/lib/auth-proxy.ts`, `src/middleware.ts`).
That is the hook: document driving it from **Google Workspace OAuth / pan-domain-authentication** at
the proxy/ALB layer. No new auth code — just configuration and a short runbook in the Guardian
profile. Pluggable OIDC/OAuth stays the generic default.

> **Stability flag (do before GA):** auth depends on **NextAuth v5 (beta,
> `5.0.0-beta.29`)**. Pin/track it deliberately and plan to land on a stable release before
> declaring production readiness — this is independent of Guardian alignment but worth calling out.

---

## Tier 4 — Front-end / back-end split (largest change; sequence last, deferrable)

**Honest cost/benefit first:** this is the **highest-effort, lowest-familiarity-ROI** item in the
whole document. A Guardian engineer feels at home from Tiers 1–3 — shared configs, MUI/Emotion,
pnpm, Riff-Raff, Google auth — **regardless of whether the app is Next.js or SPA + Express.** The
framework choice is the _least_ important familiarity signal once the surface conventions match.

If pursued anyway (to mirror Guardian's "backend serves the built frontend + exposes the API" model,
as in `support-admin-console`):

- **Target shape:** a **React SPA** built with Vite or Webpack (to match Guardian client tooling) +
  a **thin Node API** (Express or Fastify) — _not_ a Scala Play rewrite. Reuse today's **Zod
  schemas**, **Prisma layer**, and the logic already in `src/lib/*`.
- **Seam-first, mechanical migration:** the App Router **route handlers in `src/app/api/*` already
  form a clean API boundary.** The de-risking move is to **extract `src/lib/*` into a
  transport-agnostic core now** (no HTTP/Next types in the business logic). Then a later split
  becomes "wire the core into Express handlers + point the SPA at them" rather than a rewrite.

**Recommendation: defer this** unless Guardian maintainership specifically requires it. Do the seam
extraction (cheap, good hygiene regardless) early; hold the actual split until there's a concrete
reason. Tiers 1–3 deliver the large majority of the "feels familiar" value at a fraction of the cost.

---

## What we deliberately keep non-Guardian (and why)

| Choice                                | Guardian norm                  | Why we keep it                                                                                                     |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **PostgreSQL + Prisma**               | DynamoDB common in admin tools | Postgres is far more OSS-friendly to self-host; Prisma gives typed access + committed migrations. No adoption tax. |
| **Docker-first deploy**               | EC2 via CDK/Riff-Raff          | Docker runs anywhere; Riff-Raff is offered as an optional profile, not the only path.                              |
| **Pluggable auth (OIDC/OAuth/proxy)** | Google / pan-domain            | Outside orgs aren't on Google Workspace; the proxy mode still lets Guardian layer pan-domain auth on top.          |
| **env-var config default**            | SSM Parameter Store            | Env vars are the universal baseline; SSM is documented as the Guardian profile.                                    |

Each of these is a conscious "generic core" decision, with the Guardian-specific option available as
an additive layer.

---

## Phased checklist

**Tier 1 — done ✅ (low risk, high signal)**

- [x] Adopt `@guardian/tsconfig`, `@guardian/eslint-config`, `@guardian/prettier`; add `.prettierrc`; delete `esling.config.js`; collapse to one ESLint config — _S_
- [x] Migrate npm → pnpm (lockfile, scripts, CI, Dockerfile, README) — _M_
- [x] Loosen `engines.node` to a maintained LTS range — _XS_
- [x] Remove Tailwind (was already dead); restyle the 3 affected form components to MUI — _M_
- [x] Commit Prisma migrations; widen `collectCoverageFrom` beyond `src/lib/db.ts` — _S_
- [x] Add Dependabot config + a Makefile — _XS_

> Ratchet TODOs left behind (search `TODO(guardian-alignment)`): re-enable the 3 stricter
> `@guardian/tsconfig` flags (~200 fixes), promote the ~1,800 `warn`-downgraded ESLint rules back to
> `error`, and raise the coverage floor as `src/lib` coverage grows.

**Tier 2 — evaluated**

- [x] Evaluate `@guardian/source` → adopted its accessible focus **token value** (inlined; fixed a broken focus ring). Package not retained (subpath breaks Turbopack + only one token applied); full component migration deferred (brand-gated) — _L_
- [x] Evaluate `@guardian/libs` → **N/A, skipped** (no client storage/cookie/consent/commercial surface; utils are flag-domain-specific) — _S–M_

**Tier 3 — easy Riff-Raff path (Docker stays default)**

- [ ] Add optional `deploy/` CDK app (`@guardian/cdk`, containerized) — _M_
- [ ] Add `riff-raff.yaml` + `guardian/actions-riff-raff` CI job — _S_
- [ ] Document SSM Parameter Store config source + Guardian auth profile (Google/pan-domain via proxy mode) — _S_
- [ ] Resolve the NextAuth v5 beta dependency before GA — _S_

**Tier 4 — defer unless required**

- [ ] Extract `src/lib/*` into a transport-agnostic core (do early — good hygiene) — _M_
- [ ] Split into React SPA + thin Node API (Express/Fastify) — _XL, deferrable_

_Effort: XS < S < M < L < XL._

---

## Sources

Audited against `guardian/dotcom-rendering`, `guardian/frontend`, and `guardian/support-admin-console`
(the closest analog), plus the Source design system and the `@guardian/*` shared-config packages.
