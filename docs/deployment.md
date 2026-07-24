# Deployment Guide

Geek-Os can run on Vercel using the included `vercel.json`.

## Required environment variables

```env
NOTION_TOKEN=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
WIDGET_BASE_URL=https://your-domain.example
```

## Optional storage

For production, configure a persistent token store.

### Vercel KV

```env
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

### Supabase

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
# or, if absolutely needed server-side only:
SUPABASE_SERVICE_ROLE_KEY=
```

## Optional cover uploads

```env
BLOB_READ_WRITE_TOKEN=
```

## OAuth callback

Set your Notion OAuth callback URL to:

```text
https://your-domain.example/api/notion/callback
```

## Security

Never deploy with placeholder credentials. Never commit `.env`.
