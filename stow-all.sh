#!/bin/sh
# Usage: ./stow-all.sh [-v] [-n]

OPTIND=1
VERBOSE=""
DRY_RUN=""

while getopts ":vnd" opt; do
  case $opt in
    v) VERBOSE="-v" ;;
    n) DRY_RUN="-n" ;;
    d) UNSTOW="-D" ;;
    \?) echo "Usage: $0 [-v] [-n] [-d]" >&2; exit 1 ;;
  esac
done

shift $((OPTIND - 1))

TARGET="$HOME"
DIRS=$(find . -mindepth 1 -maxdepth 1 -type d ! -name '.git' | sed 's|^\./||' | tr '\n' ' ')
CMD="stow $VERBOSE $DRY_RUN $UNSTOW -t $TARGET $DIRS"

echo "Preview of command:"
echo "$CMD"
read -p "Run this command? [y/N]: " yn
case $yn in
  [Yy]*) eval "$CMD" ;;
  *) echo "Aborted." ;;
esac
