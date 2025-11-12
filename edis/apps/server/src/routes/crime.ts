import { Router } from 'express';
import etag from 'etag';
import { LRUCache } from 'lru-cache';
import { CrimeDTO } from '../core/types';
import * as ukPolice from '../adapters/crime/ukPolice';
import * as lessCrime from '../adapters/crime/lessCrime';
import * as fbiCrime from '../adapters/crime/fbiCrime';

const cache = new LRUCache<string, CrimeDTO | { message: string }>({ max: 200, ttl: 1000 * 60 * 10 });

const STATE_ABBR: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY'
};

const router = Router();

router.get('/', async (req, res) => {
  const { country, lat, lon, admin1 } = req.query as Record<string, string>;
  if (!lat || !lon) {
    res.status(400).json({ message: 'lat and lon are required', status: 400 });
    return;
  }
  const cacheKey = JSON.stringify({ country, lat, lon, admin1 });
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    const body = JSON.stringify(cached);
    const tag = etag(body);
    if (req.headers['if-none-match'] === tag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', tag);
    res.json(cached);
    return;
  }

  try {
    let payload: CrimeDTO | { message: string };
    if ((country ?? '').toUpperCase() === 'UK') {
      payload = await ukPolice.getCrime(Number(lat), Number(lon));
    } else if ((country ?? '').toUpperCase() === 'US') {
      if (!admin1) {
        payload = { message: 'We need a state to look up US crime stats.' };
      } else {
        const stateCode = STATE_ABBR[admin1] ?? admin1.toUpperCase();
        try {
          payload = await lessCrime.getCrimeForState(stateCode);
        } catch (lessCrimeError) {
          console.error('crime:lesscrime', lessCrimeError);
          try {
            payload = await fbiCrime.getCrimeForState(stateCode);
          } catch (fbiError) {
            console.error('crime:fbi', fbiError);
            payload = {
              message: 'U.S. crime data is unavailable right now. Please try again later.'
            };
          }
        }
      }
    } else {
      payload = { message: 'Crime data is only available for the UK and US in this MVP.' };
    }
    cache.set(cacheKey, payload);
    const body = JSON.stringify(payload);
    const tag = etag(body);
    if (req.headers['if-none-match'] === tag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', tag);
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load crime data', status: 500, retryable: true });
  }
});

export default router;
