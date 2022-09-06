if ('readTextFileSync' in Deno) await import('https://deno.land/std@0.153.0/dotenv/load.ts')
import { getCookies } from "https://deno.land/std@0.153.0/http/cookie.ts";
import { encode } from 'https://deno.land/std@0.153.0/node/querystring.ts'
import { generateSecret, JWTPayload, jwtVerify, SignJWT } from 'https://deno.land/x/jose@v4.9.1/index.ts'
import { opine, OpineRequest, OpineResponse, Router } from 'https://deno.land/x/opine@2.3.3/mod.ts'
import { ExpiringMap } from './expiring_map.ts'

export interface Provider {
  getAuthCodeUrl(query: object, origin: string): Promise<string>
  getLogoutUrl(): string
  getPayload(query: any): Promise<JWTPayload>
}

const app = opine()
const expiration = Deno.env.get('INCONNU_JWT_EXPIRATION') || '1w'
const hub = Deno.env.get('INCONNU_HUB_URL')
const jwk = await generateSecret('HS256')
const port = 3001
const secrets = new ExpiringMap(30000)

// common functions
export const decodePayload = (jwt: string) => JSON.parse(atob(jwt.split('.')[1]))
const origin = (req: OpineRequest) =>
  `http${req.get('host')?.match(/^localhost:/) ? '' : 's'}://${req.get('host')}`
const sign = (payload: JWTPayload) => new SignJWT(payload)
  .setProtectedHeader({alg: 'HS256'})
  .setExpirationTime(expiration)
  .sign(jwk)
const verify = (req: OpineRequest, res: OpineResponse) => {
  const jwt = req.headers.get('authorization')?.match(/^Bearer (\S+)/)?.at(1)
    ?? getCookies(req.headers)['inconnu-auth']
  console.log(req.headers.get('authorization'), getCookies(req.headers))
  jwtVerify(jwt, jwk)
    .then(result => res.json(result.payload))
    .catch(err => res.setStatus(401).send(err))
}

// method and route logging
if (Deno.env.get('INCONNU_LOG')) app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

if (hub) {
  console.log(`satellite mode, using hub ${hub}`)
  app.use('/inconnu', new Router()
    .get('/authenticate', (req, res) => {
      const secret = crypto.randomUUID()
      secrets.set(secret, true)
      res.redirect(`${hub}/authenticate?` + encode({
        ...req.query,
        receiver: origin(req) + '/inconnu/authenticated',
        secret,
      }))
    })
    .get('/authenticated', async (req, res) => {
      if (!secrets.delete(req.query.secret)) return res.sendStatus(401)
      const result = await fetch(`${hub}/redeem?` + encode(req.query))
      if (!result.ok) return res.sendStatus(401)
      const jwt = await sign(await result.json())
      res.cookie({
        name: 'inconnu-auth',
        value: jwt,
        expires: new Date(decodePayload(jwt).exp * 1000),
        httpOnly: true,
        sameSite: 'Lax',
      })
      res.redirect(req.query.redirect || origin(req) + '/inconnu/verify')
    })
    .get('/logout', (_req, res) => res
      .clearCookie('inconnu-auth')
      .redirect(`${hub}/logout`)
    )
    .get('/verify', verify)
  )
} else {
  const names = []
  for await (const file of Deno.readDir('providers')) {
    const name = file.name.match(/(.*)\.ts$/)?.at(1)
    if (!name || !Deno.env.get(`INCONNU_${name.toUpperCase()}`)) continue
    names.push(name)
    const provider: Provider = (await import('./providers/' + file.name)).provider
    app.use(`/${name}`, new Router()
      .get('/authenticate', async (req, res) => {
        const secret = crypto.randomUUID()
        secrets.set(secret, true)
        res.redirect(await provider.getAuthCodeUrl({...req.query, secret}, origin(req)))
      })
      .get('/authenticated', (req, res) => {
        const {receiver, secret, ...state} = JSON.parse(req.query.state)
        if (!secrets.delete(secret)) return res.sendStatus(401)
        const code = crypto.randomUUID()
        secrets.set(code, req.query)
        res.redirect((receiver || `/${name}/redeem`) + '?' + encode({...state, code}))
      })
      .get('/logout', (_req, res) => res.redirect(provider.getLogoutUrl()))
      .get('/redeem', async (req, res) => {
        const query = secrets.pop(req.query.code)
        if (!query) return res.sendStatus(401)
        const payload = await provider.getPayload(query)
        res.json({
          ...payload, 
          ...req.query.jwt && {jwt: await sign(payload)},
        })
      })
      .get('/verify', verify)
    )
  }
  console.log('hub mode, using ' + names.join(', '))
}

app
  .get('/', (_req, res) => res.redirect('https://github.com/eevleevs/inconnu'))
  .get('/verify', verify)
  .listen(port)
console.log('listening on port ' + port)