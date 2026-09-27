#!/usr/bin/env bash
# Starts Metro for Expo Go through a tunnel, retrying when the tunnel fails to come up.
#
# Why: Expo CLI gives ngrok a fixed 10 s to connect (no setting to raise it). Expo's shared
# ngrok account is sometimes slower than that, so a start can fail even though an immediate
# retry works. Only failures during startup are retried; quitting a running session
# (Ctrl+C / q) exits normally.
set -u

MAX_ATTEMPTS=${GO_TUNNEL_ATTEMPTS:-5}
STARTUP_WINDOW=60 # seconds: a run shorter than this that fails is treated as a tunnel failure

interrupted=0
trap 'interrupted=1' INT

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  started=$(date +%s)
  npx expo start --go --tunnel "$@"
  code=$?
  elapsed=$(( $(date +%s) - started ))

  if [ "$code" -eq 0 ] || [ "$interrupted" -eq 1 ] || [ "$elapsed" -ge "$STARTUP_WINDOW" ]; then
    exit "$code"
  fi

  echo ""
  echo "⚠  Tunnel did not start (attempt $attempt/$MAX_ATTEMPTS). Retrying in 3 s…"
  echo "   Status page: https://status.ngrok.com/"
  sleep 3
done

echo ""
echo "✖  Tunnel failed $MAX_ATTEMPTS times. Options:"
echo "   • Try again in a minute (ngrok/Expo service hiccup)."
echo "   • Use LAN mode: pnpm go:lan (needs WSL mirrored networking, see README)."
exit 1
