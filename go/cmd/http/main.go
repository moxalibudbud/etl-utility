// Command etl-http exposes the ETL pipeline over HTTP.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"flatfile-go/etl"
)

const maxRequestBodySize = 1 << 20 // 1 MiB

type errorResponse struct {
	Error string `json:"error"`
}

func main() {
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /etl", handleETL)
	mux.HandleFunc("GET /health", handleHealth)

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      5 * time.Minute,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("ETL HTTP server listening on %s", addr)

	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func handleETL(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodySize)
	defer r.Body.Close()

	cfg, err := decodeConfig(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{
			Error: fmt.Sprintf("invalid request body: %v", err),
		})
		return
	}

	result, err := etl.Run(cfg)
	if err != nil {
		// Log the detailed internal error, while returning a stable HTTP response.
		log.Printf("ETL run failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{
			Error: "ETL run failed",
		})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func decodeConfig(body io.Reader) (etl.Config, error) {
	var cfg etl.Config

	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&cfg); err != nil {
		return etl.Config{}, err
	}

	// Reject multiple JSON values such as "{}{}".
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return etl.Config{}, errors.New("body must contain one JSON object")
		}
		return etl.Config{}, err
	}

	return cfg, nil
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("could not encode HTTP response: %v", err)
	}
}
