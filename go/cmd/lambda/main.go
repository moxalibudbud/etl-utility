// Command etl-lambda exposes the ETL pipeline through an AWS Lambda Function URL.
package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
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

// handleRequest takes the invocation context because Lambda encodes the
// function's remaining execution time in it (ctx.Deadline()). Passing it as the
// budget's base means our derived work deadline composes with the platform's:
// WithDeadline picks whichever is earlier, so the reserved cleanup window is
// preserved even if the function is configured with less time than the ceiling.
func handleRequest(ctx context.Context, req events.LambdaFunctionURLRequest) (events.LambdaFunctionURLResponse, error) {
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

	budget, err := etl.BudgetFromEnv()
	if err != nil {
		return jsonResponse(http.StatusInternalServerError, errorResponse{Error: err.Error()})
	}

	result, err := etl.RunContext(ctx, budget, cfg)
	if err != nil {
		return jsonResponse(http.StatusInternalServerError, errorResponse{Error: err.Error()})
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
