import { defineConfig } from '@rsbuild/core'
import { createRequire } from 'node:module'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

const require = createRequire(import.meta.url)
const remotePort = Number(process.env.REMOTE_PORT || 3001)
const remoteOrigin = `http://localhost:${remotePort}`
const hostMode = process.env.HOST_MODE || 'ssr'
const isSpaMode = hostMode === 'spa'
const isPrerenderMode = hostMode === 'prerender'
const enableServerFederationRuntime = hostMode === 'ssr'
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
const startConfig = {
  federation: true,
  ...(isSpaMode
    ? {
        spa: {
          enabled: true,
        },
      }
    : isPrerenderMode
      ? {
          prerender: {
            enabled: true,
            crawlLinks: false,
            autoStaticPathsDiscovery: false,
          },
          pages: [
            { path: '/' },
            { path: '/selective-client-only' },
          ],
        }
      : {}),
}

const createClientFederationConfig = () => ({
  name: 'mf_host',
  remotes: {
    mf_remote: `mf_remote@${remoteOrigin}/mf-manifest.json`,
  },
  dts: false,
  experiments: {
    asyncStartup: true,
  },
  runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')],
  shared,
})

const createServerFederationConfig = () => ({
  name: 'mf_host_ssr',
  remotes: {
    mf_remote: `mf_remote@${remoteOrigin}/ssr/mf-manifest.json`,
  },
  dts: false,
  experiments: {
    asyncStartup: true,
  },
  runtimePlugins: enableServerFederationRuntime
    ? [require.resolve('@module-federation/node/runtimePlugin')]
    : [],
  shared,
})
const startPlugins = tanstackStart(startConfig)

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation(createServerFederationConfig(), {
      target: 'node',
      environment: 'ssr',
    }),
    pluginModuleFederation(createClientFederationConfig(), {
      environment: 'client',
    }),
    ...(Array.isArray(startPlugins) ? startPlugins : [startPlugins]),
  ],
  environments: {
    ssr: {},
  },
})
