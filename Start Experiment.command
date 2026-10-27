#!/bin/sh
cd "$(dirname "$0")" || exit 1
task_node="$(command -v node)"
if [ -z "$task_node" ]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "$candidate" ]; then task_node="$candidate"; break; fi
  done
fi
if [ -z "$task_node" ]; then
  echo "Node.js is needed to start the local experiment."
  exit 1
fi
export ENUMERATION_PORT="${ENUMERATION_PORT:-8766}"
echo "Open http://127.0.0.1:${ENUMERATION_PORT} in Chrome. Keep this window open during the experiment."
"$task_node" serve.cjs
