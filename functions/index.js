const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// Runs every minute with sub-cycle checks every 10 seconds to eliminate ping lag
exports.pingTick = onSchedule('every 1 minutes', async () => {
  const checkAndPing = async () => {
    const now = Date.now();
    const games = await db.collection('games').where('status', '==', 'live').where('nextPingAt', '<=', now).get();
    for (const g of games.docs) {
      const data = g.data();
      const players = await g.ref.collection('players').where('role', '==', 'hider').get();
      const hiders = [];
      for (const p of players.docs) {
        if (p.data().status === 'tagged') continue;
        const loc = await g.ref.collection('loc').doc(p.id).get();
        if (loc.exists) hiders.push({ lat: loc.data().lat, lng: loc.data().lng });
      }
      await g.ref.collection('pings').doc('latest').set({ t: now, hiders });
      if (data.pingSec > 0) {
        await g.ref.update({ nextPingAt: now + data.pingSec * 1000 });
      }
    }
  };

  // Run immediately, then 5 more cycles every 10 seconds within the scheduled minute
  await checkAndPing();
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    await checkAndPing();
  }
});
