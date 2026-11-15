import { defineConfig, devices } from '@playwright/test';

/**
 * Plays the game in the two mobile browser engines it ships on: Chromium (the Android
 * WebView and Chrome) and WebKit (Safari and the iOS WebView), with phone screens and
 * touch input.
 *
 * This is the engine with a phone's screen, not the phone: it catches layout and engine
 * differences, not real-device performance, touch latency or notch behaviour. There is
 * no iOS simulator outside macOS; the Android build is checked on the emulator by hand.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
    // The smallest screen the menus are laid out for.
    { name: 'android-small', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 640 } } },
    { name: 'android-landscape', use: { ...devices['Pixel 7 landscape'] } },
    { name: 'ios-webkit', use: { ...devices['iPhone 14'] } },
    { name: 'ios-webkit-landscape', use: { ...devices['iPhone 14 landscape'] } },
  ],
  // The dev build: it exposes the world-to-screen mapping the tests tap through.
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
