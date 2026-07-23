package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleCreateConfigAcceptsAnyBody(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/config",
		strings.NewReader(`{"anything": "goes"}`),
	)
	rec := httptest.NewRecorder()

	handleCreateConfig(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusCreated)
	}
	if !strings.Contains(rec.Body.String(), `"status":"accepted"`) {
		t.Fatalf("response = %q, want status:accepted", rec.Body.String())
	}
}

func TestHandleGetConfig(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/config/abc123", nil)
	req.SetPathValue("id", "abc123")
	rec := httptest.NewRecorder()

	handleGetConfig(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if !strings.Contains(rec.Body.String(), `"id":"abc123"`) {
		t.Fatalf("response = %q, want id:abc123", rec.Body.String())
	}
}

func TestHandleUpdateConfig(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPut,
		"/config/abc123",
		strings.NewReader(`{"anything": "goes"}`),
	)
	req.SetPathValue("id", "abc123")
	rec := httptest.NewRecorder()

	handleUpdateConfig(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if !strings.Contains(rec.Body.String(), `"id":"abc123"`) {
		t.Fatalf("response = %q, want id:abc123", rec.Body.String())
	}
}

func TestHandleDeleteConfig(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/config/abc123", nil)
	req.SetPathValue("id", "abc123")
	rec := httptest.NewRecorder()

	handleDeleteConfig(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
}

func TestWithCORSAllowsLocalhostOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()

	withCORS(http.HandlerFunc(handleHealth)).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want http://localhost:5173", got)
	}
}

func TestWithCORSRejectsOtherOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "https://example.com")
	rec := httptest.NewRecorder()

	withCORS(http.HandlerFunc(handleHealth)).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty", got)
	}
}

func TestWithCORSHandlesPreflight(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/config", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()

	withCORS(http.HandlerFunc(handleHealth)).ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want http://localhost:3000", got)
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
