import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the home screen icons from public/icon.svg (run: npm run icons).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#141012' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#141012' } }
  },
  images: ['public/icon.svg']
});
