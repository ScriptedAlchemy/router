import { createFileRoute } from '@tanstack/react-router'
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
    throw getFederatedResponseLikeRedirect('/')
  },
)

const getRemoteRawResponse = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getFederatedRawResponse } = await import('mf_remote/server-data')
    return getFederatedRawResponse('server-function')
  },
)

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
