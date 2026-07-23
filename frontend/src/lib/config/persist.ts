import type { Config } from './types';

// The real backend for this tool isn't finalized yet — see
// docs/config-builder-ui-improvement.md's open questions. It may end up as a
// same-origin route on this app's own domain/subdomain, or a separate Lambda
// URL; `fetch` works identically against either, so nothing here needs to
// change when it lands — only VITE_CONFIG_API_URL. Trailing slash stripped
// so joining with a leading-slash path below never produces a doubled `//`.
const CONFIG_API_BASE_URL: string = (import.meta.env.VITE_CONFIG_API_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

// The backend follows REST conventions — `config` is a resource, so creating
// one is POST /config.
const CONFIG_RESOURCE_URL = `${CONFIG_API_BASE_URL}/config`;

export class SaveConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SaveConfigError';
  }
}

// POSTs the assembled Config as JSON to /config. Throws SaveConfigError on a
// network failure or a non-2xx response, with a message safe to show the
// user directly (the call site doesn't need to know which case it was).
export async function saveConfig(config: Config): Promise<void> {
  let response: Response;
  try {
    response = await fetch(CONFIG_RESOURCE_URL, {
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
