import MakerAppImage from '@reforged/maker-appimage';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

const APP_BUNDLE_ID = 'com.noto.app';

// Signing is opt-in and driven entirely by the environment, so an ordinary
// development build needs no certificates and no configuration. The release
// workflow sets NOTO_SIGN=true and provides the credentials as secrets; see
// docs/deployment/code-signing.md.
const signingRequested = process.env.NOTO_SIGN === 'true';

const appleIdentity = process.env.APPLE_IDENTITY;
const appleId = process.env.APPLE_ID;
const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
const appleTeamId = process.env.APPLE_TEAM_ID;

const windowsCertificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const windowsCertificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;

const signMacOS = signingRequested && Boolean(appleIdentity);
const notarizeMacOS = signMacOS && Boolean(appleId && applePassword && appleTeamId);
const signWindows =
  signingRequested && Boolean(windowsCertificateFile && windowsCertificatePassword);

const config: ForgeConfig = {
  // Defaults to ./out. Overridable because Windows will sometimes hold a lock on
  // a previously packaged binary — Defender scanning a 200 MB executable is the
  // usual culprit — and Forge cannot start until it has cleared its output
  // directory. Building into a fresh one is a way past that without waiting on
  // a handle nobody owns. `noto-release.ps1` sets this only when it has to.
  outDir: process.env.NOTO_FORGE_OUT || undefined,

  packagerConfig: {
    // Set explicitly: the workspace package is named `@noto/desktop`, and a
    // scoped name is not a valid application or executable name.
    name: 'Noto',
    executableName: 'noto',
    appBundleId: APP_BUNDLE_ID,
    asar: true,

    // Gatekeeper rejects an unsigned application, and notarization is what
    // stops macOS warning the user on first launch.
    ...(signMacOS
      ? {
          osxSign: {
            identity: appleIdentity,
            optionsForFile: () => ({
              // The renderer runs a JIT-compiling JavaScript engine, so the
              // hardened runtime needs these entitlements to allow it.
              entitlements: 'packaging/entitlements.mac.plist',
              hardenedRuntime: true,
            }),
          },
        }
      : {}),

    ...(notarizeMacOS
      ? {
          osxNotarize: {
            appleId: appleId as string,
            appleIdPassword: applePassword as string,
            teamId: appleTeamId as string,
          },
        }
      : {}),

    // Authenticode signing. Without it, SmartScreen warns on every download
    // until the installer has built up reputation.
    ...(signWindows
      ? {
          windowsSign: {
            certificateFile: windowsCertificateFile,
            certificatePassword: windowsCertificatePassword,
            timestampServer: 'http://timestamp.digicert.com',
          },
        }
      : {}),
  },

  rebuildConfig: {},

  // Each maker declares the platforms it supports, so Forge silently skips the
  // ones that do not apply to the runner it is executing on.
  makers: [
    // Windows: Squirrel produces both the installer and the update feed that
    // Electron's autoUpdater consumes.
    new MakerSquirrel({ name: 'noto', setupExe: 'Noto-Setup.exe' }),

    // macOS: the DMG is what users download; the ZIP is what Squirrel.Mac
    // needs in order to apply an update, so both are published.
    new MakerDMG({ name: 'Noto', overwrite: true }, ['darwin']),
    new MakerZIP({}, ['darwin']),

    // Linux: AppImage is the primary, distribution-independent download; deb
    // and rpm exist for users who would rather install through a package
    // manager, which is also how Linux updates are delivered.
    // `bin` must match `executableName` above. Left unset, the Linux makers
    // look for a binary named after the package — `@noto/desktop` — which does
    // not exist, and the build fails after packaging has already succeeded.
    new MakerAppImage({
      options: { name: 'noto', productName: 'Noto', bin: 'noto', categories: ['Utility'] },
    }),
    new MakerDeb({
      options: { name: 'noto', productName: 'Noto', bin: 'noto', categories: ['Utility'] },
    }),
    new MakerRpm({
      options: { name: 'noto', productName: 'Noto', bin: 'noto', categories: ['Utility'] },
    }),
  ],

  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/main.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/main/preload.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),
  ],
};

export default config;
