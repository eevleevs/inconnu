import {generateSecret, jwtVerify, SignJWT} from 'https://deno.land/x/jose@v4.9.0/index.ts'

const jwk = await generateSecret('HS256')

export const signJWT = (payload: any, jwtExpirationTime=undefined) => new SignJWT(payload)
  .setProtectedHeader({alg: 'HS256'})
  .setExpirationTime(jwtExpirationTime 
    || Deno.env.get('INCONNU_JWT_EXPIRATION_TIME') 
    || '1w')
  .sign(jwk)

export const verifyJWT = (jwt: string) => jwtVerify(jwt, jwk)