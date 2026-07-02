# Bunting Admin — API Reference

> **See also:** [docs/README.md](README.md) (docs index) · [docs/config-artifact-spec.md](config-artifact-spec.md) (config artifact format)

All routes are under `/api`. Requests and responses use `application/json` unless noted.

---

## Authentication

**Authentication** is enforced globally in `src/middleware.ts` (edge runtime): every request except the public routes (`/api/auth/*`, `/api/health`, `/auth/*`, static assets, and `/`) must carry a valid identity, or the middleware returns `401` (for `/api/*`) or redirects to sign-in (otherwise) before reaching any handler. Two auth modes are selected by `AUTH_MODE` (default `oidc`); see [docs/security.md](security.md) for the full configuration.

In `oidc` mode, auth is handled by NextAuth.js (JWT session strategy). Supported providers are configured via environment variables: Google, GitHub, Microsoft (Azure AD), a generic OIDC provider, and Resend (magic-link email). The sign-in flow `GET/POST /api/auth/[...nextauth]` is fully managed by NextAuth and not documented further here. In `proxy` mode, identity is read from a trusted reverse-proxy header (optionally a signed JWT).

**Access control:** on a genuinely fresh install (empty access list, no admin yet), the first authenticated user is automatically granted `ADMIN` (and is added to the access list) — see [security.md](security.md) §RBAC and first-admin for the exact rule, which differs slightly between `oidc` and `proxy` mode. Subsequent users default to `DEVELOPER` unless their email or domain appears in the access list with an explicit role. Roles are `ADMIN` or `DEVELOPER`.

**Authorization** (role checks) is enforced per-route in the node-runtime handlers. ADMIN-only routes are marked **Admin only** in each section; they all call `requireAdmin` (`src/lib/authz.ts`), which returns `403` for an authenticated non-admin or `401` if unauthenticated. All other routes are open to any authenticated user (including `DEVELOPER`): per [authentication.md](../../docs/authentication.md) §Roles, developers may author apps/flags/tests/rollouts but may not publish or manage keys/users/access-list.

The **Admin only** routes are: `config/publish`, `keys` (POST/PUT), `keys/[id]` (PUT/DELETE), `activity`, `users`, `access-list`, and the `crypto/test` diagnostic.

---

## Error Envelope

All error responses follow:

```json
{ "error": "Human-readable message" }
```

Zod validation failures additionally include:

```json
{
	"error": "Invalid request data",
	"details": [
		/* ZodIssue[] */
	]
}
```

Common status codes: `400` bad input, `401` unauthorized, `404` not found, `409` conflict (duplicate key/identifier), `500` server error.

---

## Apps

### `GET /api/apps`

List all apps, ordered by name.

**Response 200**

Array of `App` objects, each including a `_count` of related `flags` and `testRollouts`.

| Field                     | Type                                                    | Notes                                               |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `id`                      | string                                                  | cuid                                                |
| `name`                    | string                                                  |                                                     |
| `identifier`              | string                                                  | unique, used as S3 path prefix                      |
| `artifactUrl`             | string                                                  | CDN URL derived from `CDN_BASE_URL`                 |
| `publicKeys`              | `{kid: string, pem: string}[]`                          | stored on app; see Keys section for DB-managed keys |
| `fetchPolicy`             | `{min_interval_seconds: number, hard_ttl_days: number}` |                                                     |
| `storageConfig`           | object                                                  | internal, not used for routing                      |
| `createdAt` / `updatedAt` | ISO8601 string                                          |                                                     |
| `_count.flags`            | number                                                  |                                                     |
| `_count.testRollouts`     | number                                                  |                                                     |

---

### `POST /api/apps`

Create a new app and publish an initial empty config to S3.

**Request body** (Zod-validated)

| Field         | Type                                                    | Required             |
| ------------- | ------------------------------------------------------- | -------------------- |
| `name`        | string                                                  | yes                  |
| `identifier`  | string                                                  | yes — must be unique |
| `publicKeys`  | `{kid: string, pem: string}[]`                          | yes                  |
| `fetchPolicy` | `{min_interval_seconds: number, hard_ttl_days: number}` | yes                  |

