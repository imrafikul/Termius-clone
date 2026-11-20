import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'models/pptp_profile.dart';
import 'screens/device_webui_screen.dart';
import 'screens/terminal_screen.dart';
import 'screens/command_notepad_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/diagnostics_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.white,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const UniversalNetworkWebUiApp());
}

class UniversalNetworkWebUiApp extends StatelessWidget {
  const UniversalNetworkWebUiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Universal WebUI for Network Engineer',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.light,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: Colors.white,
        primaryColor: Colors.black,
        colorScheme: const ColorScheme.light(
          primary: Colors.black,
          secondary: Color(0xFF0F172A),
          surface: Colors.white,
          error: Color(0xFFDC2626),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          elevation: 0,
          iconTheme: IconThemeData(color: Colors.black),
          titleTextStyle: TextStyle(
            color: Colors.black,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        fontFamily: 'Roboto',
      ),
      home: const UniversalAppShell(),
    );
  }
}

class UniversalAppShell extends StatefulWidget {
  const UniversalAppShell({super.key});

  @override
  State<UniversalAppShell> createState() => _UniversalAppShellState();
}

class _UniversalAppShellState extends State<UniversalAppShell> {
  int _tabIndex = 0;

  late final PPTPProfile _defaultProfile = PPTPProfile(
    id: 'default_noc',
    ispName: 'Core Router / OLT',
    host: '192.168.88.1',
    port: 1723,
    username: 'admin',
    password: '',
    targetSubnet: '192.168.88.0/24',
    routerIp: '192.168.88.1',
    sshPort: 22,
    winboxPort: 8291,
    webPort: 80,
    apiPort: 8728,
    mtu: 1400,
    mppeEnabled: true,
    createdAt: DateTime.now(),
  );

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      DeviceWebUiScreen(
        onSaveToNotepad: (_, __, ___) {
          setState(() => _tabIndex = 2);
        },
      ),
      TerminalScreen(
        profile: _defaultProfile,
        initialProtocol: TerminalProtocol.telnet,
      ),
      const CommandNotepadScreen(),
      const DashboardScreen(),
      DiagnosticsScreen(profile: _defaultProfile),
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      body: IndexedStack(
        index: _tabIndex,
        children: pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFE2E8F0),
        onDestinationSelected: (idx) => setState(() => _tabIndex = idx),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.public_outlined, color: Colors.black87),
            selectedIcon: Icon(Icons.public, color: Colors.black),
            label: 'WebUI',
          ),
          NavigationDestination(
            icon: Icon(Icons.terminal_outlined, color: Colors.black87),
            selectedIcon: Icon(Icons.terminal, color: Colors.black),
            label: 'Telnet/SSH',
          ),
          NavigationDestination(
            icon: Icon(Icons.description_outlined, color: Colors.black87),
            selectedIcon: Icon(Icons.description, color: Colors.black),
            label: 'Notepad',
          ),
          NavigationDestination(
            icon: Icon(Icons.vpn_lock_outlined, color: Colors.black87),
            selectedIcon: Icon(Icons.vpn_lock, color: Colors.black),
            label: 'VPN',
          ),
          NavigationDestination(
            icon: Icon(Icons.network_check_outlined, color: Colors.black87),
            selectedIcon: Icon(Icons.network_check, color: Colors.black),
            label: 'Ping/Scan',
          ),
        ],
      ),
    );
  }
}
