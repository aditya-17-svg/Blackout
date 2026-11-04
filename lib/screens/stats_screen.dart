import 'dart:async';
import 'package:flutter/material.dart';
import '../logic/activity.dart';
import '../theme.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key});
  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  Mode mode = Mode.run;
  Duration t = Duration.zero;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => t += const Duration(seconds: 1)));
  }

  Widget _stat(String v, String l, [Color c = C.yellow]) => Expanded(
        child: Container(
          margin: const EdgeInsets.all(6),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: C.card, borderRadius: BorderRadius.circular(18)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(v, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c)),
            Text(l, style: const TextStyle(fontSize: 11, color: C.muted, letterSpacing: 1)),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final kcal = estimateKcal(mode, 70, t).round(); // TODO: real data from HealthKit / Health Connect
    return Scaffold(
      appBar: AppBar(backgroundColor: C.bg, title: const Text('Live activity')),
      body: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(fmt(t), style: const TextStyle(fontSize: 64, fontWeight: FontWeight.w900, color: C.yellow)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [
            for (final m in Mode.values)
              ChoiceChip(label: Text(m.name.toUpperCase()), selected: mode == m, selectedColor: C.orange, onSelected: (_) => setState(() => mode = m)),
          ]),
          const SizedBox(height: 14),
          Row(children: [_stat('$kcal', 'KCAL', C.orange), _stat('--', 'OXYGEN SpO2')]),
          Row(children: [_stat('--', 'MAX ALTITUDE'), _stat('--', 'PACE /KM', C.orange)]),
        ]),
      ),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
