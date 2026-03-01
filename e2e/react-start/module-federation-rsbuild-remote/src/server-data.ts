export function getFederatedServerData(source: string) {
  return {
    source,
    message: 'Federated server data from remote',
  }
}

type FederatedRedirectLikeResponse = {
  status: number
  headers: Headers
  ok: boolean
  body: null
  json: () => Promise<never>
  text: () => Promise<string>
  options: {
    href: string
    statusCode: number
  }
}

export function getFederatedResponseLikeRedirect(
  href: string,
): FederatedRedirectLikeResponse {
  const statusCode = 307

  return {
    status: statusCode,
    headers: new Headers({ Location: href }),
    ok: false,
    body: null,
    json: () =>
      Promise.reject(new Error('No JSON body for redirect-like response')),
    text: () => Promise.resolve(''),
    options: {
      href,
      statusCode,
    },
  }
}

export function getFederatedRawResponse(source: string) {
  return new Response(`Federated raw response from remote (${source})`, {
    status: 202,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}
