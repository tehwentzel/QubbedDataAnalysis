#!/bin/bash
cd /workspace/QubbedDataAnalysis/frontend
npm install
# npm start -p 9000
npm run build
npm install -g serve
serve -s build -p 9000 --cors
