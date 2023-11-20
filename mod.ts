if ('readTextFileSync' in Deno)
  await import('https://deno.land/std@0.153.0/dotenv/load.ts')
import {getCookies} from 'https://deno.land/std@0.153.0/http/cookie.ts'
import {encode} from 'https://deno.land/std@0.153.0/node/querystring.ts'
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
import {ExpiringMap} from 'https://deno.land/x/expiring_map@1.0.0/mod.ts'

export interface Provider {
  getAuthCodeUrl(query: object, redirect: string): Promise<string>
  getLogoutUrl(): string
  getPayload(query: any): Promise<JWTPayload>
}

const app = opine()
const expiration = Deno.env.get('INCONNU_JWT_EXPIRATION') || '1w'
const jwk = await generateSecret('HS256')
const path = Deno.env.get('INCONNU_PATH') ?? '/inconnu'
const port = 3001
const mainRouter = new Router()
const secrets = new ExpiringMap(300000)

// common functions
const sign = (payload: JWTPayload) =>
  new SignJWT(payload)
    .setProtectedHeader({alg: 'HS256'})
    .setExpirationTime(expiration)
    .sign(jwk)
const verify = (req: OpineRequest, res: OpineResponse) => {
  const jwt =
    req.headers
      .get('authorization')
      ?.match(/^Bearer (\S+)/)
      ?.at(1) ?? getCookies(req.headers)['inconnu-auth']
  jwtVerify(jwt, jwk)
    .then(result => res.json(result.payload))
    .catch(err => res.setStatus(401).send(err))
}

// method and route logging
if (Deno.env.get('INCONNU_LOG'))
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`)
    next()
  })

// providers setup
const names = []
for await (const file of Deno.readDir('providers')) {
  const name = file.name.match(/(.*)\.ts$/)?.at(1)
  if (!name || !Deno.env.get(`INCONNU_${name.toUpperCase()}`)) continue
  names.push(name)
  const provider: Provider = (await import('./providers/' + file.name)).provider
  mainRouter.use(
    `/${name}`,
    new Router()
      .get('/authenticate', async (req, res) => {
        const secret = crypto.randomUUID()
        secrets.set(secret, true)
        res.redirect(
          await provider.getAuthCodeUrl(
            {...req.query, secret},
            `${req.protocol}://${req.hostname}${path}/${name}/authenticated`,
          ),
        )
      })
      .get('/authenticated', (req, res) => {
        const {secret, receiver, ...state} = JSON.parse(req.query.state)
        if (!secrets.delete(secret)) return res.sendStatus(401)
        const code = crypto.randomUUID()
        secrets.set(code, req.query)
        res.redirect(
          (receiver || `/${name}/redeem`) + '?' + encode({...state, code}),
        )
      })
      .get('/logout', (_req, res) =>
        res.clearCookie('inconnu-auth').redirect(provider.getLogoutUrl()),
      )
      .get('/redeem', async (req, res) => {
        const query = secrets.pop(req.query.code)
        if (!query) return res.sendStatus(401)
        const payload = await provider.getPayload(query)
        const jwt = await sign(payload)
        res
          .cookie({
            name: 'inconnu-auth',
            value: jwt,
            expires: new Date(JSON.parse(atob(jwt.split('.')[1])).exp * 1000),
            httpOnly: true,
            sameSite: 'Lax',
          })
          .json({
            ...payload,
            jwt,
          })
      })
      .get('/verify', verify),
  )
}
console.log('using ' + names.join(', '))

// generic routes and start
mainRouter
  .get('/', (_req, res) => res.redirect('https://github.com/eevleevs/inconnu'))
  .get('/verify', verify)

app.set('trust proxy', true).use(path, mainRouter).listen(port)
console.log('listening on port ' + port)
