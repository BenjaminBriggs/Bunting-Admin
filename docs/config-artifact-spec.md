# Config Artifact Specification

This document is the canonical contract between Bunting Admin and the Bunting SDK. The SDK (`bunting-sdk-swift` and any future platform SDKs) consumes exactly this format. If there is a conflict between this document and any other source, this document takes precedence.

---

## Top-level structure

```json
{
	"schema_version": 1,
	"config_version": "2025-09-23.3",
	"published_at": "2025-09-23T10:44:04.796Z",
	"app_identifier": "com.example.myapp"
}
```

| Field            | Type              | Description                                                                           |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `schema_version` | integer           | Schema version. Currently `1`.                                                        |
| `config_version` | string            | Monotonically increasing publish identifier: `YYYY-MM-DD.N` (N starts at 1 each day). |
| `published_at`   | string (ISO 8601) | UTC timestamp of when the admin published this config.                                |
| `app_identifier` | string            | User-defined identifier for the application. Independent of bundle ID.                |

The artifact always contains three top-level collections: `flags`, `tests`, `rollouts`. All may be empty objects but must be present.

---

## Naming rules

All identifiers (`flags`, `tests`, `rollouts` keys) must match:

```
^[a-z_]+$
```

- ASCII lowercase letters and underscores only — no digits, hyphens, spaces, or uppercase.
- No leading or trailing underscores (recommended: `^[a-z](?:[a-z_]*[a-z])?$`).
- Max length: 64 characters.
- Flag keys may include a namespace prefix separated by `/` (e.g. `store/use_new_paywall_design`). Each segment must satisfy the rule above.

Examples: `new_picker_enabled`, `button_color_test`, `beta_users`, `store/use_new_paywall_design`.

---

## Flags

Each flag has a `type`, an optional `description`, an optional `deprecated` flag, and an `environment` object for each of `development`, `beta`, and `production`.

Supported types: `bool`, `string`, `int`, `double`, `date`, `json`.

- `date` values use ISO 8601 date strings (`YYYY-MM-DD`).
- `json` values are embedded JSON objects (not strings); the SDK exposes them as `Data`.
- `deprecated` (boolean, optional): present and `true` when the flag is archived. The flag is still served so existing clients keep resolving it, but the SDK codegen marks the generated accessor `@available(*, deprecated)` and the runtime fires `didReadDeprecatedFlag(flagKey:)` on read. Omitted (treated as `false`) for active flags.

```json
"flags": {
  "store/use_new_paywall_design": {
    "type": "bool",
    "description": "Enables the new paywall UI",
    "development": {
      "default": true,
      "variants": []
    },
    "beta": {
      "default": false,
      "variants": []
    },
    "production": {
      "default": false,
      "variants": [
        {
          "type": "rollout",
          "rollout": "new_checkout_flow",
          "value": true,
          "order": 1
        }
      ]
    }
  }
}
```

Each environment object:

| Field      | Required | Description                                                        |
| ---------- | -------- | ------------------------------------------------------------------ |
| `default`  | yes      | Typed fallback value for this environment when no variant matches. |
| `variants` | no       | Ordered list of variant rules. Omit or use `[]` for none.          |

---

## Variants

Variants are evaluated in ascending `order`. The first match wins and the flag's value for that request is the variant's `value`. If no variant matches, the environment `default` is returned.

Three variant types exist:

### `conditional`

Matches when all listed `conditions` evaluate to `true`.

```json
{
	"type": "conditional",
	"order": 1,
	"value": true,
	"conditions": [
		{
			"type": "region",
			"values": ["EU"],
			"operator": "in"
		}
	]
}
```

### `test`

References a named A/B test. The SDK buckets the user and returns the value for their assigned group.

```json
{
	"type": "test",
	"order": 2,
	"test": "button_color_test",
	"values": {
		"control": false,
		"variant_a": true
	}
}
```

### `rollout`

References a named rollout. Returns `value` if the user's bucket falls within the rollout percentage.

```json
{
	"type": "rollout",
	"order": 3,
	"rollout": "gradual_enable",
	"value": true
}
```

---

## Conditions

Conditions appear inside `conditional` variant objects.

```json
{
	"type": "<condition_type>",
	"values": ["..."],
	"operator": "<operator>"
}
```

> The admin's condition editor carries a client-side `id` for React keys, but the
> generator strips it before publishing — `id` does **not** appear in the artifact.

### Condition types and operators

**Number conditions** (`os_version`, `app_version`, `build_number`):

Operators: `equals`, `does_not_equals`, `between`, `greater_than_or_equal`, `greater_than`, `less_than`, `less_than_or_equal`

```json
{
	"type": "os_version",
	"values": ["18.0"],
	"operator": "greater_than_or_equal"
}
```

**List conditions** (`platform`, `device_model`, `region`, `language`):

Operators: `in`, `not_in`

```json
{
	"type": "platform",
	"values": ["iOS", "macOS"],
	"operator": "in"
}
```

**Custom attribute** (evaluated by the host app via SDK callback):

