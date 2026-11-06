const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// Runs every minute. When a live game's next ping is due, copy the hiders'
// private positions into pings/latest, which seekers are allowed to read.
exports.pingTick = onSchedule('every 1 minutes', async () => {
  const now = Date.now();
  const games = await db.collection('games').where('status', '==', 'live').where('nextPingAt', '<=', now).get();
  for (const g of games.docs) {
    const data = g.data();
    const players = await g.ref.collection('players').where('role', '==', 'hider').get();
    const hiders = [];
    for (const p of players.docs) {
      if (p.data().status === 'tagged') continue; // tagged runners are out and no longer pinged
      const loc = await g.ref.collection('loc').doc(p.id).get();
      if (loc.exists) hiders.push({ lat: loc.data().lat, lng: loc.data().lng });
    }
    await g.ref.collection('pings').doc('latest').set({ t: now, hiders });
    if (data.pingSec > 0) await g.ref.update({ nextPingAt: now + data.pingSec * 1000 });
  }
});
