import digest from '../runtime/digest.ts'
import { encode as base64url } from '../runtime/base64url.ts'

import { JOSENotSupported, JWKInvalid } from '../util/errors.ts'
import { encoder } from '../lib/buffer_utils.ts'
import type { JWK } from '../types.d.ts'
import isObject from '../lib/is_object.ts'

const check = (value: unknown, description: string) => {
  if (typeof value !== 'string' || !value) {
    throw new JWKInvalid(`${description} missing or invalid`)
  }
}

/**
 * Calculates a base64url-encoded JSON Web Key (JWK) Thumbprint as per
 * [RFC7638](https://www.rfc-editor.org/rfc/rfc7638).
 *
 * @param jwk JSON Web Key.
 * @param digestAlgorithm Digest Algorithm to use for calculating the thumbprint.
 * Default is sha256. Accepted is "sha256", "sha384", "sha512".
 *
 * @example Usage
 * ```js
 * const thumbprint = await jose.calculateJwkThumbprint({
 *   kty: 'RSA',
 *   e: 'AQAB',
 *   n: '12oBZRhCiZFJLcPg59LkZZ9mdhSMTKAQZYq32k_ti5SBB6jerkh-WzOMAO664r_qyLkqHUSp3u5SbXtseZEpN3XPWGKSxjsy-1JyEFTdLSYe6f9gfrmxkUF_7DTpq0gn6rntP05g2-wFW50YO7mosfdslfrTJYWHFhJALabAeYirYD7-9kqq9ebfFMF4sRRELbv9oi36As6Q9B3Qb5_C1rAzqfao_PCsf9EPsTZsVVVkA5qoIAr47lo1ipfiBPxUCCNSdvkmDTYgvvRm6ZoMjFbvOtgyts55fXKdMWv7I9HMD5HwE9uW839PWA514qhbcIsXEYSFMPMV6fnlsiZvQQ'
 * })
 *
 * console.log(thumbprint)
 * ```
 */
export async function calculateJwkThumbprint(
  jwk: JWK,
  digestAlgorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256',
): Promise<string> {
  if (!isObject(jwk)) {
    throw new TypeError('JWK must be an object')
  }

  if (
    digestAlgorithm !== 'sha256' &&
    digestAlgorithm !== 'sha384' &&
    digestAlgorithm !== 'sha512'
  ) {
    throw new TypeError('digestAlgorithm must one of "sha256", "sha384", or "sha512"')
  }

  let components: JWK
  switch (jwk.kty) {
    case 'EC':
      check(jwk.crv, '"crv" (Curve) Parameter')
      check(jwk.x, '"x" (X Coordinate) Parameter')
      check(jwk.y, '"y" (Y Coordinate) Parameter')
      components = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }
      break
    case 'OKP':
      check(jwk.crv, '"crv" (Subtype of Key Pair) Parameter')
      check(jwk.x, '"x" (Public Key) Parameter')
      components = { crv: jwk.crv, kty: jwk.kty, x: jwk.x }
      break
    case 'RSA':
      check(jwk.e, '"e" (Exponent) Parameter')
      check(jwk.n, '"n" (Modulus) Parameter')
      components = { e: jwk.e, kty: jwk.kty, n: jwk.n }
      break
    case 'oct':
      check(jwk.k, '"k" (Key Value) Parameter')
      components = { k: jwk.k, kty: jwk.kty }
      break
    default:
      throw new JOSENotSupported('"kty" (Key Type) Parameter missing or unsupported')
  }

  const data = encoder.encode(JSON.stringify(components))
  return base64url(await digest(digestAlgorithm, data))
}
