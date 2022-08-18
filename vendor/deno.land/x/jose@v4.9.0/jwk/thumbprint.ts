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
 * @example Usage
 *
 * ```js
 * const thumbprint = await jose.calculateJwkThumbprint({
 *   kty: 'EC',
 *   crv: 'P-256',
 *   x: 'jJ6Flys3zK9jUhnOHf6G49Dyp5hah6CNP84-gY-n9eo',
 *   y: 'nhI6iD5eFXgBTLt_1p3aip-5VbZeMhxeFSpjfEAf7Ww',
 * })
 *
 * console.log(thumbprint)
 * // 'w9eYdC6_s_tLQ8lH6PUpc0mddazaqtPgeC2IgWDiqY8'
 * ```
 *
 * @param jwk JSON Web Key.
 * @param digestAlgorithm Digest Algorithm to use for calculating the thumbprint. Default is "sha256".
 */
export async function calculateJwkThumbprint(
  jwk: JWK,
  digestAlgorithm?: 'sha256' | 'sha384' | 'sha512',
): Promise<string> {
  if (!isObject(jwk)) {
    throw new TypeError('JWK must be an object')
  }

  digestAlgorithm ??= 'sha256'

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

/**
 * Calculates a JSON Web Key (JWK) Thumbprint URI as per [RFC9278](https://www.rfc-editor.org/rfc/rfc9278).
 *
 * @example Usage
 *
 * ```js
 * const thumbprintUri = await jose.calculateJwkThumbprintUri({
 *   kty: 'EC',
 *   crv: 'P-256',
 *   x: 'jJ6Flys3zK9jUhnOHf6G49Dyp5hah6CNP84-gY-n9eo',
 *   y: 'nhI6iD5eFXgBTLt_1p3aip-5VbZeMhxeFSpjfEAf7Ww',
 * })
 *
 * console.log(thumbprint)
 * // 'urn:ietf:params:oauth:jwk-thumbprint:sha-256:w9eYdC6_s_tLQ8lH6PUpc0mddazaqtPgeC2IgWDiqY8'
 * ```
 *
 * @param jwk JSON Web Key.
 * @param digestAlgorithm Digest Algorithm to use for calculating the thumbprint. Default is "sha256".
 */
export async function calculateJwkThumbprintUri(
  jwk: JWK,
  digestAlgorithm?: 'sha256' | 'sha384' | 'sha512',
): Promise<string> {
  digestAlgorithm ??= 'sha256'
  const thumbprint = await calculateJwkThumbprint(jwk, digestAlgorithm)
  return `urn:ietf:params:oauth:jwk-thumbprint:sha-${digestAlgorithm.slice(-3)}:${thumbprint}`
}
