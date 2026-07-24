# API Notes

## Health

A health endpoint should be added during the next refactor:

```text
GET /api/health
```

## Search endpoints

```text
GET /api/search/anime?q=
GET /api/search/manga?q=
GET /api/search/movie?q=
GET /api/search/tv?q=
GET /api/search/game?q=
GET /api/search/book?q=
GET /api/search/comic?q=
```

Search responses are normalized to:

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

## Notion endpoints

```text
GET  /api/notion/login
GET  /api/notion/callback
GET  /api/notion/config
GET  /api/notion/databases
POST /api/notion/map
POST /api/notion/disconnect
```

## Add to Notion

```text
POST /api/add
```

Required fields:

```js
{
  workspaceId,
  type,
  title
}
```
