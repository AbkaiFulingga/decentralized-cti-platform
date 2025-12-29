/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Running under PM2 in a repo subfolder can confuse Next's root inference
  // when multiple lockfiles exist on the host.
  outputFileTracingRoot: __dirname,

  // Dev server accessed via LAN IP/host can trigger cross-origin warnings for /_next/*
  // in newer Next.js versions.
  allowedDevOrigins: [
    'http://192.168.1.11:3000',
    'http://localhost:3000'
  ],
  
  // Enable Web Crypto API in development
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  
  // Suppress hydration warnings
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
