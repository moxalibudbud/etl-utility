// Command configui exposes the config-builder authoring backend over HTTP.
package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"
)

const maxRequestBodySize = 1 << 20 // 1 MiB

type errorResponse struct {
	Error string `json:"error"`
}

func main() {
	addr := os.Getenv("CONFIGUI_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /config", handleCreateConfig)
	mux.HandleFunc("GET /config/{id}", handleGetConfig)
	mux.HandleFunc("PUT /config/{id}", handleUpdateConfig)
	mux.HandleFunc("DELETE /config/{id}", handleDeleteConfig)
	mux.HandleFunc("GET /health", handleHealth)

	server := &http.Server{
		Addr:              addr,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("Config Builder HTTP server listening on %s", addr)

	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

// handleCreateConfig is a stub: it performs no validation or storage yet. It
// accepts the request body as-is, logs it, and reports success. Real
// validation against etl.Config and persistence land in a later change.
func handleCreateConfig(w http.ResponseWriter, r *http.Request) {
	body, ok := readBody(w, r)
	if !ok {
		return
	}

	log.Printf("POST /config: %s", body)

	writeJSON(w, http.StatusCreated, map[string]string{"status": "accepted"})
}

// handleGetConfig is a stub: no config store exists yet, so it just logs the
// requested id and reports success.
func handleGetConfig(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	log.Printf("GET /config/%s", id)

	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "ok"})
}

// handleUpdateConfig is a stub: no config store exists yet, so it just logs
// the requested id and body and reports success.
func handleUpdateConfig(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	body, ok := readBody(w, r)
	if !ok {
		return
	}

	log.Printf("PUT /config/%s: %s", id, body)

	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "ok"})
}

// handleDeleteConfig is a stub: no config store exists yet, so it just logs
// the requested id and reports success.
func handleDeleteConfig(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	log.Printf("DELETE /config/%s", id)

	w.WriteHeader(http.StatusNoContent)
}

// withCORS allows browser requests from any localhost/127.0.0.1 origin
// (any port), so a local frontend dev server (Vite, etc.) can call this API
// without a CORS error. It has no effect on non-browser clients.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if isLocalOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isLocalOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}

	return u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1"
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

// readBody reads and caps the request body, writing a 400 response and
// returning ok=false if the read fails.
func readBody(w http.ResponseWriter, r *http.Request) (body []byte, ok bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodySize)
	defer r.Body.Close()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{
			Error: "could not read request body",
		})
		return nil, false
	}

	return body, true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("could not encode HTTP response: %v", err)
	}
}
