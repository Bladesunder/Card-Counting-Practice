#!/bin/zsh

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$PROJECT_DIR"

pause_before_exit() {
  printf "\nPress Return to close this window."
  read -r
}

fail() {
  printf "\n%s\n" "$1" >&2
  pause_before_exit
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Install Node.js 20.19+ from the 20.x line or 22.12+, then run npm ci once while online."
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is not available. Reinstall Node.js 20.19+ from the 20.x line or 22.12+, then run npm ci once while online."
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
USE_PREVIEW=0

if ! node -e '
  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  const supported = major === 20
    ? minor >= 19
    : major >= 22 && (major > 22 || minor > 12 || (minor === 12 && patch >= 0));
  process.exit(supported ? 0 : 1);
' >/dev/null 2>&1; then
  if [[ "$NODE_MAJOR" -eq 21 ]]; then
    USE_PREVIEW=1
    printf "\nNode.js 21 is outside Vite's supported range. Using production preview mode instead.\n"
  else
    fail "This project requires Node.js 20.19+ from the 20.x line or 22.12+. Update Node.js, then try again."
  fi
fi

if [[ ! -x "$PROJECT_DIR/node_modules/.bin/vite" ]] || ! npm ls --all >/dev/null 2>&1; then
  printf "\nProject dependencies are missing or incomplete. Installing them now...\n"
  printf "An internet connection may be required the first time.\n\n"
  if ! npm ci --prefer-offline --no-audit --no-fund; then
    fail "Dependencies could not be installed. Connect to the internet and double-click this launcher again."
  fi
fi

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required to check that the local game server is ready."
fi

PORT=5173
while lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; do
  (( PORT += 1 ))
  if (( PORT > 5199 )); then
    fail "No available local port was found between 5173 and 5199."
  fi
done

LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/card-counting-practice.XXXXXX")"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG_FILE"
}

print_log() {
  if [[ -s "$LOG_FILE" ]]; then
    while IFS= read -r line; do
      printf "%s\n" "$line"
    done <"$LOG_FILE"
  fi
}

trap cleanup EXIT INT TERM

if (( USE_PREVIEW )); then
  printf "Building the game for local preview...\n"
  if ! npm run build; then
    fail "The game build failed. Update Node.js to 20.19+ from the 20.x line or 22.12+, then try again."
  fi
fi

printf "Starting Card Counting Practice on http://127.0.0.1:%s ...\n" "$PORT"
if (( USE_PREVIEW )); then
  npm run preview -- --host 127.0.0.1 --port "$PORT" --strictPort >"$LOG_FILE" 2>&1 &
else
  npm run dev -- --host 127.0.0.1 --port "$PORT" --strictPort >"$LOG_FILE" 2>&1 &
fi
SERVER_PID=$!

URL="http://127.0.0.1:$PORT"
for _ in {1..40}; do
  if curl --silent --fail --output /dev/null "$URL" 2>/dev/null; then
    printf "Opening %s\n" "$URL"
    open "$URL"
    wait "$SERVER_PID"
    exit $?
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    printf "\nVite could not start. Output:\n" >&2
    print_log >&2
    pause_before_exit
    exit 1
  fi

  sleep 0.25
done

printf "\nThe local server did not become ready in time. Output:\n" >&2
print_log >&2
pause_before_exit
exit 1
