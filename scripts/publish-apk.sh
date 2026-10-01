#!/usr/bin/env bash
# Publish an Android build to the website's /downloads folder.
#   scripts/publish-apk.sh path/to/app-debug.apk 1.1.0 7 [user@host:/path/to/tayenda-web]
# With a remote target the files are copied over SSH; otherwise ./downloads is used.
set -euo pipefail
apk="$1"; version="$2"; code="$3"; target="${4:-}"
out="$(mktemp -d)"
name="tayenda-${version}.apk"
cp "$apk" "$out/$name"
cp "$apk" "$out/tayenda.apk"
size=$(stat -c %s "$apk" 2>/dev/null || stat -f %z "$apk")
sha=$(sha256sum "$apk" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$apk" | cut -d' ' -f1)
cat > "$out/latest.json" <<JSON
{"version":"$version","versionCode":$code,"file":"$name","sizeBytes":$size,"sha256":"$sha","releasedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
JSON
if [ -n "$target" ]; then
  scp -q "$out"/* "${target%%:*}:${target#*:}/downloads/"
else
  mkdir -p downloads && cp "$out"/* downloads/
fi
echo "Published $name ($size bytes, sha256 $sha)"
