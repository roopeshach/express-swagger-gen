import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, AnyZodObject } from 'zod';

import type { SwaggerMeta, SwaggerTaggedMiddleware } from './types';

/**
 * Options for response validation
 */
export type ValidateResponseOptions = {
  /**
   * If provided, validates the given top-level property of the response object.
   * Example: `path: 'data'` will validate `resBody.data` but return the original
   * response object `{ message, data: validatedData }`.
   */
  path?: string;
};

/**
 * Attach Swagger metadata to a middleware for auto-generation
 */
const attachSwaggerMeta = (
  middleware: RequestHandler,
  meta: SwaggerMeta,
): SwaggerTaggedMiddleware => {
  const tagged = middleware as SwaggerTaggedMiddleware;
  tagged.__swagger = meta;
  return tagged;
};

/**
 * Validate the request body against a Zod schema.
 * The schema is also used for Swagger documentation generation.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { validateBody } from 'zod-express-swagger';
 *
 * const CreateUserSchema = z.object({
 *   name: z.string(),
 *   email: z.string().email(),
 * });
 *
 * router.post('/users', validateBody(CreateUserSchema), createUser);
 * ```
 */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  const middleware: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      return next(error);
    }
  };

  return attachSwaggerMeta(middleware, { in: 'body', schema });
}

/**
 * Validate request params against a Zod schema.
 * The schema is also used for Swagger documentation generation.
 *
 * @param schema - Zod object schema to validate against
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { validateParams } from 'zod-express-swagger';
 *
 * const UserParamsSchema = z.object({
 *   userId: z.string().uuid(),
 * });
 *
 * router.get('/users/:userId', validateParams(UserParamsSchema), getUser);
 * ```
 */
export function validateParams(schema: AnyZodObject): RequestHandler {
  const middleware: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    try {
      schema.parse(req.params);
      return next();
    } catch (error) {
      return next(error);
    }
  };

  return attachSwaggerMeta(middleware, { in: 'params', schema });
}

/**
 * Validate request query parameters against a Zod schema.
 * The schema is also used for Swagger documentation generation.
 *
 * @param schema - Zod object schema to validate against
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { validateQuery } from 'zod-express-swagger';
 *
 * const PaginationSchema = z.object({
 *   page: z.string().optional().transform(Number),
 *   limit: z.string().optional().transform(Number),
 * });
 *
 * router.get('/users', validateQuery(PaginationSchema), listUsers);
 * ```
 */
export function validateQuery(schema: AnyZodObject): RequestHandler {
  const middleware: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    try {
      req.query = schema.parse(req.query);
      return next();
    } catch (error) {
      return next(error);
    }
  };

  return attachSwaggerMeta(middleware, { in: 'query', schema });
}

/**
 * Validate response bodies for documentation purposes.
 * If `opts.path` is provided, validates that nested property.
 *
 * @param schema - Zod schema to validate
 * @param opts - Options (e.g., `path` to validate nested property)
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { validateResponse } from 'zod-express-swagger';
 *
 * const UserResponseSchema = z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   email: z.string(),
 * });
 *
 * router.get('/users/:userId',
 *   validateResponse(UserResponseSchema, { path: 'data' }),
 *   getUser
 * );
 * ```
 */
export function validateResponse(
  schema: ZodTypeAny,
  opts?: ValidateResponseOptions,
): RequestHandler {
  const path = opts?.path;

  const middleware: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const originalJson = res.json.bind(res);

    res.json = function (data: unknown): Response {
      try {
        const target =
          path && data && typeof data === 'object'
            ? (data as Record<string, unknown>)[path]
            : data;
        const validated = schema.parse(target);

        if (path && data && typeof data === 'object') {
          (data as Record<string, unknown>)[path] = validated;
          return originalJson(data);
        }

        return originalJson(validated);
      } catch (error) {
        next(error);
        return this;
      }
    };

    return next();
  };

  return attachSwaggerMeta(middleware, { in: 'response', schema, opts });
}

/**
 * Create a custom tagged middleware for Swagger documentation.
 * Use this when you have existing middleware that you want to document.
 *
 * @param middleware - Existing Express middleware
 * @param meta - Swagger metadata to attach
 * @returns Tagged middleware
 *
 * @example
 * ```typescript
 * import { tagMiddleware } from 'zod-express-swagger';
 *
 * const myExistingMiddleware = (req, res, next) => { ... };
 *
 * router.post('/upload',
 *   tagMiddleware(myExistingMiddleware, {
 *     in: 'body',
 *     schema: UploadSchema,
 *   }),
 *   handleUpload
 * );
 * ```
 */
export function tagMiddleware(
  middleware: RequestHandler,
  meta: SwaggerMeta,
): SwaggerTaggedMiddleware {
  return attachSwaggerMeta(middleware, meta);
}
