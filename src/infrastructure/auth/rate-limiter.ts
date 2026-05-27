import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

import type {
  RateLimitAllowed,
  RateLimitBlocked,
  RateLimitResult,
  RateLimiter,
} from './types.js';

type WindowEntry = {
  count: number;
  windowStart: number;
};

const IP_KEY_PREFIX = 'ip:';
const USER_KEY_PREFIX = 'user:';

export function buildIpRateLimitKey(ip: string): string {
  return `${IP_KEY_PREFIX}${ip}`;
}

export function buildUserRateLimitKey(userId: string): string {
  return `${USER_KEY_PREFIX}${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function peekEntry(
  store: Map<string, WindowEntry>,
  key: string,
  windowMs: number,
  maxRequests: number,
  now: number,
): RateLimitResult {
  const entry = store.get(key);

  if (entry === undefined || now - entry.windowStart >= windowMs) {
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= maxRequests) {
    const resetAt = entry.windowStart + windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count - 1,
    resetAt: entry.windowStart + windowMs,
  };
}

function incrementEntry(
  store: Map<string, WindowEntry>,
  key: string,
  windowMs: number,
  now: number,
): void {
  const entry = store.get(key);

  if (entry === undefined || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return;
  }

  entry.count += 1;
}

function pickMostRestrictiveBlocked(results: RateLimitBlocked[]): RateLimitBlocked {
  return results.reduce((mostRestrictive, current) =>
    current.retryAfterSeconds > mostRestrictive.retryAfterSeconds
      ? current
      : mostRestrictive,
  );
}

function pickMostRestrictiveAllowed(results: RateLimitAllowed[]): RateLimitAllowed {
  return results.reduce((mostRestrictive, current) =>
    current.remaining < mostRestrictive.remaining ? current : mostRestrictive,
  );
}

export function createFixedWindowRateLimiter(
  windowMs: number,
  maxRequests: number,
): RateLimiter {
  const store = new Map<string, WindowEntry>();

  return {
    check(key: string): RateLimitResult {
      return this.checkMany([key]);
    },

    checkMany(keys: readonly string[]): RateLimitResult {
      if (keys.length === 0) {
        return {
          allowed: true,
          remaining: maxRequests,
          resetAt: Date.now() + windowMs,
        };
      }

      const now = Date.now();
      const results = keys.map((key) => peekEntry(store, key, windowMs, maxRequests, now));
      const blocked = results.filter(
        (result): result is Extract<RateLimitResult, { allowed: false }> => !result.allowed,
      );

      if (blocked.length > 0) {
        return pickMostRestrictiveBlocked(blocked);
      }

      for (const key of keys) {
        incrementEntry(store, key, windowMs, now);
      }

      return pickMostRestrictiveAllowed(
        results.filter(
          (result): result is Extract<RateLimitResult, { allowed: true }> => result.allowed,
        ),
      );
    },
  };
}

export function createNoOpRateLimiter(): RateLimiter {
  const allowed: RateLimitAllowed = {
    allowed: true,
    remaining: Number.MAX_SAFE_INTEGER,
    resetAt: Date.now(),
  };

  return {
    check(_key: string): RateLimitResult {
      return allowed;
    },

    checkMany(_keys: readonly string[]): RateLimitResult {
      return allowed;
    },
  };
}

function getRequestPath(request: FastifyRequest): string {
  const url = request.url;
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

export function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first !== undefined && first.length > 0) {
      return first;
    }
  }

  return request.ip;
}

export function getUserIdFromAuthorizationHeader(
  request: FastifyRequest,
): string | undefined {
  const header = request.headers.authorization;

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return undefined;
  }

  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) {
    return undefined;
  }

  const decoded = jwt.decode(token);
  if (!isRecord(decoded)) {
    return undefined;
  }

  const sub = decoded.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub : undefined;
}

export function resolveAuthRateLimitKeys(request: FastifyRequest): string[] {
  const keys = [buildIpRateLimitKey(getClientIp(request))];
  const userId = getUserIdFromAuthorizationHeader(request);

  if (userId !== undefined) {
    keys.push(buildUserRateLimitKey(userId));
  }

  return keys;
}

export function sendRateLimitExceeded(
  reply: FastifyReply,
  result: Extract<RateLimitResult, { allowed: false }>,
): void {
  void reply
    .header('Retry-After', String(result.retryAfterSeconds))
    .status(429)
    .send({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
}

export type EarlyRateLimitOptions = {
  rateLimiter: RateLimiter;
  pathPrefix?: string;
  keyResolver?: (request: FastifyRequest) => readonly string[];
};

export function registerEarlyRateLimit(
  app: FastifyInstance,
  options: EarlyRateLimitOptions,
): void {
  const pathPrefix = options.pathPrefix ?? '/auth';
  const keyResolver = options.keyResolver ?? resolveAuthRateLimitKeys;

  app.addHook('onRequest', async (request, reply) => {
    const path = getRequestPath(request);

    if (!path.startsWith(pathPrefix)) {
      return;
    }

    const result = options.rateLimiter.checkMany(keyResolver(request));

    if (!result.allowed) {
      sendRateLimitExceeded(reply, result);
    }
  });
}
