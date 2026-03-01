import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerFnByIdMock = vi.hoisted(() => vi.fn())

vi.mock('../src/getServerFnById', () => ({
  getServerFnById: getServerFnByIdMock,
}))

vi.mock('../src/request-response', () => ({
  getResponse: () => ({
    status: 200,
    statusText: 'OK',
  }),
}))

import { handleServerAction } from '../src/server-functions-handler'

function createServerFnRequest() {
  return new Request('http://localhost/_serverFn/test', {
    method: 'GET',
    headers: {
      'x-tsr-serverFn': 'true',
    },
  })
}

async function runServerFnWithResult(result: unknown) {
  getServerFnByIdMock.mockResolvedValue(() =>
    Promise.resolve({
      result,
    }),
  )

  return (await handleServerAction({
    request: createServerFnRequest(),
    context: {},
    serverFnId: 'test-id',
  })) as Response
}

describe('server-functions-handler redirect fallback parsing', () => {
  beforeEach(() => {
    getServerFnByIdMock.mockReset()
  })

  it('preserves options.statusCode over fallback status', async () => {
    const response = await runServerFnWithResult({
      status: 307,
      options: {
        to: '/preserve-target',
        statusCode: 308,
      },
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual(
      expect.objectContaining({
        isSerializedRedirect: true,
        to: '/preserve-target',
        statusCode: 308,
      }),
    )
  })

  it('does not fallback-parse payloads with non-legacy keys', async () => {
    const response = await runServerFnWithResult({
      status: 302,
      options: {
        to: '/should-not-redirect',
      },
      message: 'business payload',
    })

    expect(response.headers.get('x-tss-serialized')).toBe('true')
    const payloadText = await response.text()
    expect(payloadText).not.toContain('isSerializedRedirect')
  })
})
