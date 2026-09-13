import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; Next compiles them in place.
  transpilePackages: [
    '@saveus/ui',
    '@saveus/common',
    '@saveus/db',
    '@saveus/agents',
    '@saveus/api',
  ],
  // Native and Node-only modules must not be bundled into the server build.
  serverExternalPackages: ['pg', 'ioredis'],
  eslint: { ignoreDuringBuilds: true },
  webpack: (webpackConfig) => {
    // The workspace packages are ESM TypeScript and import with explicit ".js"
    // specifiers, which is correct for Node but needs mapping back to source
    // for the bundler.
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
  },
};

export default config;
