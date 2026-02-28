import { describe, expect, it } from 'vitest'
import packageJson from '../package.json' with { type: 'json' }
import { getServerFnById as directGetServerFnById } from '../src/getServerFnById'
import { getServerFnById as ssrCallerGetServerFnById } from '../src/server-fn-ssr-caller'

describe('server-fn-ssr-caller export', () => {
  it('re-exports getServerFnById', () => {
    expect(ssrCallerGetServerFnById).toBe(directGetServerFnById)
  })

  it('is exposed in package exports', () => {
    const subpathExport = (packageJson as any).exports['./server-fn-ssr-caller']
    expect(subpathExport).toBeDefined()
    expect(subpathExport.import.default).toBe(
      './dist/esm/server-fn-ssr-caller.js',
    )
    expect(subpathExport.import.types).toBe(
      './dist/esm/server-fn-ssr-caller.d.ts',
    )
  })
})

