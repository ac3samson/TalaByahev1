const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'shared');
const API_TARGET = process.env.TALABYAHE_API_URL || 'http://127.0.0.1:43124';

const config = getDefaultConfig(projectRoot);

// Watch ONLY shared data (avoid scanning the whole monorepo)
config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  '@shared': sharedRoot,
};

// Proxy /api to the TalaByahe backend so phones on the Expo tunnel can reach Postgres.
config.server = {
  enhanceMiddleware: (middleware) => {
    const apiProxy = createProxyMiddleware({
      target: API_TARGET,
      changeOrigin: true,
      logLevel: 'warn',
    });

    return (req, res, next) => {
      if (req.url?.startsWith('/api')) {
        return apiProxy(req, res, next);
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
