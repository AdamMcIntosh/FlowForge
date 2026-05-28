const TEST_JWT_PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\n' +
  'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCfAHRvLxFYcls4\n' +
  'YgJrWAy+Y2OKdA13kSQwmb5Tz74QdM6ei+EUHUdEDgNPUob/9ThyJpa2QkgQoCRT\n' +
  '2yYPKKKJuSQ4FqYw4u05Ky6V8GgmmvG+ghGEuH4Ks8ZIZtqf+KbmOAaf9qVccotW\n' +
  'DcHPKGPKlHzKAVpfBDgZkOwEzkOSDl3ytZC0iSE7CTASGFOBlb8rJ7oyse1qvIZU\n' +
  'vinEAOG21Ac63jmyvHMiMHlxPbdZLxufIDLpV0Xf3P/MS77YPQmGFEH3tdiglA1h\n' +
  '7tSjUZ9v4Q9rau1mh4j2l14IhG7MhY9u7fGFC/dBTsQ8kE75RHUunxC5WxYLBG1n\n' +
  '5hO5xzZdAgMBAAECggEACW2PeeBCmQn+2rMFDbRk3Q0ro9QJ0GMs0Cztmi6hSHyE\n' +
  'm+YTbIvn4+Mo0xVDp/20YSBko13+w+2a+dXuxctVB/GQcjr1k8SA6HjlBEMDCfb6\n' +
  'Cp/PxhzibGQIh9aBdCbcTp5X1jhbycWI+YtLSKtOb36qf5fg8e1gHjP3qrlITGqx\n' +
  'rPeTAFdnAU/Gm/aNn5bGaMyD2s5RyiGF2MFcB8Y+yAdN6AweIFT7wpUkGR1R7u7/\n' +
  'BIL5xBgH4Rs1e1Z1H7ba8DftU1MBCHvALtD6u0rsRngGSlLV+ovuzZXmmjDwjnv2\n' +
  'rPLHeImWo1y8C+ixPD+w/2gbJZzJ0bhLi8aG1HaYQQKBgQDZg1aZB0PohOeWFmfn\n' +
  '2kjN6aecwBwYZ6OtuB56pymLzYCLYF3F6VZxDNR2bTxgv26SAXvkpm1u4T8+x4n/\n' +
  's+ylbWCoFRjoF7ug2VF+dURzuWtaZgJ+ZI+ttlsJdr813/teP48By0SzxJxSvr/u\n' +
  'tFCfMFtw/rlchKopibx4wKVTxQKBgQC7Ir0spd2SyOu4Cl5/AxuIzV0Gb2lkMzuh\n' +
  'hReHgu7iFKr5MfxKYtHo0KfbmqO5IvrGyFS1F3KacbLLyVbc6DwwgnGfNGlEoMXv\n' +
  'MoCDFyYZ1YjC9tc4PQARbxgV2RR9V8EOvKXsvYeMarAcVdfxRQXvnPTMR+Cb+mvW\n' +
  'PjUHNejJuQKBgF/RUaab4rhdQ7+EI0WpjQTYdzPAFSBTF3GBeDvDw7OIVaYQT37N\n' +
  'qXynkDiTKlPcQJMlADTbc72ykC/RquLvmcHOCxRAJvam7cqPsSyp7/uipL3vzg1r\n' +
  'szds63Gh092hy5PbH95EcwFWDR8OVHKNEC7wGHgQXgt5jZQ6zsHK64mZAoGAaKvQ\n' +
  'plWMLtslRca+/koNr6I2oy/UAlDJzNl1xL1OwrQOwd3coPrPMGrtSN8hLp/LJz7M\n' +
  'apJX7t0jxeqzJFLdv8Bmr0cQjmti6x0TVr+u9wpCOdL5pKIyFI5QKYBHfqiD+qs4\n' +
  'H8gPNlJCeUbmxzP1UwY2wsB9eKFEigw3evYDZDkCgYEAz4zUW0DNq7hJgP6jcRRU\n' +
  'gNu/WQdLjKvF0yk9+rh53A9DipiD335JW1fKpiU6VW2DV+Xl9D2nu2EguHLD3YEj\n' +
  'tnQ9cMWAVR4G3AfJ6HCUeOywK7QGte0q70C4YgEm+e/IUl/g4PQjAPtNIqLbCIDf\n' +
  '4yLbJumimcKRkqd5NT6XI/U=\n' +
  '-----END PRIVATE KEY-----\n';

const TEST_JWT_PUBLIC_KEY =
  '-----BEGIN PUBLIC KEY-----\n' +
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnwB0by8RWHJbOGICa1gM\n' +
  'vmNjinQNd5EkMJm+U8++EHTOnovhFB1HRA4DT1KG//U4ciaWtkJIEKAkU9smDyii\n' +
  'ibkkOBamMOLtOSsulfBoJprxvoIRhLh+CrPGSGban/im5jgGn/alXHKLVg3Bzyhj\n' +
  'ypR8ygFaXwQ4GZDsBM5Dkg5d8rWQtIkhOwkwEhhTgZW/Kye6MrHtaryGVL4pxADh\n' +
  'ttQHOt45srxzIjB5cT23WS8bnyAy6VdF39z/zEu+2D0JhhRB97XYoJQNYe7Uo1Gf\n' +
  'b+EPa2rtZoeI9pdeCIRuzIWPbu3xhQv3QU7EPJBO+UR1Lp8QuVsWCwRtZ+YTucc2\n' +
  'XQIDAQAB\n' +
  '-----END PUBLIC KEY-----\n';

import { createUniqueTestDatabaseUrl } from './helpers/test-database-config.js';

process.env.DATABASE_URL ??= createUniqueTestDatabaseUrl();
process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
process.env.JWT_PRIVATE_KEY ??= TEST_JWT_PRIVATE_KEY;
process.env.JWT_PUBLIC_KEY ??= TEST_JWT_PUBLIC_KEY;
process.env.JWT_ACCESS_TOKEN_TTL_SECONDS ??= '900';
process.env.JWT_REFRESH_TOKEN_TTL_SECONDS ??= '604800';
process.env.RATE_LIMIT_WINDOW_MS ??= '60000';
process.env.RATE_LIMIT_MAX_REQUESTS ??= '10';
