#!/bin/bash
# AI Wikipedia Scraper GUI Launcher
# Uses the consolidated scraper_package.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "=========================================="
echo "  AI Wikipedia Scraper v2.0"
echo "  Consolidated Package Launcher"
echo "=========================================="

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if required packages are installed
echo "Checking dependencies..."

MISSING_PACKAGES=()
for pip_pkg in beautifulsoup4 lxml urllib3 requests; do
    case $pip_pkg in
        beautifulsoup4) import_name="bs4" ;;
        *) import_name="${pip_pkg//-/_}" ;;
    esac
    if ! python3 -c "import $import_name" 2>/dev/null; then
        MISSING_PACKAGES+=("$pip_pkg")
    fi
done

# Optional packages
OPTIONAL_PACKAGES=()
for package in pillow cryptography; do
    import_name="${package//-/_}"
    if ! python3 -c "import $import_name" 2>/dev/null; then
        OPTIONAL_PACKAGES+=("$package")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo "ERROR: Missing required packages: ${MISSING_PACKAGES[*]}"
    echo "Install with: pip3 install --break-system-packages ${MISSING_PACKAGES[*]}"
    exit 1
fi

if [ ${#OPTIONAL_PACKAGES[@]} -gt 0 ]; then
    echo "WARNING: Optional packages not installed: ${OPTIONAL_PACKAGES[*]}"
    echo "  - pillow: Image preview will be disabled"
    echo "  - cryptography: Credential encryption will use plaintext"
    echo ""
fi

# Check if the package is properly set up
if [ ! -f "scraper_package/__init__.py" ]; then
    echo "ERROR: scraper_package not found in current directory"
    echo "Expected location: $SCRIPT_DIR/scraper_package/"
    exit 1
fi

echo "Starting GUI..."
echo ""

# Launch the GUI
python3 -m scraper_package.gui

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "GUI exited with error code: $EXIT_CODE"
    exit $EXIT_CODE
fi

exit 0
