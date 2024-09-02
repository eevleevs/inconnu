import { ConfidentialClientApplication } from 'https://denopkg.com/josh-hemphill/azure-msal-deno@master/mod.ts'
import { Provider } from '../mod.ts'

class CustomClientApplication extends ConfidentialClientApplication {
  getLogoutUrl = () => this.config.auth.authority + 'oauth2/v2.0/logout'
}

const [clientId, clientSecret] = (Deno.env.get('INCONNU_MICROSOFT') ?? '')
  .split(':')
const cca = new CustomClientApplication({ auth: { clientId, clientSecret } })
const scopes = ['user.read', 'directory.read.all']
let redirectUri: string

export const provider: Provider = {
  getAuthCodeUrl: (query, origin) =>
    cca.getAuthCodeUrl({
      redirectUri: redirectUri ??= origin + '/microsoft/authenticated',
      scopes,
      state: JSON.stringify(query),
    }),
  getLogoutUrl: cca.getLogoutUrl,
  getPayload: async (query) => {
    const acquired = await cca.acquireTokenByCode({
      code: query.code,
      redirectUri,
      scopes,
    })
    const payload: any = {
      username: acquired?.account?.username?.toLowerCase(),
    }
    const state = JSON.parse(query.state)
    if (state.memberOf) {
      const groups = (await (await fetch(
        'https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName&$top=999',
        { headers: { authorization: 'Bearer ' + acquired?.accessToken } },
      )).json())
        .value
        .map((v: any) => v.displayName)
      payload.memberOf = state.memberOf
        .split(',')
        .filter((group: string) => groups.includes(group))
    }
    return payload
  },
}
