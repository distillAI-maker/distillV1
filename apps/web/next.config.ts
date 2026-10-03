import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@distill/catalog', '@distill/engine'],
  serverExternalPackages: ['postgres', 'unzipper'],
  // The dev overlay takes a Tab stop and covers the screens in screenshots.
  devIndicators: false,
};
export default config;
