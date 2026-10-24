#!/usr/bin/env bash
set -euo pipefail
PIPELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${PYTHON:-python3}" "$PIPELINE_DIR/pipeline.py" "$@"
