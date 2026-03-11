#!/bin/bash
# Usage: ./push-build.sh <project-name> <source-dir>
# Pushes build files to balpotros/ducell-builds on GitHub
set -e

PROJECT="$1"
SOURCE="$2"

if [ -z "$PROJECT" ] || [ -z "$SOURCE" ]; then
  echo "Usage: $0 <project-name> <source-dir>"
  exit 1
fi

REPO_DIR="/tmp/ducell-builds"

echo ">> Syncing ducell-builds repo..."
if [ -d "$REPO_DIR/.git" ]; then
  cd "$REPO_DIR" && git pull --rebase
else
  git clone https://github.com/balpotros/ducell-builds "$REPO_DIR"
fi

echo ">> Copying $SOURCE -> $REPO_DIR/$PROJECT/"
mkdir -p "$REPO_DIR/$PROJECT"
cp -r "$SOURCE"/. "$REPO_DIR/$PROJECT/"

echo ">> Committing and pushing..."
cd "$REPO_DIR"
git add "$PROJECT/"
git diff --cached --quiet && echo "Nothing new to push." && exit 0
git commit -m "Add $PROJECT build"
git push

echo ">> Done. $PROJECT pushed to ducell-builds."
