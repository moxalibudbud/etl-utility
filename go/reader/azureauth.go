package reader

import "flatfile-go/azureauth"

// AzureAuth and AzureAuthType moved to the shared azureauth package so the
// writer's blob destination can reuse the same credential dispatch with a
// different storage account. These aliases keep existing reader call sites
// compiling.
type (
	AzureAuth     = azureauth.AzureAuth
	AzureAuthType = azureauth.Type
)

const (
	AzureAuthSharedKey        = azureauth.SharedKey
	AzureAuthConnectionString = azureauth.ConnectionString
	AzureAuthSAS              = azureauth.SAS
	AzureAuthDefault          = azureauth.Default
)
