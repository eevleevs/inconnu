if ('readTextFileSync' in Deno) await import('https://deno.land/std@0.151.0/dotenv/load.ts')
import {jwtVerify, opine} from './deps.ts'
import jwk from './jwk.ts'

const app = opine()
const port = parseInt(Deno.env.get('INCONNU_LISTEN_PORT') || '3001')

// method and route logging
if (Deno.env.get('INCONNU_LOGGING')) app.use((req, _res, next) => {
  const item = `${req.method} ${req.url}`
  console.log(item.length>200 ? item.slice(0, 200)+'...' : item)
  next()
})

// identity provider routes
for await (const file of Deno.readDir('providers')) {
  const name = file.name.match(/(.*)\.ts$/)?.at(1)
  if (!name) continue
  if (Deno.env.get(`INCONNU_${name.toUpperCase()}`)) {
    app.use(`/${name}`, (await import('./providers/' + file.name)).router)
    console.log(`${name} provider enabled`)
  } else {
    app.get(new RegExp(`^/${name}/`), (_req, res) => res
      .setStatus(404)
      .type('txt')
      .send(`${name} provider not configured`)
    )
  }
}

// generic routes
app
  .get('/', (_req, res) => res.redirect('https://github.com/eevleevs/inconnu'))
  .get('/verify/:jwt', (req, res) => jwtVerify(req.params.jwt, jwk)
    .then(result => res.json(result.payload))
    .catch(err => res.setStatus(400).send(err))
  )

// server start
app.listen(port)
console.log('listening on port ' + port)