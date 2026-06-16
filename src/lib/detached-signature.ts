/**
 * Detached JWS signing over exact config bytes (RFC 7797, unencoded payload).
 *
 * The signing input is `BASE64URL(protectedHeader) + "." + <config bytes>`, and
 * the compact detached form is `<protectedHeader>..<signature>` (the payload
 * segment is empty — the config.json file IS the payload). This binds the
 * signature to the exact bytes the SDK fetches.
 */

import { FlattenedSign } from 'jose';

export interface DetachedHeader {
  alg: string;
  kid: string;
}

export async function signDetached(
  payload: string,
  privateKey: CryptoKey,
  header: DetachedHeader
): Promise<string> {
  const flattened = await new FlattenedSign(new TextEncoder().encode(payload))
    .setProtectedHeader({
      alg: header.alg,
      kid: header.kid,
      b64: false,
      crit: ['b64'],
    })
    .sign(privateKey);

  // Detached compact serialization: drop the payload segment.
  return `${flattened.protected}..${flattened.signature}`;
}
