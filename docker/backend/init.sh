#!/bin/bash
set -e
echo "Running backend init"
# python -m pip install -r /workspace/QubbedDataAnalysis/backend_requirements.txt
gunicorn -w 2 -b 0.0.0.0:8000 --chdir /workspace/QubbedDataAnalysis/backend App:app

