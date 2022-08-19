import {encode, Router} from '../deps.ts'
import {signJWT} from '../jwt.ts'
import {origin} from '../origin.ts'

const [domain, clientId, clientSecret] = (Deno.env.get('INCONNU_OKTA') ?? '').split(':')
const issuer = `https://${domain}/oauth2/default`
let redirectUri: string

export const router = new Router()

  .get('/authenticate', (req, res) => {
    if (!req.query.receiver) return res.setStatus(400).send('missing receiver')
    res.redirect(`${issuer}/v1/authorize?client_id=${clientId}&response_type=code&scope=openid%20email&redirect_uri=${redirectUri ??= `${origin(req)}/okta/authenticated`}&state=${JSON.stringify(req.query)}`)
  })

  .get('/authenticated', async (req, res) => {
    const {jwtExpirationTime, receiver, secret, ...state} = JSON.parse(req.query.state)
    const data = await (await fetch(`${issuer}/v1/token`, {
      method: 'post',
      headers: {
        accept: 'application/json',
        authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=authorization_code&redirect_uri=${redirectUri}&code=${req.query.code}`,
    })).json()
    const payload = {username: JSON.parse(atob(data.id_token.split('.')[1])).email}
    const jwt = await signJWT(payload, jwtExpirationTime)
    res.redirect(receiver + '?' + encode({...state, ...payload, jwt}))
  })

  .get('/logout', (_req, res) => res.redirect(`${issuer}/login/signout`))