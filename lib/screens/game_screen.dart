import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import '../logic/game_engine.dart';
import '../theme.dart';

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});
  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  LatLng? me;
  StreamSubscription<Position>? _sub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<GameEngine>().start());
    _track();
  }

  Future<void> _track() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;
    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 3),
    ).listen((p) {
      if (!mounted) return;
      setState(() => me = LatLng(p.latitude, p.longitude));
      final g = context.read<GameEngine>();
      if (g.role == Role.hider) g.hiderPosition = me; // TODO: send to server instead
    });
  }

  String _mmss(int s) => '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';

  Widget _panel(Widget child) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: C.card.withOpacity(0.92), borderRadius: BorderRadius.circular(22)),
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final g = context.watch<GameEngine>();
    final seeker = g.role == Role.seeker;
    final markers = <Marker>{
      if (me != null)
        Marker(
          markerId: const MarkerId('me'),
          position: me!,
          icon: BitmapDescriptor.defaultMarkerWithHue(seeker ? BitmapDescriptor.hueOrange : BitmapDescriptor.hueYellow),
        ),
      // The seeker only ever sees the hider at the last ping
      if (seeker && g.lastPingedHider != null)
        Marker(
          markerId: const MarkerId('ping'),
          position: g.lastPingedHider!,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueYellow),
        ),
      // TODO: the hider sees the seeker live from the server
    };
    return Scaffold(
      body: Stack(children: [
        GoogleMap(
          initialCameraPosition: CameraPosition(target: g.center, zoom: 14.5),
          circles: {
            Circle(circleId: const CircleId('zone'), center: g.center, radius: g.radius, strokeColor: C.orange, strokeWidth: 4, fillColor: C.orange.withOpacity(0.05)),
          },
          markers: markers,
          myLocationEnabled: true,
          zoomControlsEnabled: false,
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              _panel(Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(seeker ? 'SEEKER' : 'HIDER', style: TextStyle(color: seeker ? C.orange : C.yellow, fontWeight: FontWeight.w900)),
                Text('Circle ${g.radius.round()} m · shrinks in ${_mmss(g.nextShrinkIn)}', style: const TextStyle(fontWeight: FontWeight.w700)),
              ])),
              const Spacer(),
              if (seeker) _panel(Text('NEXT PING IN ${_mmss(g.pingIn)}', style: const TextStyle(color: C.yellow, fontWeight: FontWeight.w800, letterSpacing: 1))),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: () => g.start(as: seeker ? Role.hider : Role.seeker),
                child: Text(seeker ? 'Switch to hider (test)' : 'Switch to seeker (test)'),
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
