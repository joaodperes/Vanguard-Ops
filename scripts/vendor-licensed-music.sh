#!/usr/bin/env bash
# Vendor CC BY 4.0 recordings for local playback: see MUSIC-CREDITS.md.
# Re-encoding reduces bandwidth; no composition or arrangement is changed.
set -euo pipefail

command -v curl >/dev/null
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null

mkdir -p public/music
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
base="https://incompetech.com/music/royalty-free/mp3-royaltyfree"
tracks=(
  "airport-lounge|Airport%20Lounge"
  "easy-lemon|Easy%20Lemon"
  "backbay-lounge|Backbay%20Lounge"
  "bossa-antigua|Bossa%20Antigua"
  "local-forecast|Local%20Forecast"
  "chill-wave|Chill%20Wave"
)

for entry in "${tracks[@]}"; do
  filename="${entry%%|*}"
  source_name="${entry#*|}"
  url="$base/$source_name.mp3"
  echo "Fetching licensed original: $filename"
  curl --fail --location --silent --show-error --retry 4 --retry-all-errors --connect-timeout 25 \
    --max-time 900 "$url" -o "$tmp/source.mp3"
  # Fail closed: do not commit an HTML error page as an MP3.
  duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$tmp/source.mp3")"
  awk -v seconds="$duration" 'BEGIN { if (!(seconds > 25)) exit 1 }'
  ffmpeg -hide_banner -loglevel error -y -i "$tmp/source.mp3" -vn \
    -map_metadata -1 -codec:a libmp3lame -b:a 80k -ar 44100 -ac 2 \
    "public/music/$filename.mp3"
  test -s "public/music/$filename.mp3"
  ffprobe -v error "public/music/$filename.mp3" >/dev/null
  rm -f "$tmp/source.mp3"
done

echo "Prepared six CC BY 4.0 music files under public/music."
