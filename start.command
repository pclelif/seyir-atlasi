#!/bin/zsh

PROJECT_DIR="${0:A:h}"
NODE_BIN="$PROJECT_DIR/.runtime/node-v22.22.3-darwin-arm64/bin/node"

cd "$PROJECT_DIR" || exit 1

if [[ ! -x "$NODE_BIN" ]]; then
    echo "Yerel Node.js bulunamadı. README.md içindeki kurulum adımlarını kontrol et."
    read "?Kapatmak için Enter'a bas..."
    exit 1
fi

echo "SeyirAtlası başlatılıyor…"
"$NODE_BIN" server.js

echo
read "?Sunucu durdu. Kapatmak için Enter'a bas..."
