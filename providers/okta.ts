import {Provider} from '../mod.ts'

const [domain, clientId, clientSecret] = (Deno.env.get('INCONNU_OKTA') ?? '').split(':')
const issuer = `https://${domain}/oauth2/default`
let redirectUri: string

export const provider: Provider = {
  getAuthCodeUrl: (query, origin) => `${issuer}/v1/authorize?client_id=${clientId}&response_type=code&scope=openid%20email&redirect_uri=${redirectUri ??= origin + '/okta/authenticated'}&state=${JSON.stringify(query)}`,
  getLogoutUrl: () => `${issuer}/login/signout`,
  getPayload: async query => {
    const acquired = await (await fetch(`${issuer}/v1/token`, {
      method: 'post',
      headers: {
        accept: 'application/json',
        authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=authorization_code&redirect_uri=${redirectUri}&code=${query.code}`,
    })).json()
    return {username: JSON.parse(atob(acquired.id_token.split('.')[1])).email}
  }
}