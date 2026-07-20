---
type: concept
title: "Agent Instructions: Documentation Scope"
source: /AGENTS/
path: /AGENTS/
updated: 2026-07-20
okf:
  generated_by: "@docmd/plugin-okf"
  generated_at: "2026-07-20T12:58:26.426Z"
---
# Agent Instructions: Documentation Scope

## Scope & Boundaries
- **Target Context:** Only read, analyze, and modify Markdown files located directly in the root of the `docs/` directory (`docs/*.md`).
- **Strict Exclusions:** Do **NOT** read, index, or parse the `docs/sites/` directory under any circumstances. 
  > *Note: `docs/sites/` contains the built webapp documentation and web assets generated from the root markdown files. Treating it as context will cause duplicate information and messy search results.*

## Execution Rules
1. Focus entirely on source files like `docs/getting-started.md` or `docs/api-reference.md`.
2. Ignore any files inside `docs/sites/*` even if a global workspace search references them.
