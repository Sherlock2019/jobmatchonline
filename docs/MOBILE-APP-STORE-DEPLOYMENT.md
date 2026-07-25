# Mobile app store deployment (Android + iOS)

Both native apps are thin Capacitor WebView wrappers around the live responsive
web app (`server: { url: 'https://jobsmatchnow.com/app/' }` in
`capacitor.config.ts`) -- there is no bundled/offline copy of the UI. Bundle ID
for both platforms: `com.jobsmatchnow.app`, version `1.0` (build `1`).

There's a separate `mobile-expo/` project in this repo -- that's a fast
Expo-Go preview shell for testing on a phone during development. It is **not**
the store-submission path; the Capacitor projects at `android/` and `ios/App/`
described below are.

## Android

### Toolchain (already set up on this machine)
- OpenJDK 21 (`/usr/lib/jvm/java-21-openjdk-amd64`) -- Capacitor's Android
  library requires 21; JDK 17 fails the build with `invalid source release: 21`.
- Android SDK at `~/Android/Sdk`: `platform-tools`, `platforms;android-36`,
  `build-tools;36.0.0`, installed via `~/Android/cmdline-tools/latest/bin/sdkmanager`.
- `android/local.properties` points `sdk.dir` at the SDK above (gitignored --
  machine-specific, regenerate with `echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties`
  on any new machine).

### Release signing
- Keystore: `android/keystore/release.keystore` (alias `jobsmatchnow`), gitignored.
- Credentials: `android/keystore/release-keystore-creds.txt`, gitignored.
- Gradle reads both via `android/key.properties` (gitignored), wired into
  `android/app/build.gradle`'s `signingConfigs.release` block.
- **Backup exists at `E:\Jobmatch3\android-keystore-backup\`** (keystore file +
  credentials + key.properties). This is the only copy outside this machine --
  Google Play requires every future update to be signed with this exact same
  key, so losing all copies permanently locks the app out of updates under
  this listing. Back it up somewhere durable (password manager / secondary
  drive) beyond that one folder too.

### Building a release AAB
```bash
cd android
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
./gradlew bundleRelease
# output: android/app/build/outputs/bundle/release/app-release.aab
```
Verify signing if ever in doubt: `jarsigner -verify app-release.aab` should
print `jar verified.` (the accompanying self-signed/no-timestamp warnings are
normal for Android release keys, not errors).

### Play Store assets (backed up at `E:\Jobmatch3\store-assets\android\`)
- `play-dev-icon-512.png` -- 512x512 developer icon (flattened, no transparency)
- `play-header-4096x2304.png` -- developer-page header banner
- `01-landing.png` / `02-home-dashboard.png` / `03-profile-cards.png` /
  `04-discover.png` -- phone screenshots (412x915 @2x), captured live from
  jobsmatchnow.com via a scripted Playwright walkthrough (landing page -> demo
  candidate login -> home dashboard -> profile card deck -> swipe/discover).

### Play Store listing copy
- **Short description** (80 char): "Swipe-based job matching — mutual likes, real chats, zero cold applications."
- **Full description**, **promotional text** (130/140 char, already saved in
  Play Console), **privacy policy URL** (`https://jobsmatchnow.com/privacy.html`,
  live): see chat history 2026-07-25, or regenerate by asking for the drafts again.

### Remaining steps (Play Store)
1. Wait for Google to finish developer-account identity verification (their
   queue, not actionable from our side).
2. Verify contact phone number in Play Console once identity clears.
3. Fill in: content rating questionnaire, data safety form (what the app
   collects -- see privacy policy for the authoritative list), category,
   contact email.
4. Create a new release in Play Console, upload `app-release.aab`, attach the
   icon/header/screenshots, paste in the descriptions.
5. Submit for review.

## iOS

### Why there's no local build
Xcode only runs on macOS; this project is developed from Windows/WSL, so
**no iOS build can be produced or signed on this machine.** The Capacitor iOS
project exists at `ios/App/` (`App.xcodeproj`, Swift Package Manager
dependencies under `CapApp-SPM/`, no CocoaPods) and is otherwise complete and
ready to build the moment a macOS environment (a real Mac, or the CI pipeline
below) is available.

`TARGETED_DEVICE_FAMILY = "1,2"` -- the app is scoped for **both iPhone and
iPad** (a deliberate choice; iPad screenshots were produced to match). Since
this is a responsive WebView rather than an iPad-optimized layout, it's worth
spot-checking how it renders on an actual iPad once one is available.

### CI build pipeline (ready, not yet runnable)
`.github/workflows/ios-build.yml` -- manually triggered (`workflow_dispatch`)
GitHub Actions job on a hosted `macos-14` runner. Builds the web app, runs
`npx cap sync ios`, archives + exports a signed `.ipa` via `xcodebuild`, and
uploads it to App Store Connect/TestFlight via `xcrun altool`.

It needs six repo secrets that don't exist yet (documented in the workflow's
header comment):
- `APPLE_CERTIFICATE_P12_BASE64`, `APPLE_CERTIFICATE_PASSWORD` -- Distribution
  certificate, exported as `.p12` and base64-encoded
- `APPLE_PROVISIONING_PROFILE_BASE64` -- App Store provisioning profile,
  base64-encoded
- `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID`, `APPSTORE_PRIVATE_KEY` -- App Store
  Connect API key (Users and Access -> Keys in App Store Connect)

### App Store assets (backed up at `E:\Jobmatch3\store-assets\ios\`)
- `ios-appstore-icon-1024.png` -- 1024x1024, full-bleed, **no pre-applied
  rounded corners** (Apple masks it automatically; a pre-rounded icon fails
  validation) and no transparency.
- `ios-01..04-*.png` -- iPhone 6.9" screenshots (1320x2868), same 4-screen
  walkthrough as Android.
- `ipad-01..04-*.png` -- iPad 12.9" screenshots (2048x2732), same walkthrough
  rendered at the desktop/sidebar layout breakpoint.

### App Store Connect listing copy
- **Name**: JobsMatchNow · **Subtitle**: "Mutual job matching, fast"
- **Promotional text** (170 char), **keywords** (100 char, comma-separated),
  **description** (4000 char): see chat history 2026-07-25, or regenerate by
  asking for the drafts again.
- **Support/Marketing URL**: `https://jobsmatchnow.com`
- **Privacy Policy URL**: `https://jobsmatchnow.com/privacy.html` (shared with
  the Play Store listing, already live)

### Remaining steps (App Store)
1. Finish Apple Developer Program enrollment ($99/yr, identity verification).
2. In App Store Connect: create the app record (bundle ID `com.jobsmatchnow.app`).
3. Generate a Distribution certificate, an App Store provisioning profile, and
   an App Store Connect API key.
4. Add the six secrets above to this GitHub repo, then run the
   `iOS release build` workflow from the Actions tab.
5. Fill in the App Store Connect listing with the copy/assets above, submit
   the TestFlight build (or straight to review).

## Shared: privacy policy
`public/privacy.html`, deployed as a static page, live at
`https://jobsmatchnow.com/privacy.html`. Both stores' privacy policy URL
fields point here. Update this file (and redeploy via
`deploy/deploy-production.sh`) if what the app collects ever changes.
