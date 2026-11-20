import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class SavedCommandNote {
  final String id;
  final String title;
  final String vendor;
  final String category;
  final String commands;
  final String description;
  final bool pinned;
  final String updatedAt;

  const SavedCommandNote({
    required this.id,
    required this.title,
    required this.vendor,
    required this.category,
    required this.commands,
    this.description = '',
    this.pinned = false,
    required this.updatedAt,
  });

  SavedCommandNote copyWith({
    String? title,
    String? vendor,
    String? category,
    String? commands,
    String? description,
    bool? pinned,
    String? updatedAt,
  }) {
    return SavedCommandNote(
      id: id,
      title: title ?? this.title,
      vendor: vendor ?? this.vendor,
      category: category ?? this.category,
      commands: commands ?? this.commands,
      description: description ?? this.description,
      pinned: pinned ?? this.pinned,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'vendor': vendor,
        'category': category,
        'commands': commands,
        'description': description,
        'pinned': pinned,
        'updatedAt': updatedAt,
      };

  factory SavedCommandNote.fromJson(Map<String, dynamic> json) {
    return SavedCommandNote(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? 'Saved Command').toString(),
      vendor: (json['vendor'] ?? 'All').toString(),
      category: (json['category'] ?? 'General').toString(),
      commands: (json['commands'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      pinned: json['pinned'] == true,
      updatedAt: (json['updatedAt'] ?? DateTime.now().toIso8601String()).toString(),
    );
  }
}

class NotepadStorageService {
  static const String _notesKey = 'universal_webui_command_notes_v1';

  static List<SavedCommandNote> defaultNotes() {
    final now = DateTime.now().toIso8601String();
    return [
      SavedCommandNote(
        id: 'note_huawei_gpon_add',
        title: 'Huawei GPON ONU Add + Service-Port',
        vendor: 'Huawei',
        category: 'OLT / ONU',
        pinned: true,
        description: 'Register GPON ONU by SN on port 0/1/0 and attach VLAN 200 service-port.',
        commands: 'enable\nconfig\ninterface gpon 0/1\nont add 0 5 sn-auth 48575443AABB1122 omci ont-lineprofile-id 10 ont-srvprofile-id 10 desc "Client-FTTH"\nquit\nservice-port vlan 200 gpon 0/1/0 ont 5 gemport 1 multi-service user-vlan 200 tag-transform translate\nsave',
        updatedAt: now,
      ),
      SavedCommandNote(
        id: 'note_mikrotik_wan_nat',
        title: 'MikroTik Default Route + Masquerade NAT',
        vendor: 'MikroTik',
        category: 'Routing / NAT',
        pinned: true,
        description: 'Add default gateway and WAN masquerade rule on RouterOS v6/v7.',
        commands: '/ip route add dst-address=0.0.0.0/0 gateway=103.45.89.1 comment="Primary-ISP"\n/ip firewall nat add chain=srcnat out-interface=ether1-WAN action=masquerade comment="WAN-NAT"',
        updatedAt: now,
      ),
      SavedCommandNote(
        id: 'note_bdcom_epon_bind',
        title: 'BDCOM EPON ONU Bind + PVID VLAN',
        vendor: 'BDCOM',
        category: 'OLT / ONU',
        pinned: false,
        description: 'Bind EPON ONU MAC on epon0/1:3 and set UNI port 1 VLAN 200.',
        commands: 'enable\nconfig\ninterface epon0/1\nepon bind-onu mac e067.b311.a401 3\nexit\ninterface epon0/1:3\nepon onu port 1 ctc vlan mode tag 200\nexit\nwrite all',
        updatedAt: now,
      ),
      SavedCommandNote(
        id: 'note_zte_uncfg_optics',
        title: 'ZTE C320/C300 Uncfg ONU & Optical Rx',
        vendor: 'ZTE',
        category: 'Diagnostics',
        pinned: false,
        description: 'List unconfigured GPON ONUs and inspect PON optical attenuation.',
        commands: 'show gpon onu uncfg\nshow pon power attenuation gpon-onu_1/2/1:1',
        updatedAt: now,
      ),
      SavedCommandNote(
        id: 'note_cisco_trunk_lacp',
        title: 'Cisco / Arista 10G Trunk + LACP',
        vendor: 'Cisco',
        category: 'Switch / L2',
        pinned: false,
        description: 'Configure 10G uplink trunk with VLANs 100,200,300 and LACP Port-Channel 1.',
        commands: 'configure terminal\ninterface GigabitEthernet0/1\nswitchport mode trunk\nswitchport trunk allowed vlan 100,200,300\nchannel-group 1 mode active\nno shutdown\nend\nwrite memory',
        updatedAt: now,
      ),
    ];
  }

  Future<List<SavedCommandNote>> getNotes() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_notesKey);
    if (raw == null || raw.isEmpty) {
      final defaults = defaultNotes();
      await saveNotes(defaults);
      return defaults;
    }
    try {
      final list = (jsonDecode(raw) as List<dynamic>)
          .map((e) => SavedCommandNote.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      return _sort(list);
    } catch (_) {
      return defaultNotes();
    }
  }

  Future<void> saveNotes(List<SavedCommandNote> notes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _notesKey,
      jsonEncode(_sort(notes).map((e) => e.toJson()).toList()),
    );
  }

  Future<List<SavedCommandNote>> upsertNote(SavedCommandNote note) async {
    final list = await getNotes();
    final idx = list.indexWhere((n) => n.id == note.id);
    if (idx >= 0) {
      list[idx] = note;
    } else {
      list.insert(0, note);
    }
    final sorted = _sort(list);
    await saveNotes(sorted);
    return sorted;
  }

  Future<List<SavedCommandNote>> deleteNote(String id) async {
    final list = await getNotes();
    list.removeWhere((n) => n.id == id);
    await saveNotes(list);
    return list;
  }

  List<SavedCommandNote> _sort(List<SavedCommandNote> items) {
    final copy = List<SavedCommandNote>.from(items);
    copy.sort((a, b) {
      if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.compareTo(a.updatedAt);
    });
    return copy;
  }
}
