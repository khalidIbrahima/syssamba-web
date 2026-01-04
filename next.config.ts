import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Désactiver complètement les source maps pour éviter les erreurs
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https' as const,
        hostname: 'images.clerk.dev',
      },
      {
        protocol: 'https' as const,
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https' as const,
        hostname: 'images.unsplash.com',
      },
    ],
  },
  turbopack: {}, // Configuration Turbopack vide pour éviter les avertissements

  // Optimisations mémoire
  experimental: {
    // Réduire l'usage mémoire du cache webpack
    webpackMemoryOptimizations: true,
    // Désactiver le cache handler personnalisé pour Netlify
    // incrementalCacheHandlerPath: require.resolve('./cache-handler.js'),
  },

  // Optimisations de build
  webpack: (config: any, { dev, isServer, webpack }: { dev: boolean, isServer: boolean, webpack: any }) => {
    // Optimisations générales pour réduire l'usage mémoire
    config.optimization = {
      ...config.optimization,
      // Réduire le nombre de chunks simultanés
      splitChunks: {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
        },
      },
    };

    // Optimisations spécifiques pour réduire l'usage mémoire
    if (dev) {
      // Désactiver certaines optimisations coûteuses en mémoire en dev
      config.optimization.concatenateModules = false;
      config.optimization.flagIncludedChunks = false;

      // Réduire la verbosité du webpack
      config.stats = 'errors-only';

      // Limiter le nombre de workers
      config.parallelism = 2;
    }

    // Configuration spécifique pour le développement
    if (dev && !isServer) {
      // Désactiver complètement les source maps en développement pour éviter les erreurs
      config.devtool = false;

      // Configuration complète pour ignorer tous les avertissements liés aux source maps
      config.ignoreWarnings = [
        // Ignorer tous les avertissements de node_modules
        { module: /node_modules/ },
        // Ignorer tous les fichiers .map
        { file: /\.map$/ },
        // Ignorer spécifiquement les erreurs de source map Supabase
        { module: /@supabase/ },
        // Ignorer toutes les erreurs de source map
        (warning: any) => warning.message && (
          warning.message.includes('sourceMapURL could not be parsed') ||
          warning.message.includes('Invalid source map') ||
          warning.message.includes('Only conformant source maps') ||
          warning.message.includes('source map')
        ),
        // Ignorer les avertissements de performance de webpack
        (warning: any) => warning.name === 'ModuleDependencyWarning',
        // Ignorer les avertissements de taille de chunk
        (warning: any) => warning.name === 'ChunkSizeWarning'
      ];

      // Supprimer complètement les source maps des règles de module
      config.module.rules = config.module.rules.filter((rule: any) => {
        if (rule.test && rule.test.toString().includes('.map')) {
          return false;
        }
        return true;
      });

      // Plugin pour supprimer les avertissements de source map
      config.plugins.push(
        new webpack.DefinePlugin({
          __SOURCE_MAP_ENABLED__: JSON.stringify(false)
        }),
        // Plugin personnalisé pour supprimer les erreurs de source map
        {
          apply: (compiler: any) => {
            compiler.hooks.done.tap('SuppressSourceMapWarnings', (stats: any) => {
              if (stats.compilation.warnings) {
                stats.compilation.warnings = stats.compilation.warnings.filter((warning: any) => {
                  const message = warning.message || warning;
                  return !(
                    message.includes('sourceMapURL could not be parsed') ||
                    message.includes('Invalid source map') ||
                    message.includes('Only conformant source maps') ||
                    message.includes('source map') ||
                    message.includes('node_modules') ||
                    message.includes('.map')
                  );
                });
              }
            });
          }
        }
      );
    }

    // Optimisations pour réduire l'usage mémoire en dev
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    };

    // Optimisations pour la production
    if (!dev) {
      // Désactiver les source maps en production
      config.devtool = false;

      // Optimisations supplémentaires pour les builds de production
      config.optimization.minimize = true;
      config.optimization.usedExports = true;

      // Supprimer les avertissements de source map en production aussi
      config.ignoreWarnings = config.ignoreWarnings || [];
      config.ignoreWarnings.push(
        (warning: any) => warning.message && (
          warning.message.includes('sourceMapURL could not be parsed') ||
          warning.message.includes('Invalid source map') ||
          warning.message.includes('source map')
        )
      );
    }

    return config;
  },

  // Configuration supplémentaire pour gérer la mémoire
  onDemandEntries: {
    // Durée de vie des pages en mémoire (ms)
    maxInactiveAge: 25 * 1000,
    // Nombre maximum de pages en mémoire
    pagesBufferLength: 2,
  },
}

export default withNextIntl(nextConfig)
