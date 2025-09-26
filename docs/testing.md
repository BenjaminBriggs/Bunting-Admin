# Testing

Bunting Admin enforces strong coverage and a mix of automated test types to keep the dashboard reliable.

## Test Types

- **Unit**: Core business logic, validation, and services.
- **Contract**: API endpoints and integrations.
- **Performance**: Flag evaluation speed and conformance with constitutional requirements.
- **End-to-end**: Full user flows via Playwright.

## Coverage Requirements

- Minimum 90% for lines, functions, branches, and statements.
- Reports generated in text, HTML, and LCOV formats.
- GitHub Actions publishes coverage summaries automatically.

## Useful Commands

```bash
npm run test             # Full suite
npm run test:unit        # Unit tests only
npm run test:coverage    # Generate coverage report
npm run test:coverage:open # Coverage report + open in browser
npm run test:e2e         # Playwright end-to-end tests
```

Add new tests alongside features and update snapshots as needed to keep CI green.
