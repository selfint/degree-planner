#!/usr/bin/env bash
set -euo pipefail

mirror_file="${1:-/etc/apt/apt-mirrors.txt}"
if [[ ! -f "$mirror_file" ]]; then
  echo "No runner mirror list found; existing APT sources are unchanged."
  exit 0
fi

# The Ubuntu 24.04 runner already trusts archive.ubuntu.com (priority 2) and
# security.ubuntu.com (priority 3). Azure's slow package downloads can exhaust
# the capture job's budget, so retain it only as the final fallback. Do not
# change source URLs, signing configuration, or any other mirror priorities.
sed -i '/^http:\/\/azure\.archive\.ubuntu\.com\/ubuntu\/[[:blank:]]\+priority:1[[:blank:]]*$/s/priority:1/priority:4/' "$mirror_file"
