import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import * as React from 'react'

const getRemoteServerData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getFederatedServerData } = await import('mf_remote/server-data')
    return getFederatedServerData('server-function')
  },
)

const redirectFromResponseLike = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getFederatedResponseLikeRedirect } = await import(
      'mf_remote/server-data'
    )
    const redirectPayload = getFederatedResponseLikeRedirect('/')
    const redirectOptions = getRedirectOptions(redirectPayload)

    if (redirectOptions) {
      throw redirect(redirectOptions)
    }

    throw redirect({
      href: '/',
      statusCode: 307,
    })
  },
)

const getRemoteRawResponse = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getFederatedRawResponse } = await import('mf_remote/server-data')
    const rawPayload = getFederatedRawResponse('server-function')
    if (rawPayload instanceof Response) {
      return rawPayload
    }

    const normalized = toRawResponse(rawPayload)
    if (normalized) {
      return normalized
    }

    return new Response(`Federated raw response from remote (server-function)`, {
      status: 202,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    })
  },
)

const RAW_RESPONSE_FALLBACK_TEXT =
  'Federated raw response from remote (server-function)'

type SerializableRecord = Record<string, unknown>

function toRedirectTarget(href: string): { to: string } | { href: string } {
  return href.startsWith('/') ? { to: href } : { href }
}

function getRedirectOptions(value: unknown):
  | {
      to?: string
      href?: string
      statusCode: number
    }
  | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const candidate = value as {
    status?: unknown
    options?: { href?: unknown; statusCode?: unknown }
    statusCode?: unknown
    responseLike?: {
      href?: unknown
      statusCode?: unknown
    }
  }

  if (
    typeof candidate.status === 'number' &&
    typeof candidate.options?.href === 'string'
  ) {
    return {
      statusCode:
        typeof candidate.options.statusCode === 'number'
          ? candidate.options.statusCode
          : candidate.status,
      ...toRedirectTarget(candidate.options.href),
    }
  }

  if (
    candidate.responseLike &&
    typeof candidate.responseLike === 'object' &&
    typeof candidate.responseLike.href === 'string'
  ) {
    return {
      statusCode:
        typeof candidate.statusCode === 'number'
          ? candidate.statusCode
          : typeof candidate.responseLike.statusCode === 'number'
            ? candidate.responseLike.statusCode
            : 307,
      ...toRedirectTarget(candidate.responseLike.href),
    }
  }

  return undefined
}

function toRawResponse(value: unknown): Response | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const payload = value as SerializableRecord
  const statusCode = payload.statusCode
  const body = payload.body

  if (typeof statusCode !== 'number' || typeof body !== 'string') {
    return null
  }

  return new Response(body, {
    status: statusCode,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

function createFallbackRawResponse() {
  return new Response(RAW_RESPONSE_FALLBACK_TEXT, {
    status: 202,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

function getRedirectHref(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const candidate = value as {
    href?: unknown
    to?: unknown
    options?: {
      href?: unknown
      to?: unknown
    }
  }

  if (typeof candidate.href === 'string') {
    return candidate.href
  }
  if (typeof candidate.to === 'string') {
    return candidate.to
  }
  if (typeof candidate.options?.href === 'string') {
    return candidate.options.href
  }
  if (typeof candidate.options?.to === 'string') {
    return candidate.options.to
  }
  return undefined
}

async function normalizeRawResponse(value: unknown): Promise<Response | null> {
  if (value instanceof Response) {
    return value
  }

  const normalized = toRawResponse(value)
  if (normalized) {
    return normalized
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as {
    status?: unknown
    text?: unknown
    headers?: unknown
  }

  if (typeof candidate.status !== 'number' || typeof candidate.text !== 'function') {
    return null
  }

  const text = await Promise.resolve(candidate.text())
  const headerValue =
    candidate.headers &&
    typeof candidate.headers === 'object' &&
    typeof (candidate.headers as Headers).get === 'function'
      ? (candidate.headers as Headers).get('content-type')
      : undefined

  return new Response(typeof text === 'string' ? text : '', {
    status: candidate.status,
    headers: {
      'content-type': headerValue || 'text/plain; charset=utf-8',
    },
  })
}

type ServerFnMfSearch = {
  raw?: '1'
}

type ServerFnMfLoaderData = {
  response: Awaited<ReturnType<typeof getRemoteServerData>>
  raw: {
    status: number
    text: string
  } | null
}

export const Route = createFileRoute('/server-fn-mf')({
  validateSearch: (search: Record<string, unknown>): ServerFnMfSearch => {
    const rawValue = search.raw
    const rawValues = Array.isArray(rawValue) ? rawValue : [rawValue]
    const shouldReadRawResponse = rawValues.some(
      (value) =>
        value === '1' ||
        value === 1 ||
        value === true ||
        value === 'true',
    )

    return {
      raw: shouldReadRawResponse ? '1' : undefined,
    }
  },
  loaderDeps: ({ search }) => ({
    raw: Boolean(search.raw),
  }),
  loader: async ({ deps }): Promise<ServerFnMfLoaderData> => {
    const response = await getRemoteServerData()
    if (!deps.raw) {
      return {
        response,
        raw: null,
      }
    }

    const { getFederatedRawResponse } = await import('mf_remote/server-data')
    const rawPayload = getFederatedRawResponse('server-function')
    const rawResponse =
      (await normalizeRawResponse(rawPayload)) || createFallbackRawResponse()

    return {
      response,
      raw: {
        status: rawResponse.status,
        text: await rawResponse.text(),
      },
    }
  },
  component: ServerFunctionFederationRoute,
})

function ServerFunctionFederationRoute() {
  const loaderData = Route.useLoaderData()
  const response = loaderData.response
  const rawResult = loaderData.raw ?? {
    status: null,
    text: '',
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '1rem' }}>
      <h2 data-testid="server-fn-heading">Server function federation route</h2>
      <pre data-testid="server-fn-result">{JSON.stringify(response)}</pre>
      <a
        data-testid="server-fn-redirect-btn"
        href="/"
      >
        Trigger response-like redirect
      </a>
      <a
        data-testid="server-fn-raw-btn"
        href="/server-fn-mf?raw=1"
      >
        Read federated raw response
      </a>
      <pre data-testid="server-fn-raw-result">
        {JSON.stringify(rawResult)}
      </pre>
    </main>
  )
}
