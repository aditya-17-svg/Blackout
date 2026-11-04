import 'package:flutter/material.dart';

class C {
  static const bg = Color(0xFF0B0B0B);
  static const card = Color(0xFF1A1A1A);
  static const orange = Color(0xFFFF7A00);
  static const yellow = Color(0xFFFFE135);
  static const muted = Color(0xFFA8A8A8);
}

final appTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  scaffoldBackgroundColor: C.bg,
  colorScheme: const ColorScheme.dark(primary: C.orange, secondary: C.yellow, surface: C.card),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: C.orange,
      foregroundColor: C.bg,
      minimumSize: const Size.fromHeight(56),
      shape: const StadiumBorder(),
      textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
    ),
  ),
);
