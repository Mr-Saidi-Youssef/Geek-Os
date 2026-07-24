# Setup Guide

## 1. Install dependencies

```bash
npm install
```

## 2. Create your local environment file

```bash
cp .env.example .env
```

Fill in your own credentials. Do not commit `.env`.

## 3. Configure Notion

Create a Notion integration and OAuth app, then set:

```env
NOTION_TOKEN=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
WIDGET_BASE_URL=http://localhost:8080
```

## 4. Configure databases

Geek-Os can auto-detect likely media databases, but explicit database IDs are recommended for reliable local development.

## 5. Run locally

```bash
npm run dev
```

## 6. Connect a workspace

Open the app, use the Notion login flow, and map each media type to the correct Notion database.
