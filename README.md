# Manhunt Fitness (web) - setup

Stack: static site (HTML/JS) + Leaflet/OpenStreetMap + Firebase (Auth, Firestore, Hosting, one Cloud Function).
No build step. Needs the Firebase Blaze (pay-as-you-go) plan because of the scheduled function; usage at this scale is normally free.

1. Install Node.js 20, then: `npm i -g firebase-tools` and `firebase login`.
2. Create a project at console.firebase.google.com. Enable: Authentication > Anonymous, Firestore Database (production mode), and upgrade to Blaze.
3. Project settings > Your apps > Web app. Copy the config into `public/config.js`.
4. In this folder: `firebase use --add` (pick your project), then `cd functions && npm install && cd ..`.
5. Deploy everything: `firebase deploy`. You get a https URL (needed for GPS to work).
6. Open the URL on two phones. One creates a game and shares the code, the other joins. The host taps "Make seeker", then Start.

How the rules are enforced (see firestore.rules): hider positions are private; only the server function copies them to the pings document at each ping time (checked every minute, so pings can drift by up to 60 s). Seekers publish live positions that hiders can see.

Not built yet: custom red/hide zones, Google-Maps smart zones, tagging and win logic, wearable data, results screen. Tell me which to build next.
