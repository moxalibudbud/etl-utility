import type { LineConfig } from './types'

// Whether built configs get persisted at all (named, versioned, reloadable)
// is still open — see docs/config-builder-ui-improvement.md's open questions.
// Until that's decided and a backend exists, this just logs what would be
// sent, so the call site doesn't need to change when persistence lands.
export async function saveLineConfig(line: LineConfig): Promise<void> {
  console.log('[config-builder] saving options.line', line)
}
