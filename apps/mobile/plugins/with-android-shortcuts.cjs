/**
 * A Quick Note shortcut on Noto's Android launcher icon.
 *
 * Long-pressing the icon offers "Quick Note", which opens `noto://quick-note`.
 * The link reaches the interface like any other (`src/platform/intake.ts`), so
 * the shortcut needs no code of its own — only this static declaration, which
 * Android reads from `res/xml` and the activity's `android.app.shortcuts`
 * metadata.
 *
 * iOS home-screen quick actions are not declared yet: they reach the
 * application delegate rather than arriving as a link, so they need native
 * code there, which is best written and checked on a Mac.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
} = require('expo/config-plugins');

const RESOURCE = 'noto_shortcuts';

const SHORTCUTS = [{ id: 'quick-note', label: 'Quick Note', link: 'noto://quick-note' }];

function stringName(shortcut) {
  return `noto_shortcut_${shortcut.id.replace(/-/g, '_')}`;
}

function shortcutsXml(packageName) {
  const entries = SHORTCUTS.map(
    (shortcut) => `  <shortcut
    android:shortcutId="${shortcut.id}"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/${stringName(shortcut)}">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="${shortcut.link}"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity" />
  </shortcut>`,
  );

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">',
    ...entries,
    '</shortcuts>',
    '',
  ].join('\n');
}

function withShortcutsFile(config) {
  return withDangerousMod(config, [
    'android',
    (dangerousConfig) => {
      const packageName = dangerousConfig.android?.package;
      if (!packageName)
        throw new Error('with-android-shortcuts needs android.package in app.json.');

      const directory = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, `${RESOURCE}.xml`), shortcutsXml(packageName));

      return dangerousConfig;
    },
  ]);
}

function withShortcutLabels(config) {
  return withStringsXml(config, (stringsConfig) => {
    stringsConfig.modResults = AndroidConfig.Strings.setStringItem(
      SHORTCUTS.map((shortcut) =>
        AndroidConfig.Resources.buildResourceItem({
          name: stringName(shortcut),
          value: shortcut.label,
        }),
      ),
      stringsConfig.modResults,
    );
    return stringsConfig;
  });
}

function withShortcutsMetadata(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifestConfig.modResults);
    const metadata = (activity['meta-data'] ?? []).filter(
      (entry) => entry.$['android:name'] !== 'android.app.shortcuts',
    );
    metadata.push({
      $: { 'android:name': 'android.app.shortcuts', 'android:resource': `@xml/${RESOURCE}` },
    });
    activity['meta-data'] = metadata;
    return manifestConfig;
  });
}

module.exports = function withAndroidShortcuts(config) {
  return withShortcutsMetadata(withShortcutLabels(withShortcutsFile(config)));
};
