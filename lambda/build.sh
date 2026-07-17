#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

cd "$repo_root/go"

GOOS=linux GOARCH=arm64 CGO_ENABLED=0 \
  go build -tags lambda.norpc -o "$script_dir/bootstrap" ./cmd/lambda

zip -j "$script_dir/bootstrap.zip" "$script_dir/bootstrap"
