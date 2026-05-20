# PDFForge

PDFForge is split into two independent parts:

## Website

The website part is the React + Express stack used for uploads, UI, API routes, auth, storage, and AI features.

### Website folders

- `website/client/` React front end
- `website/server/` Express API and service layer
- `website/uploads/`, `website/compressed/`, `website/temp/` runtime folders

### Website setup

```bash
npm install
npm install --workspace website/server
npm install --workspace website/client
npm run dev:web
```

### Website build

```bash
npm run build:web
```

## Core Engine

The core engine is the native C/C++ PDF parser and processing layer.

### Engine folder

- `engine/` native C/C++ engine
- `engine/src/pdf_xref_parser.c` PDF xref parser
- `engine/src/main.cpp` engine CLI entrypoint

### Engine setup

```bash
npm run build:engine
```

### Engine command

```bash
engine/build/Release/huffzip-ai.exe xref-parse input.pdf output.json
```

## Notes

- The website and engine are intentionally kept separate so the UI/API layer can evolve independently from the PDF parser and native processing code.
- The native engine currently handles classic PDF xref parsing first; more PDF internals can be added as separate engine modules later.
