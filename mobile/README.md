# Expense Tracker — mobile app (Expo / React Native)

The native app for Android and iOS. It consumes the same authenticated API as
the web dashboard (`/api/data` with a Bearer token) — one backend, three skins.

## Run it on your phone (development)

1. Install **Expo Go** from the Play Store / App Store.
2. On this machine:

   ```bash
   cd mobile
   npx expo start
   ```

3. Scan the QR code with Expo Go (Android) or the Camera app (iOS).
4. In the app: open the Telegram bot → send `/app` → paste the login code.

Point the app at a different backend (e.g. localhost during development) with:

```bash
$env:EXPO_PUBLIC_API_URL = "http://192.168.x.x:3000"   # your PC's LAN IP
npx expo start
```

## Store builds (EAS)

Requires a free [expo.dev](https://expo.dev) account:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview   # installable .apk for sideloading/sharing
eas build -p android                     # .aab for the Play Store
eas build -p ios                         # App Store build (needs Apple Developer account, $99/yr)
```

`eas submit` uploads to the stores once you have developer accounts
(Play Console: one-time $25, App Store: $99/year).

## Architecture

- `App.tsx` — auth (token in AsyncStorage), data fetching + pull-to-refresh,
  Personal/Family scope, member chips, tab navigation
- `components/` — Home (hero + category/merchant bars), Transactions
  (day-grouped list with member attribution), Family (members + invite sharing),
  Login
- `lib/api.ts` — the API client; `lib/theme.ts` — the same design tokens as the
  web dashboard, light/dark via the system setting
