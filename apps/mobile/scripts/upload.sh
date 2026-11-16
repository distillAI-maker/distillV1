#!/bin/bash
# Archives the iOS app and uploads it to App Store Connect, from the command line.
#
#   npm run upload           archive, sign for the App Store, check it, upload
#   npm run upload -- --check  everything but the upload (leaves the .ipa in ~/.distill-ios/export)
#
# Why not Xcode's Archive button: the Lin Yang team has no registered iPhone, so Xcode can't make the
# development profile it signs archives with ("Your team has no devices"). So this builds unsigned,
# gives the app a local signature that carries App.entitlements (the sign-in links), and lets
# xcodebuild sign it for the App Store with the team's cloud certificate. Registering any iPhone on
# the team makes the Archive button work too.
#
# Needs Xcode signed in to the team (Settings, Accounts). Raise CURRENT_PROJECT_VERSION first: Apple
# refuses a build number it has already seen.
set -euo pipefail

TEAM=NT3W645293
cd "$(dirname "$0")/.."
OUT="$HOME/.distill-ios"
mkdir -p "$OUT"

# The build must open the live app, never a local server (npm run sync:local).
npm run sync >/dev/null
if ! grep -q '"url": "https://distill-app-nu.vercel.app' ios/App/App/capacitor.config.json; then
  echo "The synced config doesn't point at the live app. Run npm run sync." >&2
  exit 1
fi

settings=$(xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -showBuildSettings 2>/dev/null)
version=$(awk -F' = ' '/ MARKETING_VERSION = /{print $2; exit}' <<<"$settings")
build=$(awk -F' = ' '/ CURRENT_PROJECT_VERSION = /{print $2; exit}' <<<"$settings")
bundle=$(awk -F' = ' '/ PRODUCT_BUNDLE_IDENTIFIER = /{print $2; exit}' <<<"$settings")
archive="$OUT/Distill-$version-$build.xcarchive"
echo "Distill $version ($build), $bundle"

rm -rf "$archive"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$archive" -derivedDataPath "$OUT/DerivedData" \
  CODE_SIGNING_ALLOWED=NO archive >"$OUT/archive.log" 2>&1 || {
  echo "Archive failed: see $OUT/archive.log" >&2
  exit 1
}

# The local signature: App.entitlements plus the app's identity, so App Store signing keeps them.
app="$archive/Products/Applications/App.app"
ent="$OUT/entitlements.plist"
cp ios/App/App/App.entitlements "$ent"
/usr/libexec/PlistBuddy -c "Add :application-identifier string $TEAM.$bundle" \
  -c "Add :com.apple.developer.team-identifier string $TEAM" -c "Add :get-task-allow bool false" "$ent"
for framework in "$app"/Frameworks/*.framework; do
  [ -e "$framework" ] && codesign --force --sign - --timestamp=none "$framework"
done
codesign --force --sign - --entitlements "$ent" --timestamp=none "$app"

options() {
  cat >"$OUT/Export-$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$1</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
EOF
}

# First a local copy, to check what Apple will get.
options export
rm -rf "$OUT/export"
xcodebuild -exportArchive -archivePath "$archive" -exportOptionsPlist "$OUT/Export-export.plist" \
  -exportPath "$OUT/export" -allowProvisioningUpdates >"$OUT/export.log" 2>&1 || {
  echo "Signing for the App Store failed: see $OUT/export.log" >&2
  exit 1
}
check="$OUT/check"
rm -rf "$check" && mkdir -p "$check"
unzip -q "$OUT/export/App.ipa" -d "$check"
signed="$check/Payload/App.app"
codesign --verify --deep --strict "$signed"
codesign -dvv "$signed" 2>&1 | grep -q "Authority=Apple Distribution" || {
  echo "The app isn't signed with an Apple Distribution certificate." >&2
  exit 1
}
codesign -d --entitlements - --xml "$signed" 2>/dev/null | grep -q "applinks:" || {
  echo "The sign-in-link entitlement went missing; not uploading." >&2
  exit 1
}
echo "Checked: signed for the App Store, sign-in links kept."

if [ "${1:-}" = "--check" ]; then
  echo "Not uploaded (--check). The .ipa is in $OUT/export."
  exit 0
fi

options upload
xcodebuild -exportArchive -archivePath "$archive" -exportOptionsPlist "$OUT/Export-upload.plist" \
  -exportPath "$OUT/upload" -allowProvisioningUpdates >"$OUT/upload.log" 2>&1 || {
  echo "Upload failed: see $OUT/upload.log" >&2
  exit 1
}
grep -q "Upload succeeded" "$OUT/upload.log" && echo "Uploaded $version ($build). It shows in TestFlight once Apple has processed it."
