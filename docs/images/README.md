# Screenshots to capture

The images listed here are referenced as placeholders from `concepts.md` and `product-overview.md`. Do not run the app to capture them; capture them manually and commit the PNG files to this directory.

---

## List of screenshots

### 1. `dashboard-overview.png`

**Page:** `/dashboard` (any app selected)
**State:** Sidebar visible with all nav items, flag list populated with at least 3 flags of mixed types (boolean, string, rollout-controlled).
**What to show:** The overall layout — sidebar with app selector, main content area with flag cards.

---

### 2. `flag-editor.png`

**Page:** `/dashboard/flags` with a flag expanded or open in edit mode
**State:** A boolean flag showing separate `development`, `staging`, and `production` default value columns, with at least one conditional variant rule visible.
**What to show:** The environment-first flag editing UI.

---

### 3. `ab-test-setup.png`

**Page:** `/dashboard/tests` — new test creation dialog or an existing test in edit mode
**State:** A test with two or three variants (`control`, `variant_a`) and traffic percentages configured.
**What to show:** Variant configuration and traffic split controls.

---

### 4. `rollout-slider.png`

**Page:** `/dashboard/rollouts`
**State:** A rollout card with the percentage slider set to a non-zero value (e.g. 25%).
**What to show:** The real-time rollout percentage control.

---

### 5. `releases-publish-flow.png`

**Page:** `/dashboard/releases`
**State:** Pending changes listed (at least 2), validation passing (green), the Publish button visible.
**What to show:** The review-and-publish workflow including the change summary.

---

## Naming convention

Use `kebab-case.png`. Prefer `@2x` resolution (Retina). Crop to the relevant UI area — avoid capturing browser chrome unless it aids context. Compress with `pngquant` or similar before committing.
