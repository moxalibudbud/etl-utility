import type { AzureAuth } from './types'

export type AuthMode = 'connection-string' | 'shared-key' | 'sas' | 'default'

// Mirrors azureauth.Type()'s precedence (connection string > shared key > SAS
// > default/managed-identity). Never surfaces the secret value itself, only
// which credential shape is in play — the config-builder must not become a
// place secrets get displayed or stored.
export function resolveAuthMode(auth: AzureAuth | undefined): { mode: AuthMode; label: string } {
  if (auth?.connectionString) return { mode: 'connection-string', label: 'connection string (hidden)' }
  if (auth?.accountName && auth?.accountKey) return { mode: 'shared-key', label: `shared key · ${auth.accountName}` }
  if (auth?.sasToken) return { mode: 'sas', label: 'SAS token (hidden)' }
  return { mode: 'default', label: 'default credential chain' }
}
