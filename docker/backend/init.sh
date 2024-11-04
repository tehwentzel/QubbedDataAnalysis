#!/bin/bash
set -e
echo "Running backend init"
gunicorn -w 3 -b 0.0.0.0:8000 --chdir /workspace/QubbedDataAnalysis/backend App:app

