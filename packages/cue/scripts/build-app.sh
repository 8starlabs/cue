#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm build
swift build --package-path "$ROOT/native" -c release

APP="$ROOT/build/Cue.app"
RUNTIME="$APP/Contents/Resources/CueRuntime"
VERSION="$(node -p "require('$ROOT/package.json').version")"
BUNDLE_ID="dev.cue.terminal-suggestions"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$ROOT/native/.build/release/Cue" "$APP/Contents/MacOS/Cue"
cp -R "$ROOT/node_modules/@withfig/autocomplete/icons" "$APP/Contents/Resources/FigIcons"
cp "$ROOT/node_modules/@withfig/autocomplete/LICENSE" "$APP/Contents/Resources/FigIcons/LICENSE"
mkdir -p "$APP/Contents/Resources/MaterialIconTheme"
cp -R "$ROOT/native/Resources/MaterialIconTheme/"* "$APP/Contents/Resources/MaterialIconTheme/"
mkdir -p "$RUNTIME/bin" "$RUNTIME/dist" "$RUNTIME/node_modules/@withfig"
cp "$ROOT/scripts/stop-cue-processes.sh" "$RUNTIME/bin/stop-cue-processes.sh"
cp -R "$ROOT/dist/" "$RUNTIME/dist/"
cp -RL "$ROOT/node_modules/@withfig/autocomplete" "$RUNTIME/node_modules/@withfig/autocomplete"
cp -RL "$ROOT/node_modules/shell-quote" "$RUNTIME/node_modules/shell-quote"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>Cue</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleName</key><string>Cue</string>
  <key>CFBundleDisplayName</key><string>Cue</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>LSUIElement</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
PLIST
if [[ -n "${CUE_CODESIGN_IDENTITY:-}" ]]; then
  codesign --force --deep --options runtime --timestamp \
    --sign "$CUE_CODESIGN_IDENTITY" --identifier "$BUNDLE_ID" "$APP"
elif [[ "${CUE_RELEASE_BUILD:-0}" == "1" && "${CUE_ALLOW_ADHOC_RELEASE:-0}" != "1" ]]; then
  echo "A Developer ID signature is recommended for release builds." >&2
  echo "Set CUE_CODESIGN_IDENTITY, or explicitly allow an ad hoc build with CUE_ALLOW_ADHOC_RELEASE=1." >&2
  exit 1
else
  # Keep a stable designated requirement across ad hoc development builds.
  # This lets macOS identify successive local builds as the same Accessibility
  # client instead of tying trust to each build's changing cdhash.
  codesign --force --deep --sign - --identifier "$BUNDLE_ID" \
    --requirements "=designated => identifier \"$BUNDLE_ID\"" "$APP"
fi

# When building interactively in a supported terminal, stop Cue apps and
# workers owned by this user, then start the build just created. Package builds
# stay free of GUI side effects.
if [[ "${TERM_PROGRAM:-}" =~ ^(Apple_Terminal|vscode)$ && "${CUE_RELEASE_BUILD:-0}" != "1" ]]; then
  "$RUNTIME/bin/stop-cue-processes.sh" --restart "$APP"
fi

echo "Built $APP"
