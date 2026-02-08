import { joinURL } from 'ufo'
import { rootRouteId } from '@tanstack/router-core'
import { tsrSplit } from '@tanstack/router-plugin'
import type { Manifest, RouterManagedTag } from '@tanstack/router-core'
import type { GetConfigFn } from '../types'

type RsbuildAsset = string | { name?: string }

type RsbuildChunkModule = {
  identifier?: string
  resource?: string
}

type RsbuildChunk = {
  files?: Array<string>
  modules?: Array<RsbuildChunkModule>
}

type RsbuildEntrypoint = {
  assets?: Array<RsbuildAsset>
}

type RsbuildStats = {
  entrypoints?: Record<string, RsbuildEntrypoint>
  chunks?: Array<RsbuildChunk>
  assets?: Array<RsbuildAsset>
}

function normalizeAssetName(asset: RsbuildAsset): string | undefined {
  if (typeof asset === 'string') return asset
  return asset.name
}

function pickEntryFile(stats: RsbuildStats | undefined, entryName?: string) {
  if (!stats) return undefined
  const entrypoints = stats.entrypoints
  const entrypoint =
    (entryName && entrypoints?.[entryName]) ||
    (entrypoints ? Object.values(entrypoints)[0] : undefined)
  const entryAsset = entrypoint?.assets
    ?.map(normalizeAssetName)
    .find((asset) => asset?.endsWith('.js'))
  if (entryAsset) return entryAsset
  const fallbackAsset = stats.assets
    ?.map(normalizeAssetName)
    .find((asset) => asset?.endsWith('.js'))
  return fallbackAsset
}

function parseModuleId(module: RsbuildChunkModule): string | undefined {
  const identifier = module.resource || module.identifier
  if (!identifier) return undefined
  return identifier
}

function buildCssTags(basePath: string, cssFiles: Array<string>) {
  return cssFiles.map(
    (cssFile) =>
      ({
        tag: 'link',
        attrs: {
          rel: 'stylesheet',
          href: joinURL(basePath, cssFile),
          type: 'text/css',
        },
      }) satisfies RouterManagedTag,
  )
}

export function buildStartManifestFromStats(opts: {
  stats?: RsbuildStats
  getConfig: GetConfigFn
  entryName?: string
}): Manifest & { clientEntry: string } {
  const { resolvedStartConfig } = opts.getConfig()
  const routeTreeRoutes = globalThis.TSS_ROUTES_MANIFEST as Record<
    string,
    { filePath?: string; children?: Array<string> }
  >

  const routeChunks: Record<
    string,
    Array<{ jsFiles: Array<string>; cssFiles: Array<string> }>
  > = {}

  for (const chunk of opts.stats?.chunks ?? []) {
    const files = chunk.files ?? []
    const jsFiles = files.filter((file) => file.endsWith('.js'))
    const cssFiles = files.filter((file) => file.endsWith('.css'))

    for (const module of chunk.modules ?? []) {
      const moduleId = parseModuleId(module)
      if (!moduleId) continue
      const [id, query] = moduleId.split('?')
      if (!id || !query) continue
      const searchParams = new URLSearchParams(query)
      const split = searchParams.get(tsrSplit)
      if (split === null) continue

      const entry = routeChunks[id] ?? []
      entry.push({ jsFiles, cssFiles })
      routeChunks[id] = entry
    }
  }

  const manifest: Manifest = { routes: {} }
  const basePath = resolvedStartConfig.viteAppBase

  Object.entries(routeTreeRoutes).forEach(([routeId, v]) => {
    if (!v.filePath) {
      throw new Error(`expected filePath to be set for ${routeId}`)
    }
    const chunks = routeChunks[v.filePath]
    if (chunks && chunks.length > 0) {
      const preloads = chunks.flatMap((chunk) =>
        chunk.jsFiles.map((file) => joinURL(basePath, file)),
      )
      const assets = chunks.flatMap((chunk) =>
        buildCssTags(basePath, chunk.cssFiles),
      )
      manifest.routes[routeId] = {
        ...v,
        assets,
        preloads,
      }
    } else {
      manifest.routes[routeId] = v
    }
  })

  const entryFile = pickEntryFile(opts.stats, opts.entryName)
  if (!entryFile) {
    throw new Error('No entry file found in rsbuild stats')
  }

  manifest.routes[rootRouteId] = manifest.routes[rootRouteId] || {}
  const rootPreloads = manifest.routes[rootRouteId].preloads ?? []
  manifest.routes[rootRouteId].preloads = [
    joinURL(basePath, entryFile),
    ...rootPreloads,
  ]

  return {
    routes: manifest.routes,
    clientEntry: joinURL(basePath, entryFile),
  }
}
