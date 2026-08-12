import {
  DEFAULT_CORS_ORIGINS,
  PERMISSIONS_POLICY,
  buildCorsOptions,
  buildHelmetOptions,
  resolveCorsOrigins,
} from './security-headers';

describe('Security headers (Stage 22)', () => {
  it('PERMISSIONS_POLICY disables camera/mic/geo', () => {
    expect(PERMISSIONS_POLICY).toContain('camera=()');
    expect(PERMISSIONS_POLICY).toContain('microphone=()');
    expect(PERMISSIONS_POLICY).toContain('geolocation=()');
  });

  it('helmet enables HSTS, frame deny, nosniff, referrer, CSP', () => {
    const opts = buildHelmetOptions({ isProduction: true });
    expect(opts.strictTransportSecurity).toEqual(
      expect.objectContaining({
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      }),
    );
    expect(opts.frameguard).toEqual({ action: 'deny' });
    expect(opts.noSniff).toBe(true);
    expect(opts.referrerPolicy).toEqual({
      policy: 'strict-origin-when-cross-origin',
    });
    expect(opts.contentSecurityPolicy).toBeTruthy();
    const csp = opts.contentSecurityPolicy as {
      directives: Record<string, unknown>;
    };
    expect(csp.directives.defaultSrc).toContain("'self'");
    expect(csp.directives.frameAncestors).toContain("'none'");
  });

  it('resolveCorsOrigins never returns * even if env has *', () => {
    const origins = resolveCorsOrigins('*', 'production');
    expect(origins).not.toContain('*');
    expect(Array.isArray(origins)).toBe(true);
    expect(origins.length).toBeGreaterThan(0);
  });

  it('resolveCorsOrigins parses comma allowlist', () => {
    const origins = resolveCorsOrigins(
      'https://app.example.com, https://admin.example.com',
      'production',
    );
    expect(origins).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  it('resolveCorsOrigins uses defaults when empty', () => {
    expect(resolveCorsOrigins(undefined)).toEqual([...DEFAULT_CORS_ORIGINS]);
  });

  it('buildCorsOptions rejects unknown origins via callback', (done) => {
    const cors = buildCorsOptions(['https://app.example.com']);
    const originFn = cors.origin as (
      o: string | undefined,
      cb: (e: Error | null, allow?: boolean) => void,
    ) => void;

    originFn('https://evil.example.com', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(false);
      originFn('https://app.example.com', (err2, allow2) => {
        expect(err2).toBeNull();
        expect(allow2).toBe(true);
        done();
      });
    });
  });
});
