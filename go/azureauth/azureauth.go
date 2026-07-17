// Package azureauth carries caller-supplied Azure Storage credentials shared
// by the blob reader (source) and blob writer (destination). Source and
// destination each hold their own AzureAuth, so a run can read from one
// storage account and write to another.
package azureauth

import "fmt"

// Type identifies which credential mode an AzureAuth carries.
type Type string

const (
	// SharedKey authenticates with AccountName + AccountKey.
	SharedKey Type = "shared-key"
	// ConnectionString authenticates with a storage connection string.
	ConnectionString Type = "connection-string"
	// SAS authenticates with a SAS token (or one already embedded in the
	// blob URL).
	SAS Type = "sas"
	// Default is the zero-value mode: the azidentity DefaultAzureCredential
	// chain (managed identity, workload identity, az login, environment
	// service principal).
	Default Type = "default"
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
func (a AzureAuth) Type() (Type, error) {
	switch {
	case a.ConnectionString != "":
		return ConnectionString, nil
	case a.AccountName != "" && a.AccountKey != "":
		return SharedKey, nil
	case a.AccountName != "" || a.AccountKey != "":
		return "", fmt.Errorf("azure auth: shared key requires both accountName and accountKey")
	case a.SASToken != "":
		return SAS, nil
	default:
		return Default, nil
	}
}
