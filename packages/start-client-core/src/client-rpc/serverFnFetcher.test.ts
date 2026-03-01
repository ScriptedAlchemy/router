import { isRedirect } from '@tanstack/router-core'
import { describe, expect, it } from 'vitest'
import { serverFnFetcher } from './serverFnFetcher'

function getFetchArgs() {
  return [
    {
      method: 'GET' as const,
      data: undefined,
      context: undefined,
    },
  ]
}

describe('serverFnFetcher redirect parsing', () => {
  it('throws serialized redirects', async () => {
    try {
      await serverFnFetcher('/_serverFn/test', getFetchArgs(), () => {
        return Promise.resolve(
          Response.json({
            isSerializedRedirect: true,
            to: '/serialized-target',
            statusCode: 307,
          }),
        )
      })

      throw new Error('Expected serverFnFetcher to throw a redirect')
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
      expect((error as { options: { to?: string } }).options.to).toBe(
        '/serialized-target',
      )
    }
  })

  it('falls back to status/options redirect payloads for response-like values', async () => {
    try {
      await serverFnFetcher('/_serverFn/test', getFetchArgs(), () => {
        return Promise.resolve(
          Response.json({
            status: 307,
            options: {
              to: '/fallback-target',
              statusCode: 307,
            },
          }),
        )
      })

      throw new Error('Expected serverFnFetcher to throw a redirect')
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
      expect((error as { options: { to?: string } }).options.to).toBe(
        '/fallback-target',
      )
    }
  })

  it('falls back to top-level statusCode/options redirect payloads', async () => {
    try {
      await serverFnFetcher('/_serverFn/test', getFetchArgs(), () => {
        return Promise.resolve(
          Response.json({
            statusCode: 307,
            options: {
              to: '/status-code-target',
            },
          }),
        )
      })

      throw new Error('Expected serverFnFetcher to throw a redirect')
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
      expect(
        (error as { options: { to?: string; statusCode?: number } }).options,
      ).toEqual(
        expect.objectContaining({
          to: '/status-code-target',
          statusCode: 307,
        }),
      )
    }
  })

  it('preserves explicit options.statusCode over fallback status', async () => {
    try {
      await serverFnFetcher('/_serverFn/test', getFetchArgs(), () => {
        return Promise.resolve(
          Response.json({
            status: 307,
            options: {
              to: '/preserve-target',
              statusCode: 308,
            },
          }),
        )
      })

      throw new Error('Expected serverFnFetcher to throw a redirect')
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
      expect(
        (error as { options: { to?: string; statusCode?: number } }).options,
      ).toEqual(
        expect.objectContaining({
          to: '/preserve-target',
          statusCode: 308,
        }),
      )
    }
  })

  it('preserves fallback redirect status from response-like payloads', async () => {
    try {
      await serverFnFetcher('/_serverFn/test', getFetchArgs(), () => {
        return Promise.resolve(
          Response.json({
            status: 301,
            options: {
              to: '/moved-target',
            },
          }),
        )
      })

      throw new Error('Expected serverFnFetcher to throw a redirect')
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
      expect(
        (error as { options: { to?: string; statusCode?: number } }).options,
      ).toEqual(
        expect.objectContaining({
          to: '/moved-target',
          statusCode: 301,
        }),
      )
    }
  })

  it('does not fallback-parse generic payloads that only resemble redirect shapes', async () => {
    const payload = {
      status: 302,
      options: {
        to: '/should-not-redirect',
      },
      message: 'business payload',
    }
    const result = await serverFnFetcher(
      '/_serverFn/test',
      getFetchArgs(),
      () => Promise.resolve(Response.json(payload)),
    )

    expect(result).toEqual(payload)
  })

  it('does not treat non-redirect status payloads as redirects', async () => {
    const result = await serverFnFetcher(
      '/_serverFn/test',
      getFetchArgs(),
      () => {
        return Promise.resolve(
          Response.json({
            status: 200,
            options: {
              to: '/not-a-redirect',
            },
            ok: true,
          }),
        )
      },
    )

    expect(result).toEqual({
      status: 200,
      options: {
        to: '/not-a-redirect',
      },
      ok: true,
    })
  })
})
