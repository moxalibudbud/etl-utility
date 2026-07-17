package reader

import "fmt"

// AzureAuthType identifies which credential mode an AzureAuth carries.
type AzureAuthType string

const (
	// AzureAuthSharedKey authenticates with AccountName + AccountKey.
	AzureAuthSharedKey AzureAuthType = "shared-key"
	// AzureAuthConnectionString authenticates with a storage connection string.
	AzureAuthConnectionString AzureAuthType = "connection-string"
	// AzureAuthSAS authenticates with a SAS token (or one already embedded in
	// the blob URL).
	AzureAuthSAS AzureAuthType = "sas"
	// AzureAuthDefault is the zero-value mode: the azidentity
	// DefaultAzureCredential chain (managed identity, workload identity,
	// az login, environment service principal).
	AzureAuthDefault AzureAuthType = "default"
)

// AzureAuth carries caller-supplied Azure Storage credentials. The caller
// populates exactly one mode; the zero value selects the default credential
// chain so serverless/managed-identity deployments need no secrets at all.
type AzureAuth struct {
	AccountName      string `json:"accountName,omitempty"`
	AccountKey       string `json:"accountKey,omitempty"`
	ConnectionString string `json:"connectionString,omitempty"`
	SASToken         string `json:"sasToken,omitempty"`
}

// Type identifies which auth mode the populated fields represent. Precedence
// when several modes are populated: connection string > shared key > SAS.
// A half-filled shared key pair is an error rather than a silent fallback to
// the default chain.
func (a AzureAuth) Type() (AzureAuthType, error) {
	switch {
	case a.ConnectionString != "":
		return AzureAuthConnectionString, nil
	case a.AccountName != "" && a.AccountKey != "":
		return AzureAuthSharedKey, nil
	case a.AccountName != "" || a.AccountKey != "":
		return "", fmt.Errorf("azure auth: shared key requires both accountName and accountKey")
	case a.SASToken != "":
		return AzureAuthSAS, nil
	default:
		return AzureAuthDefault, nil
	}
}