**Response 201** — created `App` object (same shape as GET list item).

**Errors:** `409` if `identifier` already exists. `500` if the initial S3 config upload fails (app is rolled back).

---

### `GET /api/apps/[id]`

Get a single app by database ID.

**Response 200** — `App` object with `_count` of `flags`.

**Errors:** `404` if not found.

---

### `PUT /api/apps/[id]`

Update an app. All fields are optional.

**Request body** (Zod-validated)

| Field         | Type                                                     |
| ------------- | -------------------------------------------------------- |
| `name`        | string?                                                  |
| `identifier`  | string?                                                  |
| `publicKeys`  | `{kid: string, pem: string}[]?`                          |
| `fetchPolicy` | `{min_interval_seconds: number, hard_ttl_days: number}?` |

Changing `identifier` re-derives `artifactUrl` automatically.

**Response 200** — updated `App` object.

**Errors:** `404` not found, `409` if new `identifier` conflicts.

---

### `DELETE /api/apps/[id]`

Delete an app. Cascades to all flags, test-rollouts, and audit logs.

**Response 200**

```json
{ "message": "App deleted successfully" }
```

**Errors:** `404` if not found.

---

## Flags

### `GET /api/flags?appId=<id>`

List all flags for an app, ordered by `updatedAt` descending. Includes `app.name` and `app.identifier`.

**Query params:** `appId` (required)

**Response 200** — array of `Flag` objects.

| Field                     | Type                                                                                                | Notes                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `id`                      | string                                                                                              | cuid                                  |
| `key`                     | string                                                                                              | normalized snake_case, unique per app |
| `displayName`             | string                                                                                              |                                       |
| `type`                    | `"BOOL"` \| `"STRING"` \| `"INT"` \| `"DOUBLE"` \| `"DATE"` \| `"JSON"`                             | Prisma enum (uppercase)               |
| `description`             | string?                                                                                             |                                       |
| `archived`                | boolean                                                                                             |                                       |
| `archivedAt`              | string?                                                                                             | ISO8601                               |
| `defaultValues`           | `{development: any, beta: any, production: any}`                                                    |                                       |
| `variants`                | `{development: ConditionalVariant[], beta: ConditionalVariant[], production: ConditionalVariant[]}` |                                       |
| `appId`                   | string                                                                                              |                                       |
| `createdAt` / `updatedAt` | ISO8601 string                                                                                      |                                       |

---

### `POST /api/flags`

Create a flag.

**Request body** (Zod-validated via `createFlagSchema`)

| Field           | Type                                                                    | Required                     |
| --------------- | ----------------------------------------------------------------------- | ---------------------------- |
| `key`           | string                                                                  | yes — must be unique per app |
| `displayName`   | string                                                                  | yes                          |
| `type`          | `"bool"` \| `"string"` \| `"int"` \| `"double"` \| `"date"` \| `"json"` | yes — lowercase wire format  |
| `description`   | string                                                                  | no                           |
| `defaultValues` | `{development: any, beta: any, production: any}`                        | yes                          |
| `appId`         | string                                                                  | yes                          |

`variants` is initialized to `{development: [], beta: [], production: []}` by the server.

**Response 201** — created `Flag` object.

**Errors:** `409` if `key` already exists for this app.

---

### `GET /api/flags/[id]`

Get a single flag by ID.

**Response 200** — `Flag` object (includes `app.name`, `app.identifier`).

**Errors:** `404` if not found.

---

### `PUT /api/flags/[id]`

Update a flag. All fields are optional. Setting `archived: true` also sets `archivedAt`; setting `archived: false` clears it.

**Request body** (Zod-validated via `updateFlagSchema`)

