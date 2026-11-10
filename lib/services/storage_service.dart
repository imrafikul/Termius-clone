import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/pptp_profile.dart';

class StorageService {
  static const String _keyProfiles = 'saved_pptp_profiles';
  static const String _keyActiveProfileId = 'active_pptp_profile_id';

  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  /// Loads all saved ISP PPTP profiles. Seeds default samples if empty.
  Future<List<PPTPProfile>> getProfiles() async {
    final prefs = await SharedPreferences.getInstance();
    final List<String>? jsonList = prefs.getStringList(_keyProfiles);

    if (jsonList == null || jsonList.isEmpty) {
      final defaultList = _getDefaultProfiles();
      await saveAllProfiles(defaultList);
      return defaultList;
    }

    try {
      return jsonList
          .map((item) => PPTPProfile.fromJson(item))
          .toList();
    } catch (e) {
      // In case of corrupt schema, return default list
      return _getDefaultProfiles();
    }
  }

  /// Persists the complete list of profiles.
  Future<bool> saveAllProfiles(List<PPTPProfile> profiles) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = profiles.map((p) => p.toJson()).toList();
    return prefs.setStringList(_keyProfiles, jsonList);
  }

  /// Adds or updates a single profile.
  Future<List<PPTPProfile>> upsertProfile(PPTPProfile profile) async {
    final profiles = await getProfiles();
    final index = profiles.indexWhere((p) => p.id == profile.id);

    if (index >= 0) {
      profiles[index] = profile;
    } else {
      profiles.add(profile);
    }

    await saveAllProfiles(profiles);
    return profiles;
  }

  /// Deletes a profile by ID.
  Future<List<PPTPProfile>> deleteProfile(String id) async {
    final profiles = await getProfiles();
    profiles.removeWhere((p) => p.id == id);
    await saveAllProfiles(profiles);

    // If active profile was deleted, clear active pointer
    final activeId = await getActiveProfileId();
    if (activeId == id) {
      await setActiveProfileId(profiles.isNotEmpty ? profiles.first.id : null);
    }

    return profiles;
  }

  /// Gets the currently selected profile ID.
  Future<String?> getActiveProfileId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyActiveProfileId);
  }

  /// Sets the active profile ID.
  Future<bool> setActiveProfileId(String? id) async {
    final prefs = await SharedPreferences.getInstance();
    if (id == null) {
      return prefs.remove(_keyActiveProfileId);
    }
    return prefs.setString(_keyActiveProfileId, id);
  }

  /// Default production templates for ISP MikroTik routers.
  List<PPTPProfile> _getDefaultProfiles() {
    return [
      PPTPProfile(
        id: 'prof_rb4011_core',
        ispName: 'Core Datacenter · RB4011',
        host: 'vpn.isp-core.net',
        port: 1723,
        username: 'noc_admin',
        password: 'PptpSecure2026!',
        targetSubnet: '192.168.88.0/24, 10.99.0.0/16',
        routerIp: '192.168.88.1',
        sshPort: 22,
        winboxPort: 8291,
        webPort: 80,
        apiPort: 8728,
        mtu: 1400,
        mppeEnabled: true,
        createdAt: DateTime.now().subtract(const Duration(days: 30)),
      ),
      PPTPProfile(
        id: 'prof_north_tower',
        ispName: 'North Tower POP · CCR2004',
        host: '103.45.89.12',
        port: 1723,
        username: 'field_tech',
        password: 'FieldAccess#2026',
        targetSubnet: '10.10.40.0/24',
        routerIp: '10.10.40.1',
        sshPort: 22,
        winboxPort: 8291,
        webPort: 80,
        apiPort: 8728,
        mtu: 1400,
        mppeEnabled: true,
        createdAt: DateTime.now().subtract(const Duration(days: 12)),
      ),
    ];
  }
}
