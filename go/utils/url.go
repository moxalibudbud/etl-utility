package util

import (
	"net/url"
)

func IsValidURL(u string) bool {
	parsed, err := url.Parse(u)
	if err != nil {
		return false
	}
	return parsed.Scheme != "" && parsed.Host != ""
}
