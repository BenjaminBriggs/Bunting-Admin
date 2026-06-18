# Bunting Admin — Documentation

Documentation follows the [Diátaxis](https://diataxis.fr) framework.

---

## Getting started

Practical guides for getting up and running.

| Document                                          | Description                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Local Development](local-development.md)         | Docker-powered local setup with Postgres, MinIO, and a local OIDC provider       |
| [Deployment](deployment.md)                       | One-click cloud hosting and post-deploy checklist                                |
| [Production Deployment](production-deployment.md) | Hardening, environment variables, storage, and auth configuration for production |

---

## How-to guides

Step-by-step instructions for common tasks.

| Document                              | Description                                     |
| ------------------------------------- | ----------------------------------------------- |
| [Testing](testing.md)                 | Running unit, integration, and end-to-end tests |
| [Troubleshooting](troubleshooting.md) | Quick fixes for common issues                   |
| [CONTRIBUTING](../CONTRIBUTING.md)    | How to contribute code, docs, and bug reports   |

---

## Reference

Exact specifications and API details.

| Document                                                 | Description                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Config Artifact Specification](config-artifact-spec.md) | Canonical JSON contract between Bunting Admin and the SDK — flag schema, bucketing algorithm, signing, and JSON Schema |
| [Config Fingerprint Code](config-fingerprint-spec.md)    | Short per-client code encoding a user's exact resolved flag config for a given version — format, encoding, and decoding |
| [API Reference](api-reference.md)                        | REST API endpoints, request/response shapes, and authentication                                                        |
| [Security](security.md)                                  | Auth model, key management, signing pipeline, and hardening recommendations                                            |
| [CHANGELOG](../CHANGELOG.md)                             | Version history and breaking changes                                                                                   |

---

## Explanation

Background and concepts for understanding how Bunting works.

| Document                                | Description                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Product Overview](product-overview.md) | Capabilities, typical workflows, and dashboard tour                                                                                                               |
| [Concepts](concepts.md)                 | Flags vs. tests vs. rollouts, the environment-first model, the authoring → signing → fetch → evaluate pipeline, deterministic bucketing, and glossary |
