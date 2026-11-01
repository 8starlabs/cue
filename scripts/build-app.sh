#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm build
swift build --package-path "$ROOT/native" -c release

APP="$ROOT/build/Cue.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$ROOT/native/.build/release/Cue" "$APP/Contents/MacOS/Cue"
cp -R "$ROOT/node_modules/@withfig/autocomplete/icons" "$APP/Contents/Resources/FigIcons"
cp "$ROOT/node_modules/@withfig/autocomplete/LICENSE" "$APP/Contents/Resources/FigIcons/LICENSE"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>Cue</string>
  <key>CFBundleIdentifier</key><string>dev.cue.terminal-suggestions</string>
  <key>CFBundleName</key><string>Cue</string>
  <key>CFBundleDisplayName</key><string>Cue</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>LSUIElement</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>CueProjectPath</key><string>$ROOT</string>
</dict>
</plist>
PLIST
codesign --force --deep --sign - "$APP"
echo "Built $APP"
