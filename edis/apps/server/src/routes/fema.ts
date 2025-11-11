import { Router } from 'express';
import { z } from 'zod';
import { fetchDisasters, OpenFemaError } from '../adapters/fema';

const router = Router();

const numberFromQuery = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.floor(parsed);
};

const disasterQuerySchema = z.object({
  state: z
    .string()
    .trim()
    .min(2, { message: 'state is required' })
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{2}$/.test(value), {
      message: 'state must be a 2-letter code'
    }),
  county: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : undefined;
    }),
  since: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : undefined;
    })
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: 'since must be a valid ISO date'
    }),
  types: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const values = Array.isArray(value) ? value : value.split(',');
      const normalized = values
        .map((item) => item.trim().toUpperCase())
        .filter((item) => item.length > 0);
      return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
    }),
  limit: z
    .string()
    .optional()
    .transform((value) => numberFromQuery(value))
    .refine((value) => value === undefined || (Number.isInteger(value) && value > 0 && value <= 500), {
      message: 'limit must be between 1 and 500'
    }),
  page: z
    .string()
    .optional()
    .transform((value) => numberFromQuery(value))
    .refine((value) => value === undefined || (Number.isInteger(value) && value > 0), {
      message: 'page must be a positive integer'
    })
});

router.get('/disasters', async (req, res) => {
  const parseResult = disasterQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    const message =
      issue?.path?.[0] === 'state' && issue?.message === 'Required'
        ? 'state is required'
        : issue?.message ?? 'Invalid request';
    res.status(400).json({
      code: 'invalid_request',
      message,
      source: 'api',
      status: 400
    });
    return;
  }

  const { state, county, since, types, limit, page } = parseResult.data;

  try {
    const result = await fetchDisasters({
      state,
      county,
      since,
      types: types ?? undefined,
      limit,
      page
    });
    res.json(result);
  } catch (error) {
    if (error instanceof OpenFemaError) {
      const status = error.status ?? 502;
      res.status(status).json({
        code: error.code ?? 'openfema_error',
        message: 'We could not load FEMA incidents right now.',
        source: 'openfema',
        status
      });
      return;
    }
    res.status(500).json({
      code: 'unexpected_error',
      message: 'We could not load FEMA incidents right now.',
      source: 'openfema',
      status: 500
    });
  }
});

export default router;
