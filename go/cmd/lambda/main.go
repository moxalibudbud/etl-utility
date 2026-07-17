// Command etl-lambda exposes the ETL pipeline through an AWS Lambda Function URL.
package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"flatfile-go/etl"
	"flatfile-go/internal/configjson"
)

const maxRequestBodySize = 1 << 20 // 1 MiB

type errorResponse struct {
	Error string `json:"error"`
}

func main() {
	lambda.Start(handleRequest)
}

func handleRequest(req events.LambdaFunctionURLRequest) (events.LambdaFunctionURLResponse, error) {
	if req.RequestContext.HTTP.Method != "" && req.RequestContext.HTTP.Method != http.MethodPost {
		return jsonResponse(http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
	}

	if req.RawPath != "" && req.RawPath != "/" && req.RawPath != "/etl" {
		return jsonResponse(http.StatusNotFound, errorResponse{Error: "not found"})
	}

	body, err := requestBody(req)
	if err != nil {
		return jsonResponse(http.StatusBadRequest, errorResponse{Error: err.Error()})
	}
	if len(body) > maxRequestBodySize {
		return jsonResponse(http.StatusRequestEntityTooLarge, errorResponse{Error: "request body too large"})
	}

	cfg, err := configjson.Decode(bytes.NewReader(body))
	if err != nil {
		return jsonResponse(http.StatusBadRequest, errorResponse{
			Error: fmt.Sprintf("invalid request body: %v", err),
		})
	}

	result, err := etl.Run(cfg)
	if err != nil {
		log.Printf("ETL run failed: %v", err)
		return jsonResponse(http.StatusInternalServerError, errorResponse{Error: "ETL run failed"})
	}

	return jsonResponse(http.StatusOK, result)
}

func requestBody(req events.LambdaFunctionURLRequest) ([]byte, error) {
	if !req.IsBase64Encoded {
		return []byte(req.Body), nil
	}

	body, err := base64.StdEncoding.DecodeString(req.Body)
	if err != nil {
		return nil, fmt.Errorf("invalid base64 request body")
	}
	return body, nil
}

func jsonResponse(status int, value any) (events.LambdaFunctionURLResponse, error) {
	var body strings.Builder
	if err := json.NewEncoder(&body).Encode(value); err != nil {
		return events.LambdaFunctionURLResponse{}, err
	}

	return events.LambdaFunctionURLResponse{
		StatusCode: status,
		Headers: map[string]string{
			"content-type": "application/json",
		},
		Body: body.String(),
	}, nil
}
