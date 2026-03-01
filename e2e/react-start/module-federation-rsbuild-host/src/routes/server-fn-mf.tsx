import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
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

export const Route = createFileRoute('/server-fn-mf')({
  loader: () => getRemoteServerData(),
  component: ServerFunctionFederationRoute,
})

function ServerFunctionFederationRoute() {
  const response = Route.useLoaderData()
  const redirectFn = useServerFn(redirectFromResponseLike)
  const rawResponseFn = useServerFn(getRemoteRawResponse)
  const [rawResponseText, setRawResponseText] = React.useState<string>('')
  const [rawResponseStatus, setRawResponseStatus] = React.useState<
    number | null
  >(null)

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '1rem' }}>
      <h2 data-testid="server-fn-heading">Server function federation route</h2>
      <pre data-testid="server-fn-result">{JSON.stringify(response)}</pre>
      <button
        data-testid="server-fn-redirect-btn"
        onClick={async () => {
          await redirectFn()
        }}
      >
        Trigger response-like redirect
      </button>
      <button
        data-testid="server-fn-raw-btn"
        onClick={async () => {
          const rawResponse = await rawResponseFn()

          if (!(rawResponse instanceof Response)) {
            throw new Error('Expected a raw Response from federated server fn')
          }

          setRawResponseStatus(rawResponse.status)
          setRawResponseText(await rawResponse.text())
        }}
      >
        Read federated raw response
      </button>
      <pre data-testid="server-fn-raw-result">
        {JSON.stringify({
          status: rawResponseStatus,
          text: rawResponseText,
        })}
      </pre>
    </main>
  )
}
