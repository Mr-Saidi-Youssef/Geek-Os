# Contributing to Geek-Os

Thanks for your interest in contributing.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with your own Notion integration and OAuth credentials. Never commit real credentials.

## Development guidelines

- Keep user credentials out of source control.
- Prefer small, focused pull requests.
- Move one-off scripts into `scripts/` instead of the repo root.
- Add comments for integration-specific edge cases.
- Use clear commit messages, for example `fix(auth): handle missing workspace mapping`.

## Adding a media provider

1. Add a provider integration module.
2. Normalize search results into the shared shape:

```js
{
  title,
  year,
  cover,
  synopsis,
  genres,
  metadata
}
```

3. Add mapping logic for Notion properties.
4. Document any required environment variables.

## Repo hygiene

Do not commit:

- `node_modules/`
- `.env`
- generated dumps
- checkpoint files
- local workspace connection stores
