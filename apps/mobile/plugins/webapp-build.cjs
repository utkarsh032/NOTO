/**
 * The built Noto interface, shared by the Android and iOS copy plugins.
 *
 * Both platforms package the same `@noto/mobile-webview` output; only where it
 * goes inside the native project differs.
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Locates the built interface.
 *
 * Resolved through the module system rather than as a relative path, so this
 * keeps working if either package moves. `@noto/mobile-webview` is a declared
 * dependency of `@noto/mobile` precisely so that this resolution is guaranteed
 * — the application genuinely cannot be built without it.
 */
function interfaceBuildDirectory() {
  const manifest = require.resolve('@noto/mobile-webview/package.json');
  return path.join(path.dirname(manifest), 'dist');
}

/**
 * Replaces `to` with a copy of the built interface.
 *
 * Failing when there is no build is deliberate. Carrying on would produce an
 * application that installs, launches, and shows nothing but a blank screen —
 * and it would say so only on a device, long after the build went green.
 */
function copyInterfaceBuild(to, pluginName) {
  const from = interfaceBuildDirectory();

  if (!fs.existsSync(path.join(from, 'index.html'))) {
    throw new Error(
      `${pluginName} found no interface at ${from}. ` +
        'Build it first: pnpm build --filter=@noto/mobile-webview...',
    );
  }

  // Replaced rather than merged, so a file dropped from a later build does not
  // linger in the package.
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

module.exports = { copyInterfaceBuild, interfaceBuildDirectory };
