const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // next-pwa + Next 15 иногда даёт ENOENT pages-manifest при сборке; при сбое: disable: true
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === '1',
});

module.exports = withPWA({
  reactStrictMode: true,
});
