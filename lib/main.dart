
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'logic/game_engine.dart';
import 'screens/home_screen.dart';
import 'theme.dart';
 
void main() => runApp(
      ChangeNotifierProvider(create: (_) => GameEngine(), child: const ManhuntApp()),
    );
 
class ManhuntApp extends StatelessWidget {
  const ManhuntApp({super.key});
  @override
  Widget build(BuildContext context) =>
      MaterialApp(title: 'Manhunt Fitness', theme: appTheme, debugShowCheckedModeBanner: false, home: const HomeScreen());
}
 

