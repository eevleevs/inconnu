import {ConfidentialClientApplication} from 'https://denopkg.com/eevleevs/azure-msal-deno@master/mod.ts'
import {encode, Router, SignJWT} from '../deps.ts'
import jwk from '../jwk.ts'

class CustomClientApplication extends ConfidentialClientApplication {
  getLogoutUrl = () => this.config.auth.authority + 'oauth2/v2.0/logout'
}
  
const [clientId, clientSecret] = (Deno.env.get('INCONNU_MICROSOFT') ?? '').split(':')
const cca = new CustomClientApplication({auth: {clientId, clientSecret}})
const scopes = ['user.read', 'directory.read.all']
let redirectUri: string

export const router = new Router()

  .get('/authenticate', async (req, res) => {
    if (!req.query.receiver) return res.setStatus(400).send('missing receiver')
    res.redirect(await cca.getAuthCodeUrl({
      redirectUri: redirectUri ??= 
        `http${req.get('host')?.match(/^localhost:/) ? '' : 's'}://${req.get('host')}/microsoft/authenticated`,
      scopes,
      state: JSON.stringify(req.query)
    }))
  })

  .get('/authenticated', async (req, res) => {
    const {jwtExpirationTime, memberOf, receiver, ...state} = JSON.parse(req.query.state)
    const acquired = await cca.acquireTokenByCode({code: req.query.code, redirectUri, scopes})
    const payload: any = {username: acquired?.account?.username?.toLowerCase()}
    if (memberOf) {
      const groups = (await (await fetch(
        'https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName&$top=999',
        {headers: {Authorization: 'Bearer ' + acquired?.accessToken}}
      )).json())
        .value
        .map((v: any) => v.displayName)
      payload.memberOf = memberOf
        .split(',')
        .filter((group: string) => groups.includes(group))
    }
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({alg: 'HS256'})
      .setExpirationTime(jwtExpirationTime 
        || Deno.env.get('INCONNU_JWT_EXPIRATION_TIME') 
        || '1w')
      .sign(jwk)
    res.redirect(receiver + '?' + encode({...state, ...payload, jwt}))
  })

  .get('/logout', (_req, res) => res.redirect(cca.getLogoutUrl()))