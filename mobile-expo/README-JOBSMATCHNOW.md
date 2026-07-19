# JobsMatchNow Expo preview

This Expo SDK 54 project is a fast physical-device preview shell for the responsive JobsMatchNow application. It opens the live application in a branded native WebView so the same MVP can be tested on iOS and Android through Expo Go.

## Test with Expo Go

From the repository root, run `npm run expo:mobile`. Install Expo Go on the phone, keep the phone and computer on the same Wi-Fi, and scan the QR shown by Expo. On Windows + WSL, use `launch-jobsmatchnow-expo.cmd` so Windows opens the required private-network ports.

If LAN discovery is blocked, run `npm run start:tunnel` here and set `EXPO_PUBLIC_APP_URL=https://jobsmatchnow.com/app/`.

## Real release builds

Expo Go is not a production release. Configure an Expo account and app-store credentials, then run `npx eas-cli@latest build --platform all --profile production`. Android produces an AAB for Google Play; iOS produces a signed build for App Store Connect/TestFlight. Store accounts, signing, privacy disclosures, screenshots, and review are still required.

The existing Capacitor Android/iOS projects remain the main native packaging implementation. This Expo project is deliberately isolated so preview tooling cannot destabilize the signed native projects.
