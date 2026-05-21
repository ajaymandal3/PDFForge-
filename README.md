# PDFForge

PDFForge is a full-stack PDF toolkit with a React + Express web app and a native C/C++ processing engine.

## Project Highlights

- Custom C/C++ engine that parses raw PDF bytes and traverses the xref table with a hash-map based parser.
- Core document workflows built with data-structure driven implementations: merge with a linked-list queue, split and reordering with stack-based page selection, compression with Huffman plus DEFLATE, and encryption with AES-GCM.
- Node.js/Express API that exposes compression, merge, split, watermark, protect, extract-text, resume analysis, and Gemini-powered summarization endpoints.
- React + Tailwind frontend with dedicated tools for PDF operations, AI summarization, and document security.

## Website

The website layer handles uploads, UI, API routes, storage, and AI features.

### Website folders

- `website/client/` React front end
- `website/server/` Express API and service layer
- `website/uploads/`, `website/compressed/`, `website/temp/` runtime folders

### Website setup

```bash
npm install
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
- `engine/src/deflate_codec.cpp` DEFLATE codec support
- `engine/src/pdf_ops.cpp` page-structure helpers

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
- Gemini summarization uses the `GEMINI_API_KEY` setting in [`.env.example`](.env.example).
