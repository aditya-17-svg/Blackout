import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

enum Role { hider, seeker }

/// Shrinking-circle + seeker-ping rules. Pure logic, no UI.
/// Runs locally for now; later the server should own the clock and
/// only send the hider position to seekers at each ping.
class GameEngine extends ChangeNotifier {
  LatLng center = const LatLng(28.5355, 77.3910);
  List<double> stageRadii = [900, 600, 350, 150]; // metres
  Duration stageLength = const Duration(minutes: 3);
  Duration shrinkTime = const Duration(seconds: 30); // shrink during the end of each stage
  Duration pingEvery = const Duration(minutes: 5);
  Role role = Role.hider;

  int elapsed = 0; // seconds
  LatLng? lastPingedHider; // all the seeker ever sees
  int pingIn = 300;
  bool running = false;
  Timer? _t;

  /// Hider's real position. In production this stays on the server.
  LatLng? hiderPosition;

  double get radius {
    final len = stageLength.inSeconds;
    final i = (elapsed ~/ len).clamp(0, stageRadii.length - 1);
    final next = (i + 1).clamp(0, stageRadii.length - 1);
    final into = elapsed - i * len;
    final start = len - shrinkTime.inSeconds;
    if (into <= start || i == next) return stageRadii[i];
    final f = (into - start) / shrinkTime.inSeconds;
    return stageRadii[i] + (stageRadii[next] - stageRadii[i]) * f.clamp(0, 1);
  }

  int get nextShrinkIn => stageLength.inSeconds - (elapsed % stageLength.inSeconds);

  void start({Role as = Role.hider}) {
    role = as;
    elapsed = 0;
    pingIn = pingEvery.inSeconds;
    lastPingedHider = null;
    running = true;
    _t?.cancel();
    _t = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    notifyListeners();
  }

  void _tick() {
    elapsed++;
    pingIn--;
    if (pingIn <= 0) {
      lastPingedHider = hiderPosition; // seeker learns the hider position only now
      pingIn = pingEvery.inSeconds;
    }
    notifyListeners();
  }

  void stop() {
    running = false;
    _t?.cancel();
    notifyListeners();
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }
}
