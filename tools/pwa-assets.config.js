// Settings for `npm run icons` (@vite-pwa/assets-generator, fetched by npx; nothing is
// installed). Renders the PNG icons and favicon next to src/icons/icon.svg; the maskable
// and Apple icons get the game's dark background instead of the generator's white.
export default {
  images: ['src/icons/icon.svg'],
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [512], padding: 0.05, resizeOptions: { background: '#070a16' } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#070a16' } },
  },
};