| Field           | Type                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `key`           | string?                                                                  |
| `displayName`   | string?                                                                  |
| `type`          | `"bool"` \| `"string"` \| `"int"` \| `"double"` \| `"date"` \| `"json"`? |
| `description`   | string \| null?                                                          |
| `defaultValues` | `{development: any, beta: any, production: any}`?                        |
| `variants`      | `Record<string, unknown[]>`? — env-keyed array                           |
| `archived`      | boolean?                                                                 |

**Response 200** — updated `Flag` object.

**Errors:** `404` if not found.

---

### `DELETE /api/flags/[id]`

Hard-delete a flag.

**Response 200**

```json
{ "success": true }
```

**Errors:** `404` if not found.

---

## Tests

Tests are `TestRollout` records with `type = "TEST"`.

### `GET /api/tests?appId=<id>`

List all A/B tests for an app, ordered by `createdAt` descending.

**Query params:** `appId` (required)

**Response 200** — array of `TestRollout` objects (see [TestRollout shape](#testrollout-shape)).

---

### `POST /api/tests`

Create an A/B test.

**Request body** (Zod-validated via `createTestSchema`)

| Field          | Type          | Notes                                                        |
| -------------- | ------------- | ------------------------------------------------------------ |
| `key`          | string        | required, unique per app                                     |
| `name`         | string        | required                                                     |
| `description`  | string        | optional                                                     |
| `conditions`   | `Condition[]` | required — entry-requirement conditions                      |
| `variantCount` | integer ≥ 2   | required                                                     |
| `trafficSplit` | `number[]`    | required — must sum to 100, length must equal `variantCount` |
| `variantNames` | `string[]`    | required — length must equal `variantCount`, no empty names  |
| `appId`        | string        | required                                                     |

A `salt` is generated server-side. `variants` is built as `{ [name]: { percentage, values: { development: null, beta: null, production: null } } }`. `flagIds` starts as `[]`.

**Response 201** — created `TestRollout` object.

**Errors:** `400` if traffic split doesn't sum to 100, count/names mismatch, or empty variant names.

---

### `GET /api/tests/[id]`

Get a single test. Only matches records with `type = "TEST"`.

**Response 200** — `TestRollout` object.

**Errors:** `404` if not found or is a rollout.

---

### `PUT /api/tests/[id]`

Update a test.

**Request body** (Zod-validated via `updateTestSchema`)

| Field         | Type                       |
| ------------- | -------------------------- |
| `key`         | string?                    |
| `name`        | string?                    |
| `description` | string \| null?            |
| `conditions`  | `Condition[]`?             |
| `variants`    | `Record<string, unknown>`? |
| `flagIds`     | `string[]`?                |
| `archived`    | boolean?                   |

**Response 200** — updated `TestRollout` object.

**Errors:** `404` if not found.

---

### `DELETE /api/tests/[id]`

Delete a test. Only matches records with `type = "TEST"`.

**Response 200**

```json
{ "success": true }
```

**Errors:** `404` if not found.

---

## Rollouts

Rollouts are `TestRollout` records with `type = "ROLLOUT"`.

### `GET /api/rollouts?appId=<id>`

List all rollouts for an app, ordered by `createdAt` descending.

**Query params:** `appId` (required)

**Response 200** — array of `TestRollout` objects.

---

### `POST /api/rollouts`

Create a gradual rollout.

**Request body** (Zod-validated via `createRolloutSchema`)

| Field         | Type          | Notes                    |
| ------------- | ------------- | ------------------------ |
| `key`         | string        | required, unique per app |
| `name`        | string        | required                 |
| `description` | string        | optional                 |
| `conditions`  | `Condition[]` | required                 |
| `percentage`  | integer 0–100 | required                 |
| `appId`       | string        | required                 |

A `salt` is generated server-side. `rolloutValues` initializes to `{development: null, beta: null, production: null}`. `flagIds` starts as `[]`.

**Response 201** — created `TestRollout` object.

**Errors:** `400` if `percentage` is out of range.

---

### `GET /api/rollouts/[id]`

Get a single rollout. Only matches records with `type = "ROLLOUT"`.

**Response 200** — `TestRollout` object.

**Errors:** `404` if not found or is a test.

---

### `PUT /api/rollouts/[id]`

Update a rollout.

**Request body** (Zod-validated via `updateRolloutSchema`)

| Field           | Type                                          |
| --------------- | --------------------------------------------- |
| `key`           | string?                                       |
| `name`          | string?                                       |
| `description`   | string \| null?                               |
| `conditions`    | `Condition[]`?                                |
| `percentage`    | integer 0–100?                                |
| `rolloutValues` | partial `{development?, beta?, production?}`? |
| `flagIds`       | `string[]`?                                   |
| `archived`      | boolean?                                      |

**Response 200** — updated `TestRollout` object.

**Errors:** `404` if not found.

---

### `PUT /api/rollouts/[id]/percentage`

Update only the rollout percentage. Lighter than a full PUT for slider interactions.

**Request body** (not Zod-validated — raw JSON parse)

```json
{ "percentage": 50 }
```

`percentage` must be a number 0–100.

**Response 200** — updated `TestRollout` object.

**Errors:** `400` if value is not a number or out of range, `404` if not found.

---

### `DELETE /api/rollouts/[id]`

Delete a rollout. Only matches records with `type = "ROLLOUT"`.

**Response 200**

```json
{ "success": true }
```

**Errors:** `404` if not found.

---

## Test-Rollouts (Unified)

The `/api/test-rollouts` routes are the primary interface used by the front-end. They operate on both `TEST` and `ROLLOUT` records without type filtering, unlike `/api/tests` and `/api/rollouts`.

### `GET /api/test-rollouts?appId=<id>[&flagId=<id>]`

List non-archived test-rollouts for an app. Optionally filter to records whose `flagIds` array contains `flagId`.

**Query params:** `appId` (required), `flagId` (optional)

**Response 200** — array of `TestRollout` objects.

---

### `POST /api/test-rollouts`

Create a test or rollout. `key` is auto-generated from `name`.

**Request body** (Zod-validated via `createTestRolloutSchema`)

| Field         | Type                      | Notes                                                                                      |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `appId`       | string                    | required                                                                                   |
| `name`        | string                    | required — key derived by lowercasing and replacing spaces/specials with `_`, max 50 chars |
| `description` | string                    | optional                                                                                   |
| `type`        | `"TEST"` \| `"ROLLOUT"`   | required                                                                                   |
| `conditions`  | `Condition[]`             | optional                                                                                   |
| `flagIds`     | `string[]`                | optional                                                                                   |
| `variants`    | `Record<string, unknown>` | required when `type = "TEST"`                                                              |
| `percentage`  | integer 0–100             | required when `type = "ROLLOUT"`                                                           |

**Response 201** — created `TestRollout` object.

---

### `GET /api/test-rollouts/[id]`

Get a single test-rollout by ID (no type filter).

**Response 200** — `TestRollout` object.

**Errors:** `404` if not found.

---

### `PUT /api/test-rollouts/[id]`

Update a test-rollout. No type filter applied.

**Request body** (Zod-validated via `updateTestRolloutSchema`)

| Field           | Type                                         |
| --------------- | -------------------------------------------- |
| `name`          | string?                                      |
| `description`   | string \| null?                              |
| `conditions`    | `Condition[]`? — defaults to `[]` if omitted |
| `flagIds`       | `string[]`? — defaults to `[]` if omitted    |
| `variants`      | any? — defaults to `null` if omitted         |
| `rolloutValues` | any? — defaults to `null` if omitted         |
| `percentage`    | integer 0–100?                               |
| `archived`      | boolean? — defaults to `false` if omitted    |

**Response 200** — updated `TestRollout` object.

---

### `DELETE /api/test-rollouts/[id]`

Hard-delete a test-rollout.

**Response 200**

```json
{ "success": true }
```

---

### `POST /api/test-rollouts/[id]/archive`

Archive a test or rollout. For rollouts, sets `percentage` to 0 (cancel) or 100 (complete).

**Request body** (not Zod-validated — raw JSON parse)

```json
{ "type": "cancel" }
```

or

```json
{ "type": "complete" }
```

**Response 200** — updated `TestRollout` object with `archived: true`, `archivedAt` set.

**Errors:** `400` if `type` is not `"cancel"` or `"complete"`, `404` if not found.

---

## Config

### `POST /api/config/validate`

Validate the current database state for an app without publishing.

**Request body**

```json
{ "appId": "string" }
```

**Response 200**

```json
{
	"errors": [
		{
			"type": "string",
			"message": "string",
			"flagKey": "string?"
		}
	],
	"warnings": [
		{
			"type": "string",
			"message": "string",
			"flagKey": "string?"
		}
	]
}
```

Errors are blocking; warnings are informational.

---

### `POST /api/config/generate`

Generate the config artifact JSON from the current database state without publishing it.

**Request body**

```json
{ "appId": "string" }
```

**Response 200** — the config artifact object (see [docs/config-artifact-spec.md](config-artifact-spec.md) for the full shape). Does not include `config_version` or `published_at`.

---

### `POST /api/config/publish`

**Admin only** (via `requireAdmin`). Also rate-limited in middleware (20 requests/minute per client IP; `429` with `Retry-After` when exceeded).

Validate, sign, version, and upload the config artifact to S3.

**Request body**

```json
{ "appId": "string", "changelog": "string" }
```

`changelog` must be non-empty.

**Behavior:**

1. Generates config from DB.
2. Runs the same blocking validation as `POST /api/config/validate` against the generated config. Any blocking error rejects the publish with `400` before anything else happens — no version is reserved, no signing key is created, and no S3 object is written. Non-blocking warnings do not block.
3. Determines next version in `YYYY-MM-DD.N` format by inspecting today's audit log entries.
4. Ensures an active signing key exists for the app, generating one if needed.
5. Serializes the config once, then signs it with a detached JWS (RS256).
6. Uploads `{appIdentifier}/config.json` and `{appIdentifier}/config.json.sig` to S3.
7. Creates an `AuditLog` record.

**Response 200**

```json
{
	"version": "2025-09-12.1",
	"publishedAt": "2025-09-12T...",
	"keyId": "string",
	"signed": true,
	"message": "Configuration published and signed successfully"
}
```

**Response 400** — the config fails validation (same errors `POST /api/config/validate` would report):

```json
{
	"error": "Configuration is invalid and cannot be published",
	"details": "string (joined error messages)",
	"errors": [{ "type": "string", "message": "string", "flagKey": "string?" }],
	"warnings": [{ "type": "string", "message": "string", "flagKey": "string?" }]
}
```

---

### `POST /api/config/published`

Fetch the currently published config from S3 (for change-comparison).

**Request body**

```json
{ "appIdentifier": "string" }
```

**Response 200**

```json
{
	"config": {
		/* config artifact or null if not yet published */
	},
	"lastModified": "ISO8601 date",
	"etag": "string"
}
```

When no config exists yet, returns `{ "config": null, "message": "No published configuration found" }` with status 200.

---

### `POST /api/config/download`

Download the published config as a file attachment.

**Request body**

```json
{ "appIdentifier": "string" }
```

**Response 200** — `application/json` with `Content-Disposition: attachment; filename="{appIdentifier}-v{version}.json"`. Body is the pretty-printed config JSON.

**Errors:** `404` if no config exists in S3.

---

### `POST /api/config/history`

Fetch the publish history for an app.

**Request body**

```json
{ "appId": "string", "limit": 10 }
```

`limit` defaults to 10.

**Response 200** — array of `PublishHistoryItem`:

| Field         | Type                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| `id`          | string                                                                                 |
| `version`     | string (`YYYY-MM-DD.N`)                                                                |
| `publishedAt` | ISO8601 string                                                                         |
| `publishedBy` | string                                                                                 |
| `changelog`   | string                                                                                 |
| `flagCount`   | number                                                                                 |
| `changes`     | `{type: "flag", action: "added"\|"modified"\|"removed", key: string, name: string}[]?` |

---

### `POST /api/config/decode`

Decode a client config fingerprint against the retained artifact for its version, returning the resolved per-flag values. Authenticated (any role).

**Request body** (Zod-validated)

```json
{ "appId": "string", "code": "string" }
```

`code` is the fingerprint string from a client; its embedded version selects the artifact to decode against.

**Response 200**

```json
{
	"version": "string",
	"env": "string",
	"publishedAt": "ISO8601",
	"appIdentifier": "string",
	"flags": {
		/* resolved flag values */
	}
}
```

**Errors:** `400` invalid request, `404` if app not found or no retained artifact exists for that version (only versions published after per-version archiving was enabled can be decoded), `422` if the fingerprint is malformed for the artifact.

---

## Bootstrap

### `GET /api/bootstrap/plist?appId=<id>` or `?appIdentifier=<id>`

Generate and download a `BuntingConfig.plist` for the Bunting Swift SDK.

**Query params:** `appId` or `appIdentifier` (one required)

**Response 200** — `application/x-plist` with `Content-Disposition: attachment; filename="BuntingConfig.plist"`.

The plist contains:

- `endpoint_url` — `app.artifactUrl`
- `public_keys` — array of `{kid, pem}` from active `SigningKey` records; falls back to `app.publicKeys` if no DB keys exist
- `fetch_policy` — `{min_interval_seconds, hard_ttl_days}` from `app.fetchPolicy` (defaults: 21600 / 7)

**Errors:** `400` if neither param provided, `404` if app not found or no signing keys exist.

Also handles `OPTIONS` preflight with CORS headers.

---

## Keys

The mutating key endpoints (`POST /api/keys`, `PUT /api/keys`, `PUT /api/keys/[id]`, `DELETE /api/keys/[id]`) are **Admin only** (via `requireAdmin`; `403` for non-admins). The read endpoints (`GET /api/keys`, `GET /api/keys/[id]`, `GET /api/keys/public`) require any authenticated session.

### `GET /api/keys?appId=<id>`

List all signing keys for an app. Private keys are never returned.

**Response 200**

```json
{
	"app": "string",
	"keys": [
		{
			"id": "string",
			"kid": "string",
			"publicKey": "string",
			"algorithm": "RS256",
			"isActive": true,
			"createdAt": "ISO8601"
		}
	]
}
```

---

### `POST /api/keys`

Generate a new RSA key pair for an app. The private key is encrypted before persistence.

**Request body**

```json
{ "appId": "string", "isActive": false }
```

`isActive` defaults to `false`. If `true`, all existing active keys for the app are deactivated first (in a transaction).

**Response 201**

```json
{
	"kid": "string",
	"publicKey": "string",
	"algorithm": "RS256",
	"isActive": false,
	"message": "Signing key created successfully"
}
```

---

### `PUT /api/keys`

Rotate signing keys — deactivates all current active keys and activates the specified key.

**Request body**

```json
{ "appId": "string", "newKeyId": "string" }
```

`newKeyId` is the `kid` of an existing key.

**Response 200**

```json
{ "message": "Key rotation completed successfully", "activeKeyId": "string" }
```

**Errors:** `404` if app or target key not found.

---

### `GET /api/keys/[id]?appId=<appId>`

Get a specific signing key by `kid` (URL segment) and `appId` (query param). The `[id]` segment is the key's `kid`, not the database row ID.

**Response 200**

```json
{
	"key": {
		"id": "string",
		"kid": "string",
		"publicKey": "string",
		"algorithm": "RS256",
		"isActive": true,
		"createdAt": "ISO8601",
		"app": { "id": "string", "name": "string", "identifier": "string" }
	}
}
```

---

### `PUT /api/keys/[id]?appId=<appId>`

Activate or deactivate a key. Activating a key deactivates all other keys for the app.

**Request body**

```json
{ "isActive": true }
```

**Response 200**

```json
{
	"message": "Signing key updated successfully",
	"keyId": "string",
	"isActive": true
}
```

---

### `DELETE /api/keys/[id]?appId=<appId>`

Delete a signing key. Cannot delete the active key — deactivate it first.

**Response 200**

```json
{ "message": "Signing key deleted successfully", "keyId": "string" }
```

**Errors:** `400` if key is active, `404` if not found.

---

### `GET /api/keys/public?appId=<id>` or `?appIdentifier=<id>`

Fetch all public keys for an app (active and inactive), intended for SDK distribution or CDN caching. Active keys are returned first.

**Response 200** (with `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` and CORS headers)

```json
{
	"app_identifier": "string",
	"keys": [
		{
			"kid": "string",
			"pem": "string",
			"algorithm": "RS256",
			"active": true,
			"created_at": "ISO8601"
		}
	],
	"key_count": 2,
	"active_keys": 1,
	"generated_at": "ISO8601"
}
```

**Errors:** `400` if neither `appId` nor `appIdentifier` is provided, `404` if no keys exist.

Also handles `OPTIONS` preflight with CORS headers.

---

## Users

**Admin only** — all endpoints are gated via `requireAdmin`; returns `403` for non-admins, `401` if unauthenticated.

### `GET /api/users`

List all users, ordered by `createdAt` descending.

**Response 200** — array of user objects:

| Field          | Type                       |
| -------------- | -------------------------- |
| `id`           | string                     |
| `email`        | string                     |
| `name`         | string?                    |
| `image`        | string?                    |
| `role`         | `"ADMIN"` \| `"DEVELOPER"` |
| `createdAt`    | ISO8601 string             |
| `lastActiveAt` | ISO8601 string             |

---

### `PATCH /api/users`

Update a user's role.

**Request body** (Zod-validated)

```json
{ "userId": "string", "role": "ADMIN" | "DEVELOPER" }
```

A user cannot demote their own account to `DEVELOPER`.

**Response 200** — updated user object (same shape as GET list item).

**Errors:** `400` if attempting self-demotion or validation failure, `403` if not ADMIN, `401` if unauthenticated.

---

## Access List

**Admin only** — all endpoints are gated via `requireAdmin`; returns `403` for non-admins, `401` if unauthenticated.

### `GET /api/access-list`

List all access-list entries, ordered by `createdAt` descending. Includes `createdBy.id`, `createdBy.email`, `createdBy.name`.

**Response 200** — array of `AccessList` objects:

| Field       | Type                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| `id`        | string                                                                           |
| `type`      | `"EMAIL"` \| `"DOMAIN"`                                                          |
| `value`     | string — email address (e.g. `user@example.com`) or domain (e.g. `@example.com`) |
| `role`      | `"ADMIN"` \| `"DEVELOPER"`                                                       |
| `createdAt` | ISO8601 string                                                                   |
| `createdBy` | `{id, email, name}?`                                                             |

---

### `POST /api/access-list`

Add an entry to the access list.

**Request body** (Zod-validated)

| Field   | Type                       | Constraint                                                            |
| ------- | -------------------------- | --------------------------------------------------------------------- |
| `type`  | `"EMAIL"` \| `"DOMAIN"`    | required                                                              |
| `value` | string                     | required — must contain `@` for EMAIL; must start with `@` for DOMAIN |
| `role`  | `"ADMIN"` \| `"DEVELOPER"` | required                                                              |

Values are stored lowercased. Duplicates (same `type` + `value`) are rejected.

**Response 200** — created `AccessList` object.

**Errors:** `400` for format or duplicate violations, `403` if not ADMIN, `401` if unauthenticated.

---

### `DELETE /api/access-list?id=<id>`

Remove an access-list entry by ID (query parameter).

**Response 200**

```json
{ "success": true }
```

**Errors:** `400` if `id` param is missing, `403` if not ADMIN, `401` if unauthenticated.

---

## Activity

**Admin only** — requires an authenticated session with `role = "ADMIN"` (via `requireAdmin`; returns `403` for non-admins, `401` if unauthenticated).

### `GET /api/activity`

Read the entity change trail (creates/updates/deletes/archives/rotations of flags, tests, rollouts, apps, keys, users, access-list entries). Backed by the `activity_logs` table, which is distinct from the publish ledger (`audit_logs`).

**Query params** (all optional)

| Param        | Type   | Notes                                                                              |
| ------------ | ------ | ---------------------------------------------------------------------------------- |
| `appId`      | string | scope to one app                                                                   |
| `entityType` | string | `flag` \| `test` \| `rollout` \| `app` \| `signing_key` \| `user` \| `access_list` |
| `entityId`   | string | a specific entity's history (pair with `entityType`)                               |
| `limit`      | number | default 100, clamped to 1–500                                                      |

**Response 200** — array of `ActivityLog` entries (most recent first):

| Field        | Type           | Notes                                                     |
| ------------ | -------------- | --------------------------------------------------------- |
| `id`         | string         |                                                           |
| `actor`      | string         | email, or `system`/`unknown`                              |
| `action`     | string         | `create` \| `update` \| `delete` \| `archive` \| `rotate` |
| `entityType` | string         |                                                           |
| `entityId`   | string         |                                                           |
| `appId`      | string?        | null for global entities                                  |
| `summary`    | string?        | human-readable one-liner                                  |
| `changes`    | object?        | optional `{before?, after?}` snapshot                     |
| `createdAt`  | ISO8601 string |                                                           |

---

## Ops

### `GET /api/health`

Liveness plus database reachability. **Public** — whitelisted in middleware, so it requires no authentication.

**Response 200** (process up and DB answers `SELECT 1`)

```json
{ "status": "ok", "db": "up" }
```

**Response 503** (database unreachable)

```json
{ "status": "degraded", "db": "down" }
```

The 503 body is intentionally opaque and leaks no connection details.

---

## Dev/Test Utilities

**Admin only**, and **disabled in production** — both handlers return `404` when `NODE_ENV === "production"`, and otherwise require an authenticated session with `role = "ADMIN"` (via `requireAdmin`).

### `GET /api/crypto/test?type=<type>`

Run internal crypto validation tests. **Development/test utility — not intended for production use.**

**Query param `type`:** `full` (default) \| `keygen` \| `publickeys`

Response shape varies by test type. All include a `timestamp` field. `full` includes a `summary.overallSuccess` boolean.

---

### `POST /api/crypto/test`

Validate a JWS signature's header format (does not verify the signature — the admin has no standalone verification path for a bare JWS; production verification is against the detached signature bound to a specific published `config.json`). **Development/test utility.**

**Request body** (not Zod-validated)

```json
{
	"jws": "string"
}
```

`jws` is required.

**Response 200**

```json
{
  "formatValidation": { ... },
  "timestamp": "ISO8601"
}
```

---

## Shared Types

### Condition

Used in flags (variants), tests, and rollouts.

```json
{
  "id": "string",
  "type": "app_version" | "os_version" | "build_number" | "platform" | "device_model" | "region" | "locale" | "custom_attribute",
  "operator": "equals" | "does_not_equals" | "in" | "not_in" | "greater_than" | "less_than" | "greater_than_or_equal" | "less_than_or_equal" | "between" | "custom",
  "values": ["string"]
}
```

For `custom_attribute`, the attribute name is stored in `values[0]`.

### TestRollout shape

```json
{
  "id": "string",
  "key": "string",
  "name": "string",
  "description": "string?",
  "type": "TEST" | "ROLLOUT",
  "salt": "string",
  "conditions": "Condition[]",
  "variants": "object? (TEST only)",
  "percentage": "integer? (ROLLOUT only)",
  "rolloutValues": "object? (ROLLOUT only)",
  "flagIds": "string[]",
  "archived": "boolean",
  "archivedAt": "ISO8601?",
  "appId": "string",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```
