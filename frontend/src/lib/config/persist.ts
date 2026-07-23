import type { Config } from './types';

// The real backend for this tool isn't finalized yet — see
// docs/config-builder-ui-improvement.md's open questions. It may end up as a
// same-origin route on this app's own domain/subdomain, or a separate Lambda
// URL; `fetch` works identically against either, so nothing here needs to
// change when it lands — only VITE_CONFIG_API_URL. Until then this falls
// back to a webhook.site sink so Save is exercisable end-to-end.
const CONFIG_API_URL: string = import.meta.env.VITE_CONFIG_API_URL || 'http://localhost:3000';

export class SaveConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SaveConfigError';
  }
}

// POSTs the assembled Config as JSON. Throws SaveConfigError on a network
// failure or a non-2xx response, with a message safe to show the user
// directly (the call site doesn't need to know which case it was).
//
// Content-Type is `text/plain`, not `application/json`, even though the body
// is JSON text. `application/json` is not a CORS-"simple" content type, so
// the browser sends a preflight OPTIONS request first — and webhook.site
// doesn't answer that preflight the way browsers expect, which surfaces as a
// CORS error despite the actual POST being perfectly fine. `text/plain` is
// CORS-simple (no preflight), and webhook.site doesn't care about the
// header. Once the real backend exists, confirm it parses a `text/plain`
// JSON body (or has its own CORS/preflight handling sorted out) before
// assuming this still needs to stay this way.
export async function saveConfig(config: Config): Promise<void> {
  let response: Response;
  try {
    response = await fetch(CONFIG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch (err) {
    throw new SaveConfigError('Could not reach the config service. Check your connection and try again.', {
      cause: err,
    });
  }

  if (!response.ok) {
    throw new SaveConfigError(`The config service rejected the request (${response.status} ${response.statusText}).`);
  }
}
