package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleETLRejectsInvalidJSON(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/etl",
		strings.NewReader(`{"source":`),
	)
	rec := httptest.NewRecorder()

	handleETL(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if contentType := rec.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", contentType)
	}
}

func TestHandleETLRejectsUnknownFields(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/etl",
		strings.NewReader(`{
			"source": "input.csv",
			"output": {"filename": "output.csv"},
			"options": {"line": {"columns": ["SKU"]}},
			"unexpected": true
		}`),
	)
	rec := httptest.NewRecorder()

	handleETL(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if !strings.Contains(rec.Body.String(), "unknown field") {
		t.Fatalf("response = %q, want unknown field error", rec.Body.String())
	}
}

func TestHandleETLRejectsMultipleJSONValues(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/etl",
		strings.NewReader(`{} {}`),
	)
	rec := httptest.NewRecorder()

	handleETL(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	handleHealth(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if !strings.Contains(rec.Body.String(), `"status":"ok"`) {
		t.Fatalf("response = %q, want healthy status", rec.Body.String())
	}
}