```json
{
	"type": "custom_attribute",
	"values": ["is_premium_user"],
	"operator": "custom"
}
```

`values[0]` is the attribute name passed to the SDK's custom attribute resolver.

---

## Tests

A/B experiments with deterministic user bucketing.

```json
"tests": {
  "button_color_test": {
    "name": "Button color experiment",
    "description": "Compare red vs blue CTA",
    "type": "test",
    "salt": "btn_color_v1",
    "conditions": [],
    "groups": [
      { "name": "control", "percentage": 50 },
      { "name": "blue_theme", "percentage": 50 }
    ]
  }
}
```

| Field        | Required | Description                                                                                                                                        |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`       | yes      | Human-readable display name.                                                                                                                       |
| `type`       | yes      | Always `"test"`.                                                                                                                                   |
| `salt`       | yes      | Unique, immutable random string. Changing it remaps all users.                                                                                     |
| `conditions` | yes      | Entry conditions; only users matching all conditions participate (`[]` when none).                                                                 |
| `groups`     | no       | Array of `{ name, percentage }`. Omitted when the test has no groups. Percentages should sum to ≤ 100. The SDK buckets users into a group by name. |

---

## Rollouts

Percentage-based gradual feature exposures.

```json
"rollouts": {
  "gradual_enable": {
    "name": "Gradual enable",
    "description": "Enable for X% of users",
    "type": "rollout",
    "salt": "rollout-salt-v1",
    "conditions": [],
    "percentage": 25
  }
}
```

| Field        | Required | Description                                                 |
| ------------ | -------- | ----------------------------------------------------------- |
| `name`       | yes      | Human-readable display name.                                |
| `type`       | yes      | Always `"rollout"`.                                         |
| `salt`       | yes      | Unique, immutable random string.                            |
| `conditions` | yes      | Entry conditions (`[]` when none).                          |
| `percentage` | yes      | Integer 0–100. Users with bucket ≤ percentage are included. |

---

## Bucketing algorithm

Used by both tests and rollouts to assign users to a deterministic bucket (1–100).

**Input string:** `salt:localId` — concatenate with a single colon separator.

Example: `btn_color_v1:550e8400-e29b-41d4-a716-446655440000`

**Steps:**

1. Encode the input string as UTF-8 bytes.
2. Compute the SHA-256 hash.
3. Take the first 8 bytes of the digest and interpret them as an unsigned big-endian 64-bit integer.
4. `bucket = (int_value % 100) + 1` — result is an integer from 1 to 100 inclusive.

The admin (`src/lib/bucketing.ts`) and the SDK (`Bucketing.swift`) both implement this 8-byte/64-bit form, so admin-side bucket previews match real SDK behavior for the same `(salt, localId)`.

**Salts are immutable.** Once a test or rollout is published, its `salt` must never change — doing so remaps all users and breaks experiment continuity. The admin generates salts randomly at creation time.

### Reference implementations

**Swift (CryptoKit):**

```swift
import CryptoKit

func bucketFor(salt: String, id: UUID) -> Int {
    let input = "\(salt):\(id.uuidString)"
    let data = Data(input.utf8)
    let digest = SHA256.hash(data: data)
    let prefix = digest.prefix(8)
    var value: UInt64 = 0
    for byte in prefix { value = (value << 8) | UInt64(byte) }
    return Int((value % 100) + 1)
}
```

**JavaScript (Node.js / SubtleCrypto):**

```js
async function bucketFor(salt, localId) {
	const input = `${salt}:${localId}`;
	const bytes = new TextEncoder().encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
	const hash = new Uint8Array(hashBuffer);
	let val = 0n;
	for (let i = 0; i < 8; i++) {
		val = (val << 8n) + BigInt(hash[i]);
	}
	return Number(val % 100n) + 1;
}
```

**Kotlin:**

```kotlin
import java.security.MessageDigest

fun bucketFor(salt: String, id: String): Int {
    val input = "$salt:$id"
    val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
    var value = 0L
    for (i in 0 until 8) {
        value = (value shl 8) or (digest[i].toLong() and 0xff)
    }
    return ((value % 100) + 1).toInt()
}
```

---

## Signing and verification

Config artifacts are signed using JWS with RS256. The signature is delivered as a detached JWS string in the `x-bunting-signature` HTTP response header, or as a separate `config.json.sig` file alongside `config.json`.

The JWS `header` must include `alg: RS256` and `kid` for key rotation.

**Signing rule:** sign the exact UTF-8 bytes of `config.json` as stored — no whitespace normalization.

**SDK verification steps:**

1. Look up the public key for the `kid` from the set embedded in `BuntingConfig.plist`.
2. Parse and verify the detached JWS with RS256.
3. If verification passes, use the config. If it fails, fall back to the last-known-good cached config, or the bundled seed if no cache exists.

**Key rotation:** apps embed multiple public keys. Old keys stay valid for all shipped builds; new app versions add newer keys. The admin signs with the current active private key.

---

## Delivery and caching

CDN URL pattern: `https://<cdn-host>/flags/<appIdentifier>/config.json`

