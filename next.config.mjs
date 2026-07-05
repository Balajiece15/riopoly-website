/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Serve the static marketing landing (public/index.html) at the root, and the
  // 3D studio's index.html for /color-studio. beforeFiles wins over the router;
  // the studio's own assets use absolute /color-studio/... paths (real files).
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/index.html' },
        { source: '/color-studio', destination: '/color-studio/index.html' },
        { source: '/color-studio/', destination: '/color-studio/index.html' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/color-studio/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
