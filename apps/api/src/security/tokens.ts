import type { AccessTokens } from '@noto/backend/postgres';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Access tokens: HS256 JWTs, fifteen minutes long (plan §1).
 *
 * Short and stateless on purpose. The refresh token is the one that is stored
 * and can be revoked; this one only has to be hard to forge and quick to
 * check. `IdentityPort.authenticate` still confirms the session is live, so a
 * sign-out takes effect on the next request rather than at expiry.
 *
 * The algorithm is pinned on verification. Accepting whatever `alg` the token
 * names is how `none` and key-confusion attacks get in.
 */

const ISSUER = 'noto-api';
const AUDIENCE = 'noto';

export function createAccessTokens(options: { secret: string; ttlSeconds: number }): AccessTokens {
  const key = new TextEncoder().encode(options.secret);

  return {
    async issue(claims) {
      const expiresAt = new Date(Date.now() + options.ttlSeconds * 1000);

      const token = await new SignJWT({
        sid: claims.sessionId,
        ...(claims.deviceId === null ? {} : { did: claims.deviceId }),
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(claims.userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
        .sign(key);

      return { token, expiresAt };
    },

    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          issuer: ISSUER,
          audience: AUDIENCE,
        });

        if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;

        return {
          userId: payload.sub,
          sessionId: payload.sid,
          deviceId: typeof payload.did === 'string' ? payload.did : null,
        };
      } catch {
        return null;
      }
    },
  };
}
