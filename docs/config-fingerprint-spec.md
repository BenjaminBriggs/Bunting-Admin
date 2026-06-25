# Config Fingerprint Code Specification

This document defines the **config fingerprint code**: a short, standardized
string that captures the exact resolved flag configuration a single client has
for a given published config version. It is the canonical encoding contract
between any producer (the SDK) and any consumer (the admin, tooling). Where it
references flag/variant/environment shapes, the
[Config Artifact Specification](config-artifact-spec.md) takes precedence.

---

## Purpose

A fingerprint code recombines with a published artifact to reproduce a user's
resolved flag values exactly. It is designed to be:

- **Compact** — safe to emit in telemetry, logs, and crash reports at volume.
- **Decodable** — paste it into the admin (with the matching artifact) to recover
  every flag's resolved value and the reason it resolved that way.
- **Reproducible** — decode to a `flagKey → value` map and load it into the SDK
  override store to recreate the user's resolved config in a QA/test build.
- **Canonical** — two clients with identical resolved config on the same version
  produce the **same** code.

---

## Format

```
<config_version>.<HEX>
```

| Part             | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| `config_version` | Existing publish identifier `YYYY-MM-DD.N`, verbatim.                     |
| `HEX`            | Uppercase hex of the payload bitstream. Final partial nibble zero-padded. |

Example: `2026-06-18.1.FF89B283CDA823B`

The `config_version` identifies the exact artifact a decoder must load. The hex
payload carries only what varies per client; all flag definitions, variant
values, and test/rollout values come from that artifact.

---

## Design principle: encode selectors, not values

The payload records **which resolution path each flag took**, not the literal
values and not the raw evaluation inputs.

- Literal values would be unbounded for `string`/`json` flags — the code would
  stop being short.
- Raw inputs (context attributes + bucket positions) would force the decoder to
  replicate the SDK evaluation engine, and would be larger.

A selector index already carries the "why": it points at a specific
variant/test/rollout whose conditions live in the artifact. No replay required.

---

## Payload bitstream

Bits are packed **MSB-first, big-endian**, in this order:

| Field    | Bits                      | Meaning                                                                                       |
| -------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `fmt`    | 4                         | Fingerprint format version. This spec defines `1`. Evolves independently of `schema_version`. |
| `env`    | 2                         | Environment index: `0`=development, `1`=beta, `2`=production.                                 |
| per-flag | Σ `ceil(log2(pathCount))` | One selector per flag, flags iterated by **key ascending**.                                   |
| `crc`    | 8                         | CRC-8 (poly `0x07`, init `0x00`) over all preceding bits, zero-padded to whole bytes.         |

A flag with a single possible path (a pure default, no variants) contributes
**0 bits**. A flag with two paths contributes 1 bit, four paths 2 bits, etc.

---

## Per-flag path enumeration

Both encoder and decoder derive each flag's path list **identically and purely
from the artifact**, for the encoded `env`. This makes the bit layout stable for
a given `config_version`.

For each flag (iterated by key ascending over `flags`), enumerate terminal
resolution paths:

```
paths[0]   = environment default
paths[1..] = for each variant in `order` ascending
             (ties broken by published array index):
               conditional → 1 path  (its value)
               test        → 1 path per group of the *referenced* test
                             (artifact.tests[name].groups order; groups live on the
                             test definition, not on the variant)
               rollout     → 1 path  (the in-rollout value)
```

The selector stored is the index of the terminal path the client actually
resolved to. A flag that fell through to its default stores `0`.

### Semantics

- Paths are indexed by **resolution path, not value**. Two paths with equal
  values stay distinct, so decode recovers both the value and the reason
  (e.g. "group `treatment` of test `paywall_q3`").
- "Qualified for a test but not bucketed into any group" is **not** a terminal
  path; the flag records whatever it actually landed on (a later variant or the
  default). A client that missed a test and a client with no test both record
  `default`. The artifact reveals whether a test existed, so the distinction is
  recoverable when debugging.

---

## Decoding

Given `config_version` and `HEX`:

1. Fetch the artifact for `config_version`.
2. Hex → bytes → bitstream.
3. Read `fmt`; reject if unsupported.
4. Read `env`.
5. For each flag (key ascending): recompute its path list and bit-width from the
   artifact, read that many bits, index into the path list →
   `{ value, reason }`.
6. Read and verify `crc` over the consumed payload bits.

Output: an ordered map `flagKey → { type, value, reason }`, plus the resolved
environment.

### Reproduction

Decoding yields a `flagKey → value` map. Loading that map into the SDK override
store recreates the user's **resolved values** ("the exact config the user
has"). It does not replay the user's raw context or bucketing — those are not
encoded.

---

## Integrity and failure modes

| Condition                                | Behavior                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Transcription error in `HEX`             | CRC-8 mismatch → reject before a silent mis-decode.                       |
| Leftover non-padding bits / short buffer | Code does not match the artifact for that version → reject with an error. |
| Unknown `config_version`                 | Artifact unavailable → cannot decode; surface explicitly.                 |
| Unsupported `fmt`                        | Decoder refuses rather than guessing the layout.                          |

---

## Producer / consumer responsibilities

- **SDK (producer):** records the winning path index per flag during evaluation
  (the evaluator already computes the winner), enumerates paths from the
  artifact, and encodes the bitstream.
- **Admin / tooling (consumer):** loads the artifact by version, decodes, and
  presents resolved values with reasons.

Producer and consumer **must** enumerate paths and pack bits identically. A
shared set of test vectors (`artifact + env + path indices → code`) is the guard
against cross-implementation drift.

---

## Size

Fixed overhead is `fmt(4) + env(2) + crc(8)` = 14 bits. With ~25 flags averaging
2 bits each, a code is roughly 64 bits ≈ 16 hex characters. Size grows linearly
with flag count; pure-default flags are nearly free.

---

## Out of scope

- Encoding raw context attributes or per-test bucket positions.
- Replaying bucketing or conditions during reproduction (values-only repro).
- Non-hex base encodings. Hex matches the existing version format; a shorter base
  (e.g. base32) could be introduced later under a new `fmt`.
