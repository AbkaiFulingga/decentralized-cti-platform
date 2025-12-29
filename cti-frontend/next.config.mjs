/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,

  // Prevent Next from inferring an unrelated workspace root when multiple lockfiles exist.
  outputFileTracingRoot: process.cwd(),

  // Allow dev server access via LAN host without noisy cross-origin warnings.
  allowedDevOrigins: [
    'http://192.168.1.11:3000',
    'http://localhost:3000'
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
        ],
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
