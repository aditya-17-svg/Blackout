import 'package:flutter/material.dart';
import '../theme.dart';
import 'game_screen.dart';
import 'stats_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Good evening', style: TextStyle(color: C.muted)),
              const SizedBox(height: 4),
              const Text.rich(
                TextSpan(children: [TextSpan(text: 'Ready to '), TextSpan(text: 'hunt?', style: TextStyle(color: C.yellow))]),
                style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: C.card, borderRadius: BorderRadius.circular(22), border: Border.all(color: C.orange)),
                child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('LOBBY · 4 PLAYERS', style: TextStyle(color: C.orange, fontWeight: FontWeight.w800, fontSize: 12)),
                  SizedBox(height: 8),
                  Text('Sector 18 Showdown', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                  Text('45 min · Pings every 5 min', style: TextStyle(color: C.muted)),
                ]),
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GameScreen())),
                child: const Text('Create new game'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StatsScreen())),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  shape: const StadiumBorder(),
                  side: const BorderSide(color: C.yellow, width: 2),
                  foregroundColor: C.yellow,
                ),
                child: const Text('Fitness stats', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              ),
            ]),
          ),
        ),
      );
}
