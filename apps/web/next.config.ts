import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@distill/providers', '@distill/data', '@distill/engine', '@distill/catalog', '@distill/sim'],
  devIndicators: false,
  serverExternalPackages: ['postgres', 'unzipper'],
  // Workspace packages use NodeNext .js imports pointing to TypeScript source.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};
export default config;
