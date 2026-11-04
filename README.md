# Manhunt Fitness – Phase 1 starter (Flutter)

## Setup
1. Install Flutter (flutter.dev), then in this folder run: `flutter create . --platforms=ios,android` (adds the ios/ and android/ folders), then `flutter pub get`.
2. Google Maps key (Google Cloud Console, enable Maps SDK for Android + iOS):
   - Android: in `android/app/src/main/AndroidManifest.xml` add inside <application>:
     `<meta-data android:name="com.google.android.geo.API_KEY" android:value="YOUR_KEY"/>`
   - iOS: in `ios/Runner/AppDelegate.swift` add `GMSServices.provideAPIKey("YOUR_KEY")` and `import GoogleMaps`.
3. Location permissions:
   - Android manifest: ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION (later ACCESS_BACKGROUND_LOCATION).
   - iOS Info.plist: NSLocationWhenInUseUsageDescription (later NSLocationAlwaysAndWhenInUseUsageDescription).
4. `flutter run`

## What works now
Theme, home screen, live map with the shrinking circle, seeker ping countdown (local simulation), fitness screen with timer, Run/Walk/Ride and estimated calories.

## Next (in order)
1. Firebase/Supabase: auth, lobbies, roles.
2. Server-side clock and pings (the seeker must never receive the hider position between pings).
3. Zone editor (custom red/hide zones), then Google-Maps smart zones.
4. HealthKit / Health Connect for calories, SpO2, heart rate, altitude.
5. Background location, push notifications, anti-cheat.
