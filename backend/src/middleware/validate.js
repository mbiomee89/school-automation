import { z } from 'zod';

function overwriteRequestProperty(req, key, value) {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** Validate req.body with a Zod schema; replaces req.body with parsed data. */
export function validateBody(schema) {
  return (req, _res, next) => {
    overwriteRequestProperty(req, 'body', schema.parse(req.body));
    next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    // Express 5: req.query is a getter-only — must redefine the property
    overwriteRequestProperty(req, 'query', schema.parse(req.query));
    next();
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    overwriteRequestProperty(req, 'params', schema.parse(req.params));
    next();
  };
}

export const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const studentIdParam = z.object({
  id: z.string().min(1),
});
