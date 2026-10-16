import type { CapacitorConfig } from '@capacitor/cli';

/** Native shell for Android (and later iOS). The game itself is the same offline web build. */
const config: CapacitorConfig = {
  appId: 'com.fuseandfall.game',
  appName: 'Fuse & Fall',
  webDir: 'dist',
  android: {
    backgroundColor: '#0f1114',
  },
};

export default config;