- `config.json.sig` at the same path prefix for the signature.
- Recommended headers: `Cache-Control: max-age=300, stale-while-revalidate=86400`.
- Conditional fetches using `ETag`.
- Versioned copies at `/versions/<config_version>.json` (optional).

---

## JSON Schema (Draft-07)

```json
{
	"$schema": "http://json-schema.org/draft-07/schema#",
	"type": "object",
	"required": [
		"schema_version",
		"config_version",
		"published_at",
		"app_identifier",
		"flags",
		"tests",
		"rollouts"
	],
	"properties": {
		"schema_version": { "type": "integer" },
		"config_version": { "type": "string" },
		"published_at": { "type": "string", "format": "date-time" },
		"app_identifier": { "type": "string" },
		"flags": {
			"type": "object",
			"additionalProperties": {
				"type": "object",
				"required": ["type", "development", "beta", "production"],
				"properties": {
					"type": {
						"type": "string",
						"enum": ["bool", "string", "int", "double", "date", "json"]
					},
					"description": { "type": "string" },
					"development": { "$ref": "#/definitions/environment" },
					"beta": { "$ref": "#/definitions/environment" },
					"production": { "$ref": "#/definitions/environment" }
				}
			}
		},
		"tests": {
			"type": "object",
			"additionalProperties": {
				"type": "object",
				"required": ["name", "type", "salt", "conditions"],
				"properties": {
					"name": { "type": "string" },
					"description": { "type": "string" },
					"type": { "type": "string", "enum": ["test"] },
					"salt": { "type": "string" },
					"conditions": {
						"type": "array",
						"items": { "$ref": "#/definitions/condition" }
					},
					"groups": {
						"type": "array",
						"items": {
							"type": "object",
							"required": ["name", "percentage"],
							"properties": {
								"name": { "type": "string" },
								"percentage": { "type": "integer" }
							}
						}
					}
				}
			}
		},
		"rollouts": {
			"type": "object",
			"additionalProperties": {
				"type": "object",
				"required": ["name", "type", "salt", "conditions", "percentage"],
				"properties": {
					"name": { "type": "string" },
					"description": { "type": "string" },
					"type": { "type": "string", "enum": ["rollout"] },
					"salt": { "type": "string" },
					"conditions": {
						"type": "array",
						"items": { "$ref": "#/definitions/condition" }
					},
					"percentage": { "type": "integer", "minimum": 0, "maximum": 100 }
				}
			}
		}
	},
	"definitions": {
		"environment": {
			"type": "object",
			"required": ["default"],
			"properties": {
				"default": {},
				"variants": {
					"type": "array",
					"items": {
						"type": "object",
						"required": ["type", "order"],
						"properties": {
							"type": {
								"type": "string",
								"enum": ["conditional", "test", "rollout"]
							},
							"order": { "type": "integer" },
							"value": {},
							"conditions": {
								"type": "array",
								"items": { "$ref": "#/definitions/condition" }
							},
							"test": { "type": "string" },
							"rollout": { "type": "string" },
							"values": { "type": "object" }
						}
					}
				}
			}
		},
		"condition": {
			"type": "object",
			"required": ["type", "values", "operator"],
			"properties": {
				"type": { "type": "string" },
				"values": { "type": "array" },
				"operator": { "type": "string" }
			}
		}
	}
}
```

---

## Flag evaluation reference (SDK behaviour)

1. Select the environment object matching the current runtime environment (`development`, `beta`, or `production`).
2. Sort `variants` by `order` ascending.
3. For each variant:
   - `conditional`: evaluate all `conditions`; if all pass, return `value`.
   - `test`: bucket the user via the bucketing algorithm; map the bucket to a variant group using cumulative percentages; return `values[group]`.
   - `rollout`: bucket the user; if `bucket <= percentage`, return `value`.
4. If no variant matched, return the environment `default`.

---

## Complete example

```json
{
	"schema_version": 1,
	"config_version": "2025-09-15.1",
	"published_at": "2025-09-15T14:05:00Z",
	"app_identifier": "com.example.myapp",

	"flags": {
		"store/use_new_paywall_design": {
			"type": "bool",
			"description": "Enables the redesigned paywall screen",
			"development": { "default": true, "variants": [] },
			"beta": { "default": false, "variants": [] },
			"production": {
				"default": false,
				"variants": [
					{
						"type": "rollout",
						"order": 1,
						"rollout": "paywall_rollout",
						"value": true
					}
				]
			}
		}
	},

	"tests": {
		"button_color_test": {
			"name": "Button color experiment",
			"type": "test",
			"salt": "btn_color_v1",
			"conditions": [],
			"groups": [
				{ "name": "control", "percentage": 50 },
				{ "name": "blue_theme", "percentage": 50 }
			]
		}
	},

	"rollouts": {
		"paywall_rollout": {
			"name": "Paywall redesign rollout",
			"type": "rollout",
			"salt": "paywall_v2",
			"conditions": [],
			"percentage": 25
		}
	}
}
```
