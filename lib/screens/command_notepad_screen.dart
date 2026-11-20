import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/notepad_storage_service.dart';
import '../services/telnet_client.dart';

class CommandNotepadScreen extends StatefulWidget {
  const CommandNotepadScreen({super.key});

  @override
  State<CommandNotepadScreen> createState() => _CommandNotepadScreenState();
}

class _CommandNotepadScreenState extends State<CommandNotepadScreen> {
  final NotepadStorageService _storage = NotepadStorageService();
  List<SavedCommandNote> _notes = [];
  String _search = '';
  String _vendorFilter = 'ALL';

  // Optional direct Telnet connection for 1-Tap Apply Live
  final TextEditingController _hostCtrl = TextEditingController(text: '192.168.88.1');
  final TextEditingController _portCtrl = TextEditingController(text: '23');
  UniversalTelnetClient? _telnet;
  bool _connected = false;
  final StringBuffer _liveOutput = StringBuffer();

  static const List<String> _vendors = [
    'ALL',
    'All',
    'Huawei',
    'ZTE',
    'BDCOM',
    'VSOL',
    'C-Data',
    'MikroTik',
    'Cisco',
    'Juniper',
    'Palo Alto',
    'Arista',
    'Ruijie',
    'TP-Link',
  ];

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  @override
  void dispose() {
    _telnet?.close();
    _hostCtrl.dispose();
    _portCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadNotes() async {
    final loaded = await _storage.getNotes();
    if (mounted) {
      setState(() => _notes = loaded);
    }
  }

  Future<void> _toggleConnect() async {
    if (_connected) {
      await _telnet?.close();
      setState(() => _connected = false);
      return;
    }
    final host = _hostCtrl.text.trim();
    final port = int.tryParse(_portCtrl.text.trim()) ?? 23;
    if (host.isEmpty) return;

    final client = UniversalTelnetClient(
      host: host,
      port: port,
      onData: (data) {
        if (!mounted) return;
        setState(() => _liveOutput.write(data));
      },
      onClose: () {
        if (mounted) setState(() => _connected = false);
      },
      onError: (_) {
        if (mounted) setState(() => _connected = false);
      },
    );

    try {
      await client.connect();
      if (!mounted) return;
      setState(() {
        _telnet = client;
        _connected = true;
        _liveOutput.writeln('>>> Connected to $host:$port');
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Telnet failed: $e')));
      }
    }
  }

  Future<void> _applyScript(String title, String script) async {
    final lines = script
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty && !l.startsWith('#'))
        .toList();
    if (lines.isEmpty) return;

    if (_connected && _telnet != null) {
      setState(() => _liveOutput.writeln('\n>>> [Apply Live: $title] (${lines.length} lines)'));
      for (final line in lines) {
        _telnet!.sendString('$line\r');
        await Future.delayed(const Duration(milliseconds: 220));
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Applied "$title" to live Telnet (${lines.length} lines)')),
        );
      }
    } else {
      Clipboard.setData(ClipboardData(text: script));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Copied "$title" — Connect Telnet above for 1-Tap Apply Live')),
        );
      }
    }
  }

  void _openNoteEditor([SavedCommandNote? existing]) {
    final titleCtrl = TextEditingController(text: existing?.title ?? '');
    final catCtrl = TextEditingController(text: existing?.category ?? 'OLT / ONU');
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final cmdCtrl = TextEditingController(text: existing?.commands ?? '');
    String vendor = existing?.vendor ?? 'Huawei';
    bool pinned = existing?.pinned ?? false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModal) {
            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      existing == null ? 'New Command Note' : 'Edit Command Note',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.black),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: titleCtrl,
                      decoration: const InputDecoration(labelText: 'Title (e.g. Huawei ONU Add)', border: OutlineInputBorder(), isDense: true),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _vendors.where((v) => v != 'ALL').contains(vendor) ? vendor : 'All',
                            decoration: const InputDecoration(labelText: 'Brand', border: OutlineInputBorder(), isDense: true),
                            items: _vendors
                                .where((v) => v != 'ALL')
                                .map((v) => DropdownMenuItem(value: v, child: Text(v, style: const TextStyle(fontSize: 12))))
                                .toList(),
                            onChanged: (v) => setModal(() => vendor = v ?? 'All'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: catCtrl,
                            decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder(), isDense: true),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: descCtrl,
                      decoration: const InputDecoration(labelText: 'Short Reminder Note', border: OutlineInputBorder(), isDense: true),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: cmdCtrl,
                      maxLines: 7,
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                      decoration: const InputDecoration(
                        labelText: 'Multi-Line CLI Commands (1 per line)',
                        border: OutlineInputBorder(),
                        alignLabelWithHint: true,
                      ),
                    ),
                    CheckboxListTile(
                      value: pinned,
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Pin to Top', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      onChanged: (v) => setModal(() => pinned = v ?? false),
                    ),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          if (cmdCtrl.text.trim().isEmpty) return;
                          final updated = await _storage.upsertNote(
                            SavedCommandNote(
                              id: existing?.id ?? 'note_${DateTime.now().millisecondsSinceEpoch}',
                              title: titleCtrl.text.trim().isEmpty ? 'Saved Command' : titleCtrl.text.trim(),
                              vendor: vendor,
                              category: catCtrl.text.trim().isEmpty ? 'General' : catCtrl.text.trim(),
                              commands: cmdCtrl.text.trim(),
                              description: descCtrl.text.trim(),
                              pinned: pinned,
                              updatedAt: DateTime.now().toIso8601String(),
                            ),
                          );
                          if (mounted) {
                            setState(() => _notes = updated);
                            Navigator.pop(ctx);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.black,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: const Text('Save Command Note', style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _openQuickEditAndApply(SavedCommandNote note) {
    final editCtrl = TextEditingController(text: note.commands);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Quick Edit & Apply — ${note.title}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              const Text('Modify IP, VLAN, or ONU SN below before applying (original note stays safe).', style: TextStyle(fontSize: 11, color: Colors.black54)),
              const SizedBox(height: 10),
              TextField(
                controller: editCtrl,
                maxLines: 7,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _applyScript(note.title, editCtrl.text);
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.black, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                  icon: const Icon(Icons.play_arrow, size: 18),
                  label: Text(_connected ? 'Apply Live Now' : 'Copy & Apply'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _notes.where((n) {
      if (_vendorFilter != 'ALL' && n.vendor != _vendorFilter && n.vendor != 'All') return false;
      final q = _search.trim().toLowerCase();
      if (q.isEmpty) return true;
      return n.title.toLowerCase().contains(q) ||
          n.commands.toLowerCase().contains(q) ||
          n.vendor.toLowerCase().contains(q) ||
          n.description.toLowerCase().contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Personal Command Notepad', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.black)),
            Text('Save CLI scripts & 1-Tap Apply anytime', style: TextStyle(fontSize: 11, color: Colors.black54)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: ElevatedButton.icon(
              onPressed: () => _openNoteEditor(),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.black, foregroundColor: Colors.white),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('New Note', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Live Telnet Quick Bar for 1-Tap Apply Live
          Container(
            margin: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _connected ? Colors.green : const Color(0xFFCBD5E1)),
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _hostCtrl,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                    decoration: const InputDecoration(labelText: 'Target IP', isDense: true, border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: TextField(
                    controller: _portCtrl,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                    decoration: const InputDecoration(labelText: 'Port', isDense: true, border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 6),
                ElevatedButton(
                  onPressed: _toggleConnect,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _connected ? Colors.red.shade700 : Colors.black,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(_connected ? 'Disconnect' : 'Telnet', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),

          // Search + Brand Filter
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    onChanged: (v) => setState(() => _search = v),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search, size: 18),
                      hintText: 'Search saved commands (onu, vlan, route, bgp)...',
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                DropdownButton<String>(
                  value: _vendorFilter,
                  items: _vendors
                      .where((v) => v != 'All')
                      .map((v) => DropdownMenuItem(value: v, child: Text(v == 'ALL' ? 'All Brands' : v, style: const TextStyle(fontSize: 12))))
                      .toList(),
                  onChanged: (v) => setState(() => _vendorFilter = v ?? 'ALL'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 20),
              itemCount: filtered.length,
              itemBuilder: (context, idx) {
                final note = filtered[idx];
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: note.pinned ? Colors.black : const Color(0xFFCBD5E1), width: note.pinned ? 1.4 : 1),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (note.pinned) const Padding(padding: EdgeInsets.only(right: 6), child: Icon(Icons.push_pin, size: 14, color: Colors.black)),
                          Expanded(
                            child: Text(note.title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.black)),
                          ),
                          Text('${note.vendor} · ${note.category}', style: const TextStyle(fontFamily: 'monospace', fontSize: 10, color: Colors.black54)),
                        ],
                      ),
                      if (note.description.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(note.description, style: const TextStyle(fontSize: 11, color: Colors.black87)),
                      ],
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: SelectableText(
                          note.commands,
                          style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Colors.black, height: 1.4),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          ElevatedButton.icon(
                            onPressed: () => _applyScript(note.title, note.commands),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.black,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            ),
                            icon: const Icon(Icons.play_arrow, size: 15),
                            label: Text(_connected ? 'Apply Live' : 'Apply', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          ),
                          OutlinedButton(
                            onPressed: () => _openQuickEditAndApply(note),
                            style: OutlinedButton.styleFrom(foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
                            child: const Text('Edit & Apply', style: TextStyle(fontSize: 11)),
                          ),
                          OutlinedButton(
                            onPressed: () => _openNoteEditor(note),
                            style: OutlinedButton.styleFrom(foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
                            child: const Text('Edit', style: TextStyle(fontSize: 11)),
                          ),
                          IconButton(
                            icon: Icon(note.pinned ? Icons.push_pin : Icons.push_pin_outlined, size: 17, color: Colors.black),
                            onPressed: () async {
                              final updated = await _storage.upsertNote(note.copyWith(pinned: !note.pinned));
                              if (mounted) setState(() => _notes = updated);
                            },
                          ),
                          IconButton(
                            icon: Icon(Icons.delete_outline, size: 17, color: Colors.red.shade700),
                            onPressed: () async {
                              final updated = await _storage.deleteNote(note.id);
                              if (mounted) setState(() => _notes = updated);
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          if (_liveOutput.isNotEmpty)
            Container(
              height: 90,
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border(top: BorderSide(color: Color(0xFFCBD5E1))),
              ),
              child: SingleChildScrollView(
                child: SelectableText(
                  _liveOutput.toString(),
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Colors.black),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
