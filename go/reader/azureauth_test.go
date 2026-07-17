package reader

import "testing"

func TestAzureAuthTypeIdentification(t *testing.T) {
	tests := []struct {
		name    string
		auth    AzureAuth
		want    AzureAuthType
		wantErr bool
	}{
		{name: "empty is default chain", auth: AzureAuth{}, want: AzureAuthDefault},
		{name: "shared key", auth: AzureAuth{AccountName: "acct", AccountKey: "key"}, want: AzureAuthSharedKey},
		{name: "connection string", auth: AzureAuth{ConnectionString: "AccountName=acct;AccountKey=key"}, want: AzureAuthConnectionString},
		{name: "sas token", auth: AzureAuth{SASToken: "sv=2024&sig=abc"}, want: AzureAuthSAS},
		{name: "connection string beats shared key", auth: AzureAuth{ConnectionString: "cs", AccountName: "acct", AccountKey: "key"}, want: AzureAuthConnectionString},
		{name: "shared key beats sas", auth: AzureAuth{AccountName: "acct", AccountKey: "key", SASToken: "sig=abc"}, want: AzureAuthSharedKey},
		{name: "account name without key errors", auth: AzureAuth{AccountName: "acct"}, wantErr: true},
		{name: "account key without name errors", auth: AzureAuth{AccountKey: "key"}, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.auth.Type()
			if tt.wantErr {
				if err == nil {
					t.Fatalf("Type() = %q, want error", got)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Fatalf("Type() = %q, want %q", got, tt.want)
			}
		})
	}
}
