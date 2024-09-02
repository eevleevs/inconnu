if ('readTextFileSync' in Deno) {
  await import('https://deno.land/std@0.153.0/dotenv/load.ts')
}
import { getCookies } from 'https://deno.land/std@0.153.0/http/cookie.ts'
import { encode } from 'https://deno.land/std@0.153.0/node/querystring.ts'
import {
  generateSecret,
  JWTPayload,
  jwtVerify,
  SignJWT,
} from 'https://deno.land/x/jose@v4.9.1/index.ts'
import {
  opine,
  OpineRequest,
  OpineResponse,
  Router,
} from 'https://deno.land/x/opine@2.3.3/mod.ts'
import { ExpiringMap } from 'https://deno.land/x/expiring_map@1.0.0/mod.ts'

export interface Provider {
  getAuthCodeUrl(query: object, origin: string): Promise<string>
  getLogoutUrl(): string
  getPayload(query: any): Promise<JWTPayload>
}

const app = opine()
const expiration = Deno.env.get('INCONNU_JWT_EXPIRATION') || '1w'
const hubUrl = Deno.env.get('INCONNU_HUB_URL')
const jwk = await generateSecret('HS256')
const hostname = Deno.env.get('INCONNU_HOSTNAME')
const port = 3001
const secrets = new ExpiringMap(300000)

// common functions
const origin = (req: OpineRequest) =>
  `http${req.get('host')?.match(/^localhost:/) ? '' : 's'}://${req.get('host')}`

const sign = (payload: JWTPayload) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiration)
    .sign(jwk)

const setCors = (res: OpineResponse) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Headers', 'Authorization')
}

const verify = (req: OpineRequest, res: OpineResponse) => {
  setCors(res)
  const jwt = req.headers
    .get('authorization')
    ?.match(/^Bearer (\S+)/)
    ?.at(1) ?? getCookies(req.headers)['inconnu-auth']
  jwtVerify(jwt, jwk)
    .then((result) => res.json(result.payload))
    .catch((err) => res.setStatus(401).send(err))
}

const verifyOptions = (req: OpineRequest, res: OpineResponse) => {
  setCors(res)
  res.sendStatus(204) // No Content
}

// method and route logging
if (Deno.env.get('INCONNU_LOG')) {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`)
    next()
  })
}

if (hubUrl) {
  // satellite setup
  app.use(
    Deno.env.get('INCONNU_SAT_PATH') || '/inconnu',
    new Router()
      .get('/authenticate', (req, res) => {
        const satSecret = crypto.randomUUID()
        secrets.set(satSecret, true)
        res.redirect(
          `${hubUrl}/authenticate?` +
            encode({
              ...req.query,
              receiver: origin(req) + '/inconnu/authenticated',
              satSecret,
            }),
        )
      })
      .get('/authenticated', async (req, res) => {
        if (!secrets.delete(req.query.satSecret)) return res.sendStatus(401)
        const result = await fetch(`${hubUrl}/redeem?` + encode(req.query))
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
        (_req, res) =>
          res.clearCookie('inconnu-auth').redirect(`${hubUrl}/logout`),
      )
      .get('/verify', verify),
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
        .get('/authenticate', async (req, res) => {
          const hubSecret = crypto.randomUUID()
          secrets.set(hubSecret, true)
          res.redirect(
            await provider.getAuthCodeUrl(
              { ...req.query, hubSecret },
              origin(req),
            ),
          )
        })
        .get('/authenticated', (req, res) => {
          const { hubSecret, receiver, ...state } = JSON.parse(req.query.state)
          if (!secrets.delete(hubSecret)) return res.sendStatus(401)
          const code = crypto.randomUUID()
          secrets.set(code, req.query)
          res.redirect(
            (receiver || `/${name}/redeem`) + '?' + encode({ ...state, code }),
          )
        })
        .get('/logout', (_req, res) => res.redirect(provider.getLogoutUrl()))
        .get('/redeem', async (req, res) => {
          setCors(res)
          const query = secrets.pop(req.query.code)
          if (!query) return res.sendStatus(401)
          const payload = await provider.getPayload(query)
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
  .get('/', (_req, res) => res.redirect('https://github.com/eevleevs/inconnu'))
  .get('/verify', verify)
  .options('/verify', verifyOptions)
  .listen({ hostname, port })
console.log('listening on port ' + port)
