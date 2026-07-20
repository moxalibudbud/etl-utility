package main

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

func TestHandleRequestRejectsUnsupportedMethod(t *testing.T) {
	resp, err := handleRequest(context.Background(), events.LambdaFunctionURLRequest{
		RequestContext: events.LambdaFunctionURLRequestContext{
			HTTP: events.LambdaFunctionURLRequestContextHTTPDescription{Method: http.MethodGet},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusMethodNotAllowed)
	}
}

func TestHandleRequestRejectsUnsupportedPath(t *testing.T) {
	resp, err := handleRequest(context.Background(), events.LambdaFunctionURLRequest{
		RawPath: "/unknown",
		RequestContext: events.LambdaFunctionURLRequestContext{
			HTTP: events.LambdaFunctionURLRequestContextHTTPDescription{Method: http.MethodPost},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusNotFound)
	}
}

func TestHandleRequestRejectsInvalidJSON(t *testing.T) {
	resp, err := handleRequest(context.Background(), events.LambdaFunctionURLRequest{
		RawPath: "/etl",
		RequestContext: events.LambdaFunctionURLRequestContext{
			HTTP: events.LambdaFunctionURLRequestContextHTTPDescription{Method: http.MethodPost},
		},
		Body: `{"source":`,
	})
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
	if !strings.Contains(resp.Body, "invalid request body") {
		t.Fatalf("Body = %q, want invalid request body", resp.Body)
	}
}

func TestHandleRequestRejectsUnknownFields(t *testing.T) {
	resp, err := handleRequest(context.Background(), events.LambdaFunctionURLRequest{
		RawPath: "/etl",
		RequestContext: events.LambdaFunctionURLRequestContext{
			HTTP: events.LambdaFunctionURLRequestContextHTTPDescription{Method: http.MethodPost},
		},
		Body: `{
			"source": "input.csv",
			"output": {"filename": "output.csv"},
			"options": {"line": {"columns": ["SKU"]}},
			"unexpected": true
		}`,
	})
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
	if !strings.Contains(resp.Body, "unknown field") {
		t.Fatalf("Body = %q, want unknown field error", resp.Body)
	}
}

func TestHandleRequestRejectsInvalidBase64(t *testing.T) {
	resp, err := handleRequest(context.Background(), events.LambdaFunctionURLRequest{
		RawPath: "/etl",
		RequestContext: events.LambdaFunctionURLRequestContext{
			HTTP: events.LambdaFunctionURLRequestContextHTTPDescription{Method: http.MethodPost},
		},
		IsBase64Encoded: true,
		Body:            "not base64",
	})
	if err != nil {
		t.Fatal(err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}
