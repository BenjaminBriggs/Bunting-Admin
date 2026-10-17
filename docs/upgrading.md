# Upgrading

Read the section for every version between the one you run and the one you are moving to. Migrations run automatically when the new version starts and only go forward, so take a backup first (see [deploy/README.md](../deploy/README.md#upgrading)).

## 1.0.0

The first stable release. If you ran the admin from source before 1.0.0, check each item below.

### Before you start the new version

- **`AUTH_TRUST_HOST` is now required in production OIDC mode** behind a reverse proxy (Caddy, Render, a load balancer). Set `AUTH_TRUST_HOST=true`, or set `AUTH_URL` to the public URL. Without either, the app refuses to boot, because Auth.js would otherwise reject every sign-in with `UntrustedHost`. `NEXTAUTH_URL` alone does not count. The `deploy/` bundle and `render.yaml` already set it.

### What the migrations change

- **Signing keys gain a status.** Keys that were active become `ACTIVE` (if an app had several, the newest stays `ACTIVE` and the others become `STANDBY`); inactive keys become `RETIRED` and drop out of bootstrap files. The next bootstrap download or publish mints a `STANDBY` key for any app that has none, so download a fresh `BuntingConfig.plist` / `bunting_config.json` for your next app release: it will trust two keys. See [security.md](security.md) for rotation.
- **Signing keys are no longer deleted with their app.** Deleting an app now requires an admin, the typed app identifier, and explicit confirmation that its keys will be deleted. Export any key you may need first.
- **Tests and rollouts record an outcome** (`COMPLETED` or `ABANDONED`). Entries archived before 1.0.0 have none.

### Behaviour that changed

- **Publish refuses anything an SDK would not decode losslessly.** Fix the reported item and publish again. The cases most likely in existing data are:
  - date values that aren't UTC instants with at most millisecond precision (for example date-only strings);
  - A/B test group percentages that aren't whole numbers from 0 to 100 or that sum to more than 100;
  - fractional rollout percentages.
- **A/B test remainder:** users whose bucket lands past every group, or in a group with no value for a flag, now fall through to the next variant or the default instead of getting the first group's value. This matches what the 1.0 SDKs do.
- **Complete keeps what users were getting.** Completing a rollout or test (pick a winner) writes its value into the attached flags; **Abandon** removes it. Both take effect on the next publish. The old Complete returned users to the flag default.
- **Immutable after creation:** flag key and type, test and rollout keys, and the app identifier. App update and delete are admin-only.
- **Test edits no longer wipe values.** Before 1.0.0, saving a test from its edit page replaced every group's per-flag values with empty strings. If you edited a test that way, check its group values on the Flags page before publishing.
