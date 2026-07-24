# Geek-Os

Geek-Os is an open-source Notion-powered media operating system for tracking and enriching anime, manga, movies, TV series, games, books, and comics.

It connects a user's Notion workspace to public metadata sources, then creates structured Notion entries with covers, genres, ratings, release data, synopsis fields, progress tracking, and reusable page layouts.

## What it does

- Searches public media sources from one widget/API.
- Adds selected media into mapped Notion databases.
- Supports anime, manga, movies, TV shows, games, books, and comics.
- Uses Notion OAuth so users can connect their own workspace.
- Auto-detects likely Notion database mappings.
- Copies reusable Notion page templates into newly created entries.
- Can upload and reuse cover images through Vercel Blob when configured.

## Supported sources

| Media type | Source |
| --- | --- |
| Anime | Jikan / MyAnimeList |
| Manga | Jikan / MyAnimeList |
| Movies | OMDb |
| TV shows | TVMaze |
| Games | Steam Store APIs |
| Books | Google Books, Open Library fallback |
| Comics | Open Library |

## Current status

This project started as a personal build and is being cleaned up for public use. Some scripts in `scripts/` are migration, inspection, repair, or import utilities used during development. The main app currently runs through the Express server.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Then open the local server and connect your Notion workspace.

## Environment variables

See `.env.example` for the full list. Never commit `.env` or real credentials.

Important values include:

- `NOTION_TOKEN`
- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `WIDGET_BASE_URL`
- optional Vercel KV / Blob variables
- optional Supabase variables

## Security notice

This app handles Notion OAuth access tokens. Treat all tokens as secrets. Do not commit `.env`, local connection stores, database dumps, or generated checkpoint files.

If you accidentally expose credentials, rotate them immediately and purge them from Git history.

## Project structure

```text
.
├── widget_server.js          # Current Express app entrypoint
├── connections_db.js         # Connection storage adapter
├── scripts/                  # Manual import/enrichment/inspection/repair scripts
├── docs/                     # Setup, deployment, and API notes
├── public/                   # Frontend assets, when present
├── .env.example              # Safe placeholder configuration
├── vercel.json               # Vercel deployment config
└── package.json
```

## Roadmap

- Split the large server file into `src/routes`, `src/services`, `src/integrations`, and `src/storage`.
- Add formal tests and a health endpoint.
- Improve database mapping UX and validation.
- Add clearer setup docs for Notion templates.
- Harden token storage and production deployment guidance.

## License

MIT
