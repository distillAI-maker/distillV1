import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@distill/providers', '@distill/data'],
  serverExternalPackages: ['postgres', 'unzipper'],
};
export default config;
