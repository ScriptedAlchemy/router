import { describe, expect, it, vi } from 'vitest'
import { rootRouteId } from '@tanstack/router-core'
import { tsrSplit } from '@tanstack/router-plugin'
import { buildStartManifestFromStats } from '../src/rsbuild/start-manifest-plugin'

const makeGetConfig = () =>
  vi.fn(() => ({
    startConfig: {} as any,
    resolvedStartConfig: {
      root: '/app',
      startFilePath: '/app/src/start.ts',
      routerFilePath: '/app/src/router.ts',
      srcDirectory: '/app/src',
      viteAppBase: '/_build',
      serverFnProviderEnv: 'server',
    },
    corePluginOpts: {} as any,
  }))

describe('buildStartManifestFromStats', () => {
  it('builds route assets and client entry from stats', () => {
    const routeFile = '/app/src/routes/client-only.tsx'
    const routeId = '/client-only'

    globalThis.TSS_ROUTES_MANIFEST = {
      [rootRouteId]: {
        filePath: '/app/src/routes/__root.tsx',
        children: [routeId],
      },
      [routeId]: {
        filePath: routeFile,
        children: [],
      },
    }

    const stats = {
      entrypoints: {
        main: {
          assets: ['assets/main.js', 'assets/main.css'],
        },
      },
      chunks: [
        {
          files: ['assets/client-only.js', 'assets/client-only.css'],
          modules: [
            {
              resource: `${routeFile}?${tsrSplit}=route`,
            },
          ],
        },
      ],
      assets: [{ name: 'assets/fallback.js' }],
    }

    const manifest = buildStartManifestFromStats({
      stats,
      getConfig: makeGetConfig(),
      entryName: 'main',
    })

    expect(manifest.clientEntry).toBe('/_build/assets/main.js')
    expect(manifest.routes[rootRouteId]?.preloads).toEqual([
      '/_build/assets/main.js',
    ])
    expect(manifest.routes[routeId]?.preloads).toEqual([
      '/_build/assets/client-only.js',
    ])
    expect(manifest.routes[routeId]?.assets).toEqual([
      {
        tag: 'link',
        attrs: {
          rel: 'stylesheet',
          href: '/_build/assets/client-only.css',
          type: 'text/css',
        },
      },
    ])
  })
})
