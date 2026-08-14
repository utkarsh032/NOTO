import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  packagerConfig: {
    // Set explicitly: the workspace package is named `@noto/desktop`, and a
    // scoped name is not a valid application or executable name.
    name: 'Noto',
    executableName: 'noto',
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ name: 'noto', setupExe: 'Noto-Setup.exe' }),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({ options: { name: 'noto', productName: 'Noto' } }),
    new MakerRpm({ options: { name: 'noto', productName: 'Noto' } }),
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
