if ('readTextFileSync' in Deno) 
  await import('https://deno.land/std@0.151.0/dotenv/load.ts')
import {encode}
  from 'https://deno.land/std@0.151.0/node/querystring.ts'
import {generateSecret, JWTPayload, jwtVerify, SignJWT} 
  from 'https://deno.land/x/jose@v4.9.0/index.ts'
import {opine, OpineRequest, OpineResponse, Router}
  from 'https://deno.land/x/opine@2.2.0/mod.ts'

export interface Provider {
  getAuthCodeUrl(query: object, origin: string): string | Promise<string>
  getLogoutUrl(): string
  getPayload(query: any, state: any): Promise<JWTPayload>
}

const app = opine()
const jwk = await generateSecret('HS256')
const port = parseInt(Deno.env.get('INCONNU_PORT') || '3001')
let origin: string

const verify = (req: OpineRequest, res: OpineResponse) => jwtVerify(req.query.jwt, jwk)
  .then(result => res.json(result.payload))
  .catch(err => res.setStatus(400).send(err))

// method and route logging
if (Deno.env.get('INCONNU_LOG')) app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

// identity provider routes
for await (const file of Deno.readDir('providers')) {
  const name = file.name.match(/(.*)\.ts$/)?.at(1)
  if (!name || !Deno.env.get(`INCONNU_${name.toUpperCase()}`)) continue
  const provider: Provider = (await import('./providers/' + file.name)).provider
  app.use(`/${name}`, new Router()
    .get('/authenticate', async (req, res) => res.redirect(
      await provider.getAuthCodeUrl(req.query, origin ??= 
        `http${req.get('host')?.match(/^localhost:/) ? '' : 's'}://${req.get('host')}`
      )
    ))
    .get('/authenticated', async (req, res) => {
      const {jwtExpirationTime, receiver, ...state} = JSON.parse(req.query.state)
      const payload = await provider.getPayload(req.query, state)
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({alg: 'HS256'})
        .setExpirationTime(jwtExpirationTime 
          || Deno.env.get('INCONNU_JWT_EXPIRATION') 
          || '1w'
        )
        .sign(jwk)
      res.redirect((receiver ?? '/verify') + '?' + encode({...state, ...payload, jwt}))
    })
    .get('/logout', (_req, res) => res.redirect(provider.getLogoutUrl()))
    .get('/verify', verify)
)
  console.log(`${name} provider enabled`)
}

// generic routes
app
  .get('/', (_req, res) => res.redirect('https://github.com/eevleevs/inconnu'))
  .get('/verify', verify)

// server start
app.listen(port)
console.log('listening on port ' + port)