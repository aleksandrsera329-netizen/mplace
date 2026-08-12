import { GLOBAL_THROTTLE, ThrottleLimits } from './throttle.limits';

describe('ThrottleLimits (Stage 23)', () => {
  it('global baseline is 120 / min', () => {
    expect(GLOBAL_THROTTLE.name).toBe('default');
    expect(GLOBAL_THROTTLE.limit).toBe(120);
    expect(GLOBAL_THROTTLE.ttl).toBe(60_000);
  });

  it('matches TZ critical endpoint limits', () => {
    expect(ThrottleLimits.LOGIN.default).toEqual({
      limit: 5,
      ttl: 15 * 60 * 1000,
    });
    expect(ThrottleLimits.PASSWORD_RESET.default).toEqual({
      limit: 3,
      ttl: 60 * 60 * 1000,
    });
    expect(ThrottleLimits.MFA.default).toEqual({
      limit: 5,
      ttl: 10 * 60 * 1000,
    });
    expect(ThrottleLimits.REGISTER.default).toEqual({
      limit: 5,
      ttl: 60 * 60 * 1000,
    });
    expect(ThrottleLimits.RFQ_CREATE.default).toEqual({
      limit: 10,
      ttl: 60 * 60 * 1000,
    });
    expect(ThrottleLimits.PAYMENT.default).toEqual({
      limit: 10,
      ttl: 15 * 60 * 1000,
    });
    expect(ThrottleLimits.UPLOAD.default).toEqual({
      limit: 20,
      ttl: 60 * 60 * 1000,
    });
    expect(ThrottleLimits.SEARCH.default).toEqual({
      limit: 60,
      ttl: 60 * 1000,
    });
  });
});
