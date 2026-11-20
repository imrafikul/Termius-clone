import JSZip from 'jszip';
import { NativeFileItem } from '../data/nativeFiles';

export async function exportProjectZip(files: NativeFileItem[]): Promise<void> {
  const zip = new JSZip();

  // Add all project source files to their exact directory structure
  for (const file of files) {
    zip.file(file.path, file.content);
  }

  // Add an informative README.md explaining build steps
  const readmeContent = `# Universal WebUI for Network Engineer - Android & Flutter Project

Production-grade Multi-Vendor Network Management & Android App built for ISP and Network Engineers.

## Architecture
- **Target Platform:** Android 12, 13, 14, 15+ (User-space PPTP via \`VpnService\` TUN descriptor)
- **Strict Split Tunneling:** Routes ONLY remote private subnets (e.g. \`192.168.88.0/24\`, \`10.0.0.0/8\`). Default route \`0.0.0.0/0\` is strictly forbidden to preserve fast device cellular/Wi-Fi internet.
- **Embedded MikroTik Terminal:** Built-in SSH client powered by \`dartssh2\` and \`xterm\` with ANSI coloring.
- **Diagnostics:** Multi-port socket scanner (8291 Winbox, 22 SSH, 80/443 WebFig, 8728 API) and Ping latency tool.

## Project Structure
\`\`\`
pptp_solution/
├── pubspec.yaml
├── android/
│   └── app/
│       └── src/
│           └── main/
│               ├── AndroidManifest.xml
│               └── kotlin/com/pptpsolution/app/
│                   ├── MainActivity.kt
│                   └── PPTPVpnService.kt
└── lib/
    ├── main.dart
    ├── models/
    │   └── pptp_profile.dart
    ├── services/
    │   ├── storage_service.dart
    │   └── vpn_service.dart
    └── screens/
        ├── dashboard_screen.dart
        ├── terminal_screen.dart
        └── diagnostics_screen.dart
\`\`\`

## Getting Started
1. Extract this repository.
2. Ensure Flutter SDK >= 3.16.0 and Android SDK 34+ are installed.
3. Run \`flutter pub get\`
4. Run \`flutter run\` on a physical Android device or emulator.
`;

  zip.file('README.md', readmeContent);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pptp_solution_android_flutter.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
