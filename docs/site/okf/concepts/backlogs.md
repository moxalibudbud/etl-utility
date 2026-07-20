---
type: concept
title: Backlog
source: /backlogs/
path: /backlogs/
updated: 2026-07-20
okf:
  generated_by: "@docmd/plugin-okf"
  generated_at: "2026-07-20T07:39:39.029Z"
---
# Backlog

## Remove the unreachable source-header branch from the writer

**Origin:** Follow-up discovered during the completed config-structure review  
**Priority:** Minor  
**Status:** Deferred

`DefaultWriter.buildRow` checks `sl.IsHeader()` and omits the leading newline
for header rows. This branch is unreachable through the normal Go ETL pipeline:
`ETL.processLines` filters source headers with
`sl.IsValid() && !sl.IsHeader()` before calling `Writer.Push`.

This is separate from `OutputConfig.Header`. The configured output header is
written by `pushHeader` when the first data row creates the output file and
does not depend on pushing the source header row.

Keep the branch for now because `Writer.Push` is public and a non-ETL caller
could pass a header `SourceLine` directly.

### Recommended implementation

Define `Writer.Push` as accepting validated data rows only, document that
source-header filtering belongs to the ETL orchestrator, and remove the
`sl.IsHeader()` branch from `buildRow`. It can then always return
`"\n" + row`.

Add or retain focused coverage confirming that:

- the ETL orchestrator does not push source header rows;
- configured output headers are still written once; and
- output data rows remain newline-prefixed.
