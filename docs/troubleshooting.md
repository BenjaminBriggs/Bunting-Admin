# Troubleshooting

A few common hiccups and how to recover from them.

## Database Connection Errors

```bash
npm run docker:down
npm run docker:up
npm run db:push
```

- Ensure Docker is running and ports 5432/9000/9001 are free.
- Delete any local `.env` overrides that point to unreachable databases.

## MinIO Issues

- Visit http://localhost:9001 and confirm the required buckets exist.
- Restart the containers if credentials were changed.

## Development Keys Missing

```bash
rm -rf keys/
node scripts/generate-dev-keys.js
```

- The keys directory is ignored by git; regenerate them whenever you clone the project afresh.

Still stuck? Open a GitHub discussion or file an issue with logs and the command you ran.
