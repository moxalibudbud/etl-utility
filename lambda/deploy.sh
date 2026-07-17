#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

aws lambda update-function-code \
  --function-name go-etl \
  --zip-file "fileb://$script_dir/bootstrap.zip" \
  --region ap-south-1
