#!/bin/bash
# AI Wikipedia Application Launcher
# Starts the Tauri desktop application

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1
VERSION=$(cat "$SCRIPT_DIR/VERSION")

# Optional clean: remove stale project build artifacts, keep dependency cache
if [ "${1:-}" = "--clean" ]; then
    echo "Cleaning old build artifacts..."
    (cd src-tauri && cargo clean -p ai-wikipedia && rm -rf target/debug/incremental)
    echo "Clean complete."
    echo ""
fi

echo "=========================================="
echo "  AI Wikipedia v${VERSION}"
echo "  Powered by Ollama + Tauri"
echo "=========================================="
echo ""

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "WARNING: Ollama doesn't appear to be running."
    echo "Start it with: OLLAMA_NUM_PARALLEL=1 OLLAMA_LLM_LIBRARY=cuda_v12 ollama serve"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Kill any existing processes on port 1420
lsof -ti:1420 | xargs kill -9 2>/dev/null

echo "Starting Vite dev server..."
npm run dev > /tmp/vite.log 2>&1 &
VITE_PID=$!

# Wait for Vite to start
echo "Waiting for Vite dev server..."
for i in {1..30}; do
    if curl -s http://localhost:1420 > /dev/null 2>&1; then
        echo "Vite is ready!"
        break
    fi
    sleep 1
done

# Check if Vite is actually running
if ! curl -s http://localhost:1420 > /dev/null 2>&1; then
    echo "ERROR: Vite failed to start. Check /tmp/vite.log"
    kill $VITE_PID 2>/dev/null
    exit 1
fi

echo "Starting Tauri..."
echo "Press Ctrl+C to stop"
echo ""

# Start Tauri (this will block)
npx tauri dev

# Cleanup when Tauri exits
echo ""
echo "Shutting down..."
kill $VITE_PID 2>/dev/null
