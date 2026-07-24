# Refactor Plan

The current app is functional but still shaped like a fast personal build. This is the intended cleanup path.

## Target structure

```text
src/
├── server.js
├── app.js
├── config/
│   ├── env.js
│   └── mediaTypes.js
├── routes/
│   ├── notion.routes.js
│   ├── search.routes.js
│   └── add.routes.js
├── services/
│   ├── notionOAuth.service.js
│   ├── notionDatabase.service.js
│   ├── notionPage.service.js
│   ├── templateCopy.service.js
│   └── coverUpload.service.js
├── integrations/
│   ├── jikan.js
│   ├── tvmaze.js
│   ├── omdb.js
│   ├── steam.js
│   ├── googleBooks.js
│   └── openLibrary.js
├── storage/
│   └── connections.store.js
└── utils/
    ├── cleanMediaTitle.js
    ├── formatCoverUrl.js
    └── notionProperties.js
```

## Priorities

1. Move manual scripts into `scripts/`.
2. Remove generated data from Git.
3. Split `widget_server.js` into routes and services.
4. Move hardcoded database/template IDs into config.
5. Add request validation and friendly API errors.
6. Add tests for utilities and provider normalization.
7. Add `/api/health`.
