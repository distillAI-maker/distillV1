import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@distill/catalog', '@distill/engine'],
  serverExternalPackages: ['postgres', 'unzipper'],
  // The dev overlay takes a Tab stop and covers the screens in screenshots.
  devIndicators: false,
  // The engine and catalog packages import with `.js` extensions that point at `.ts` files
  // (NodeNext). Turbopack cannot resolve those, webpack can with this map, so the app runs on
  // webpack (`next dev --webpack`, `next build --webpack`). OPEN_QUESTIONS: ENGINE_IMPORT_EXTENSIONS.
  experimental: { extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
};
export default config;
