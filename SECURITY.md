# Security Policy

Geek-Os connects to Notion workspaces and can store OAuth access tokens. Please treat every credential as sensitive.

## Supported versions

Security fixes are applied to the `main` branch while the project is early-stage.

## Reporting a vulnerability

Please open a private report if available, or contact the maintainer directly. Do not publish working exploits or exposed secrets in public issues.

## Secret handling rules

Never commit:

- `.env` or `.env.*` files, except `.env.example`
- Notion integration tokens
- Notion OAuth client secrets
- Vercel KV / Blob tokens
- Supabase service role keys
- local `connections.json` files
- generated checkpoint files containing workspace data

## If a secret is exposed

1. Revoke or rotate the secret immediately.
2. Remove the file from the current branch.
3. Purge the secret from Git history with `git filter-repo` or BFG.
4. Force-push the cleaned history if the repo has not yet been used by others.
5. Audit deployment logs and connected services.

Deleting a file in a new commit does not remove it from Git history.

## Production token storage

For production deployments, prefer a managed store such as Vercel KV or Supabase. Avoid local file token storage in production.

Recommended future configuration:

```env
STORAGE_DRIVER=vercel-kv
ALLOW_LOCAL_TOKEN_STORE=false
```
