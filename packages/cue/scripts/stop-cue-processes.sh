#!/bin/bash
set -euo pipefail

MODE="${1:---stop}"
APP="${2:-}"
CURRENT_UID="$(id -u)"
SOCKET="/tmp/cue-${CURRENT_UID}.sock"
CACHE="${SOCKET}.cache"

case "$MODE" in
  --stop|--restart|--restart-if-running) ;;
  *)
    printf 'Usage: %s [--stop|--restart|--restart-if-running] [Cue.app path]\n' "$0" >&2
    exit 2
    ;;
esac

if [[ "$MODE" != "--stop" && ! -d "$APP" ]]; then
  printf 'Cue app bundle not found: %s\n' "$APP" >&2
  exit 2
fi

cue_processes() {
  /bin/ps -axo uid=,pid=,command= | while IFS= read -r row; do
    if [[ "$row" =~ ^[[:space:]]*([0-9]+)[[:space:]]+([0-9]+)[[:space:]]+(.*)$ ]]; then
      local process_uid="${BASH_REMATCH[1]}"
      local process_pid="${BASH_REMATCH[2]}"
      local process_command="${BASH_REMATCH[3]}"
      [[ "$process_uid" == "$CURRENT_UID" ]] || continue
      case "$process_command" in
        */Cue.app/Contents/MacOS/Cue|*/Cue.app/Contents/MacOS/Cue\ *|*"/Cue.app/Contents/Resources/CueRuntime/dist/worker.js"*)
          printf '%s\n' "$process_pid"
          ;;
      esac
    fi
  done
}

PIDS="$(cue_processes)"
WAS_RUNNING=0
if [[ -n "$PIDS" ]]; then
  WAS_RUNNING=1
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && kill -TERM "$pid" 2>/dev/null || true
  done <<< "$PIDS"

  for _ in {1..30}; do
    PIDS="$(cue_processes)"
    [[ -n "$PIDS" ]] || break
    sleep 0.1
  done

  PIDS="$(cue_processes)"
  if [[ -n "$PIDS" ]]; then
    printf 'Cue processes did not stop cleanly; leaving the socket in place. PIDs: %s\n' "${PIDS//$'\n'/, }" >&2
    exit 1
  fi
fi

for path in "$SOCKET" "$CACHE"; do
  if [[ -e "$path" && -O "$path" ]]; then
    rm -f -- "$path"
  fi
done

if [[ "$MODE" == "--restart" || ( "$MODE" == "--restart-if-running" && "$WAS_RUNNING" == 1 ) ]]; then
  /usr/bin/open -ga "$APP"
  printf 'Started Cue from %s.\n' "$APP"
elif [[ "$WAS_RUNNING" == 1 ]]; then
  printf 'Stopped the current user\x27s Cue app and worker processes.\n'
else
  printf 'No Cue processes were running for the current user.\n'
fi
