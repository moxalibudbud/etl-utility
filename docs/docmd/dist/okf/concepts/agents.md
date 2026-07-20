---
type: concept
title: "Agent Instructions: Documentation Scope & Style"
source: /AGENTS/
path: /AGENTS/
updated: 2026-07-20
okf:
  generated_by: "@docmd/plugin-okf"
  generated_at: "2026-07-20T13:18:22.911Z"
---
# Agent Instructions: Documentation Scope & Style

This file defines the strict operational boundaries, folder exclusions, and writing guidelines for all AI operations performed within the `docs/` directory.

---

## 1. Scope & Directory Boundaries

### Target Context
- **Allowed Source:** Only read, analyze, and modify source Markdown files located directly in the root of the `docs/` directory (`docs/*.md`).

### Strict Exclusions
- **Do NOT read or parse the `docs/docmd/` directory under any circumstances.**
- *Reasoning:* `docs/docmd/` contains configuration (`docmd.config.json`) and the built webapp/static assets (like `docs/docmd/dist/`). Treating this directory as context will cause massive token bloat, duplicated information, and broken workspace search results.

---

## 2. Tone & Language Style (Accessible Prose)

### Writing Guidelines
- **Target Audience:** Write for an audience that includes developers, product managers, and business stakeholders. Avoid dense, purely system-level infrastructure jargon.
- **The "So What?" Rule:** Focus on the operational or business impact (e.g., costs, user experience, reliability) rather than writing exclusively about low-level backend behaviors. 
- **Clarity Over Complexity:** Explain *what* happens and *how* to fix it simply. If a technical term must be used, provide immediate, plain-English context.

### Tone Examples

❌ **Too Technical (Do NOT write like this):**
> "Operational note: aborted uploads leave uncommitted staged blocks. They are invisible (no blob exists, so Delete correctly finds nothing) but are billed and retained ~7 days. At serverless volume with a nonzero failure rate this accrues silently. Mitigation is a container lifecycle rule to purge uncommitted blocks — infrastructure, not code."

> Known gap: errors from json_encoder.go (row/root render) and from mid-stream
writes into the sink’s io.Writer are not explicitly annotated. They fall back
to KindOf’s unknown→KindPermanent default, which is right for the common
case (bad template or data) but not provably right for a destination write
failing mid-encode.


## 3. Execution Checklist
Before finalizing any edits to markdown files in this directory, verify:
1. You have not pulled text or context from `docs/docmd/`.
2. The language is conversational yet professional, keeping heavy technical jargon to an absolute minimum.
3. Code blocks (if any) are properly tagged with their respective language syntax.


