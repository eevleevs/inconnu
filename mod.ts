import 'https://deno.land/std@0.151.0/dotenv/load.ts'
import {encode} from 'https://deno.land/std@0.151.0/node/querystring.ts'
import {ConfidentialClientApplication} from 'https://deno.land/x/azure_msal_deno@v1.1.0/mod.ts'
import {generateSecret, jwtVerify, SignJWT} from "https://deno.land/x/jose@v4.8.3/index.ts"
import {opine} from 'https://deno.land/x/opine@2.2.0/mod.ts'

class CustomClientApplication extends ConfidentialClientApplication {
  getLogoutUrl = () => this.config.auth.authority + 'oauth2/v2.0/logout'
}

const {clientId, clientSecret} = Deno.env.toObject()
if (!clientId) throw('missing clientId')
const cca = new CustomClientApplication({auth: {clientId, clientSecret}})
const jwk = await generateSecret('HS256')
const scopes = ['user.read', 'directory.read.all']
const app = opine()
let redirectUri: string

if (Deno.env.get('logging')) app.use((req, _res, next) => {
  const item = `${req.method} ${req.url}`
  console.log(item.length>200 ? item.slice(0, 200)+'...' : item)
  next()
})

app
  .get('/', (_req, res) => res.redirect('https://github.com/eevleevs/inconnu'))

  .get('/authenticate', async (req, res) => {
    if (!req.query.receiver) return res.setStatus(400).send('missing receiver')
    res.redirect(await cca.getAuthCodeUrl({
      redirectUri: redirectUri ??= 
        `http${req.get('host')?.match(/^localhost:/) ? '' : 's'}://${req.get('host')}/authenticated`,
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
        .split(/,/g)
        .filter((group: string) => groups.includes(group))
    }
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({alg: 'HS256'})
      .setExpirationTime(jwtExpirationTime || Deno.env.get('jwtExpirationTime') || '1w')
      .sign(jwk)
    res.redirect(receiver + '?' + encode({...state, ...payload, jwt}))
  })

  .get('/logout', (_req, res) => res.redirect(cca.getLogoutUrl()))

  .get('/verify/:jwt', (req, res) => jwtVerify(req.params.jwt, jwk)
    .then(result => res.json(result.payload))
    .catch(err => res.setStatus(400).send(err))
  )

  .listen(parseInt(Deno.env.get('listenPort') || '3001'))