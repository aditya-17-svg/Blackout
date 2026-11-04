enum Mode { run, walk, ride }

/// Fallback calorie estimate (MET formula) when no wearable data is available.
/// Replace with HealthKit / Health Connect values via the `health` package.
double estimateKcal(Mode m, double weightKg, Duration d) {
  const met = {Mode.run: 9.8, Mode.walk: 3.8, Mode.ride: 7.5};
  return met[m]! * weightKg * d.inSeconds / 3600;
}

String fmt(Duration d) {
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(d.inHours)}:${p(d.inMinutes % 60)}:${p(d.inSeconds % 60)}';
}
