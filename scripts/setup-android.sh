#!/bin/bash
set -e
echo "=== Injecting Native Plugins ==="

mkdir -p android/app/src/main/java/com/matchreport/app/ringtones
rm -f android/app/src/main/java/com/matchreport/app/ringtones/RingtonePlugin.kt

python3 scripts/write_java_files.py

echo "=== Done ==="
