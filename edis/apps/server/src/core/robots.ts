import { URL } from 'node:url';
import { LRUCache } from 'lru-cache';
import { safeFetch } from './fetcher';

const ROBOTS_TTL = 6 * 60 * 60 * 1000; // 6 hours

interface RobotsRules {
  allow: string[];
  disallow: string[];
}

const robotsCache = new LRUCache<string, RobotsRules>({
  max: 200,
  ttl: ROBOTS_TTL,
  ttlAutopurge: true
});

const parseLine = (line: string) => {
  const [rawKey, ...rest] = line.split(':');
  if (!rawKey || rest.length === 0) return null;
  const key = rawKey.trim().toLowerCase();
  const value = rest.join(':').trim();
  return { key, value };
};

const parseRobots = (input: string): RobotsRules => {
  const rules: RobotsRules = { allow: [], disallow: [] };
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.split('#')[0]?.trim() ?? '')
    .filter((line) => line.length > 0);

  let appliesToUs = false;

  for (const raw of lines) {
    const parsed = parseLine(raw);
    if (!parsed) continue;
    const { key, value } = parsed;
    if (key === 'user-agent') {
      appliesToUs = value === '*' ? true : false;
    } else if (!appliesToUs) {
      continue;
    } else if (key === 'allow') {
      rules.allow.push(value);
    } else if (key === 'disallow') {
      rules.disallow.push(value);
    }
  }

  return rules;
};

const pathMatches = (path: string, rule: string) => {
  if (rule === '') return true;
  if (rule === '/') return path === '/' || path.startsWith('/');
  const normalizedRule = rule.endsWith('*') ? rule.slice(0, -1) : rule;
  if (normalizedRule.length === 0) return true;
  return path.startsWith(normalizedRule);
};

const isAllowed = (path: string, rules: RobotsRules) => {
  let longestAllow = '';
  let longestDisallow = '';

  for (const rule of rules.allow) {
    if (pathMatches(path, rule) && rule.length > longestAllow.length) {
      longestAllow = rule;
    }
  }

  for (const rule of rules.disallow) {
    if (pathMatches(path, rule) && rule.length > longestDisallow.length) {
      longestDisallow = rule;
    }
  }

  if (!longestDisallow) return true;
  if (!longestAllow) return false;
  return longestAllow.length >= longestDisallow.length;
};

export const canFetch = async (targetUrl: string): Promise<boolean> => {
  try {
    const url = new URL(targetUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    const origin = `${url.protocol}//${url.host}`;
    let rules = robotsCache.get(origin);
    if (!rules) {
      const robotsUrl = `${origin}/robots.txt`;
      const response = await safeFetch(robotsUrl, { method: 'GET' });
      if (!response.ok) {
        rules = { allow: [''], disallow: [] };
      } else {
        const text = await response.text();
        rules = parseRobots(text);
      }
      robotsCache.set(origin, rules, { ttl: ROBOTS_TTL });
    }
    return isAllowed(url.pathname, rules);
  } catch (error) {
    console.error('robots:failed', error);
    return false;
  }
};

export const clearRobotsCache = () => robotsCache.clear();
