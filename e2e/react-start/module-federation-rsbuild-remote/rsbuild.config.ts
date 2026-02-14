import { defineConfig } from '@rsbuild/core'
import { createRequire } from 'node:module'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'

const require = createRequire(import.meta.url)
const remotePort = Number(process.env.REMOTE_PORT || 3001)
const remoteOrigin = `http://localhost:${remotePort}`
const shared = {
  react: {
    singleton: true,
    requiredVersion: false,
  },
  'react-dom': {
    singleton: true,
    requiredVersion: false,
  },
}

const createFederationConfig = () => ({
  name: 'mf_remote',
  filename: 'remoteEntry.js',
  exposes: {
    './message': './src/message.tsx',
    './routes': './src/routes.tsx',
    './server-data': './src/server-data.ts',
  },
  runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')],
  shared,
})

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation(createFederationConfig(), {
      target: 'node',
      environment: 'ssr',
    }),
    pluginModuleFederation(createFederationConfig(), {
      environment: 'web',
    }),
  ],
  environments: {
    web: {
      output: {
        assetPrefix: `${remoteOrigin}/`,
      },
    },
    ssr: {
      source: {
        entry: {},
      },
      output: {
        assetPrefix: 'auto',
        cleanDistPath: false,
        chunkLoadingGlobal: 'chunk_mf_remote_ssr',
        library: {
          type: 'commonjs-module',
        },
        distPath: {
          root: 'ssr',
        },
      },
      tools: {
        rspack: {
          target: 'async-node',
          output: {
            chunkFormat: 'commonjs',
            chunkLoading: 'async-node',
            chunkLoadingGlobal: 'chunk_mf_remote_ssr',
            library: {
              type: 'commonjs-module',
            },
          },
        },
      },
    },
  },
})
