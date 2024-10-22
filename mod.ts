import '@std/dotenv/load'
import { getCookies } from '@std/http/cookie'
import { generateSecret, importJWK, JWTPayload, jwtVerify, SignJWT } from 'jose'
import express, { NextFunction, Request, Response, Router } from 'express'

const kv = await Deno.openKv()

async function kvPop(key: string[]) {
  const value = await kv.get(key)
  return (await kv.atomic().check(value).delete(key).commit()).ok
    ? value.value
    : null
}

export interface Provider {
  getAuthCodeUrl(query: object, origin: string): Promise<string>
  getLogoutUrl(): string
  getPayload(query: any): Promise<JWTPayload>
}

// configuration
const app = express()
const expiration = Deno.env.get('INCONNU_JWT_EXPIRATION') ?? '1w'
const hubUrl = Deno.env.get('INCONNU_HUB_URL')
const hostname = Deno.env.get('INCONNU_HOSTNAME') ?? '0.0.0.0'
const port = 3001
const expireIn = 300000 // 5 minutes
const usernameFilter = Deno.env.get('INCONNU_USERNAME_FILTER') ?? ''

const JWK = Deno.env.get('INCONNU_JWK')
const jwk =
  await (JWK ? importJWK(JSON.parse(JWK), 'HS256') : generateSecret('HS256'))

// common functions
const origin = (req: Request) =>
  `http${req.get('host')?.match(/^localhost:/) ? '' : 's'}://${req.get('host')}`

const sign = (payload: JWTPayload) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiration)
    .sign(jwk)

const setCors = (res: Response) =>
  res.set('Access-Control-Allow-Origin', '*')
    .set('Access-Control-Allow-Headers', 'Authorization')
    .set('Access-Control-Allow-Methods', 'GET, OPTIONS')

const verify = (req: Request, res: Response) => {
  setCors(res)
  const jwt = req.headers
    ?.['authorization']
    ?.match(/^Bearer (\S+)/)
    ?.at(1) ?? getCookies(req.headers)['inconnu-auth']
  jwtVerify(jwt, jwk)
    .then((result) => res.json(result.payload))
    .catch((err) => res.setStatus(401).send(err))
}

const verifyOptions = (req: Request, res: Response) => {
  setCors(res)
  res.sendStatus(204) // No Content
}

// method and route logging
if (Deno.env.get('INCONNU_LOG')) {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.url}`)
    next()
  })
}

if (hubUrl) {
  // satellite setup
  app.use(
    Deno.env.get('INCONNU_SAT_PATH') || '/inconnu',
    new Router()
      .get('/authenticate', (req: Request, res: Response) => {
        const satSecret = crypto.randomUUID()
        kv.set(['secrets', satSecret], true, { expireIn })
        res.redirect(
          `${hubUrl}/authenticate?` +
            new URLSearchParams({
              ...req.query,
              receiver: origin(req) + '/inconnu/authenticated',
              satSecret,
            }),
        )
      })
      .get('/authenticated', async (req: Request, res: Response) => {
        if (!await kvPop(['secrets', req.query.satSecret])) {
          return res.sendStatus(401)
        }
        const result = await fetch(
          `${hubUrl}/redeem?` + new URLSearchParams(req.query),
        )
        if (!result.ok) return res.sendStatus(401)
        const jwt = await sign(await result.json())
        res.cookie({
          name: 'inconnu-auth',
          value: jwt,
          expires: new Date(JSON.parse(atob(jwt.split('.')[1])).exp * 1000),
          httpOnly: true,
          sameSite: 'Lax',
        })
        res.redirect(req.query.redirect || origin(req) + '/inconnu/verify')
      })
      .get(
        '/logout',
        (_req: Request, res: Response) =>
          res.clearCookie('inconnu-auth').redirect(`${hubUrl}/logout`),
      )
      .get('/verify', verify)
      .options('/verify', verifyOptions),
  )
  console.log(`satellite mode, using hub ${hubUrl}`)
} else {
  // hub setup
  const names = []
  for await (const file of Deno.readDir('providers')) {
    const name = file.name.match(/(.*)\.ts$/)?.at(1)
    if (!name || !Deno.env.get(`INCONNU_${name.toUpperCase()}`)) continue
    names.push(name)
    const provider: Provider = (await import('./providers/' + file.name))
      .provider
    app.use(
      `/${name}`,
      new Router()
        .get('/authenticate', async (req: Request, res: Response) => {
          const hubSecret = crypto.randomUUID()
          kv.set(['secrets', hubSecret], true, { expireIn })
          res.redirect(
            await provider.getAuthCodeUrl(
              { ...req.query, hubSecret },
              origin(req),
            ),
          )
        })
        .get('/authenticated', async (req: Request, res: Response) => {
          const { hubSecret, receiver, ...state } = JSON.parse(req.query.state)
          if (!await kvPop(['secrets', hubSecret])) return res.sendStatus(401)
          const code = crypto.randomUUID()
          await kv.set(['secrets', code], req.query)
          res.redirect(
            (receiver || `/${name}/redeem`) + '?' +
              new URLSearchParams({ ...state, code }),
          )
        })
        .get(
          '/logout',
          (_req: Request, res: Response) =>
            res.redirect(provider.getLogoutUrl()),
        )
        .get('/redeem', async (req: Request, res: Response) => {
          setCors(res)
          const query = await kvPop(['secrets', req.query.code])
          if (!query) return res.sendStatus(404)
          const payload = await provider.getPayload(query)
          if (!(payload.username as string)?.match(usernameFilter)) {
            return res.sendStatus(401)
          }
          res.json({
            ...payload,
            ...(req.query.jwt && { jwt: await sign(payload) }),
          })
        })
        .get('/verify', verify)
        .options('/verify', verifyOptions),
    )
  }
  console.log('hub mode, using ' + names.join(', '))
}

// generic routes and start
app
  .get('/verify', verify)
  .options('/verify', verifyOptions)
  .listen({ hostname, port })
console.log('listening on port ' + port)
