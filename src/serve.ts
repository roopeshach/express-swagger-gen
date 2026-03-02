import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { SwaggerGenerator } from './generator';
import type {
  ExpressRouter,
  OpenAPIDocument,
  SwaggerGeneratorOptions,
  SwaggerServeOptions,
} from './types';

/**
 * Create middleware to serve Swagger UI
 *
 * @param document - OpenAPI document or SwaggerGenerator instance
 * @param options - Swagger UI options
 * @returns Express middleware array [serve, setup]
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { SwaggerGenerator, serveSwaggerUI } from 'zod-express-swagger';
 *
 * const app = express();
 * const router = express.Router();
 *
 * const generator = new SwaggerGenerator(router, {
 *   info: { title: 'My API', version: '1.0.0' },
 * });
 *
 * // Serve at /docs
 * app.use('/docs', ...serveSwaggerUI(generator, {
 *   customSiteTitle: 'My API Docs',
 * }));
 * ```
 */
export function serveSwaggerUI(
  document: OpenAPIDocument | SwaggerGenerator,
  options: SwaggerServeOptions = {},
): RequestHandler[] {
  const doc = document instanceof SwaggerGenerator ? document.generate() : document;

  const uiOptions: swaggerUi.SwaggerUiOptions = {
    customSiteTitle: options.customSiteTitle ?? 'API Documentation',
    customCss: options.customCss,
    customfavIcon: options.customFavIcon,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      ...options.swaggerOptions,
    },
  };

  const middlewares: RequestHandler[] = [];

  // Add basic auth if configured
  if (options.basicAuth) {
    const { username, password } = options.basicAuth;
    middlewares.push((req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="API Documentation"');
        return res.status(401).send('Authentication required');
      }

      const [scheme, credentials] = authHeader.split(' ');
      if (scheme !== 'Basic' || !credentials) {
        res.setHeader('WWW-Authenticate', 'Basic realm="API Documentation"');
        return res.status(401).send('Invalid authentication');
      }

      const decoded = Buffer.from(credentials, 'base64').toString('utf8');
      const [user, pass] = decoded.split(':');

      if (user !== username || pass !== password) {
        res.setHeader('WWW-Authenticate', 'Basic realm="API Documentation"');
        return res.status(401).send('Invalid credentials');
      }

      return next();
    });
  }

  // Add swagger UI middlewares
  middlewares.push(
    swaggerUi.serve as unknown as RequestHandler,
    swaggerUi.setup(doc, uiOptions) as unknown as RequestHandler,
  );

  return middlewares;
}

/**
 * Create a complete Swagger middleware that auto-generates docs and serves UI
 *
 * @param router - Express router to generate docs from
 * @param generatorOptions - Generator options
 * @param serveOptions - Swagger UI options
 * @returns Object with middlewares and generator
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createSwaggerMiddleware } from 'zod-express-swagger';
 *
 * const app = express();
 * const apiRouter = express.Router();
 *
 * // ... define your routes ...
 *
 * const { serve, document, generator } = createSwaggerMiddleware(apiRouter, {
 *   info: { title: 'My API', version: '1.0.0' },
 *   securitySchemes: {
 *     JWT: {
 *       type: 'http',
 *       scheme: 'bearer',
 *       bearerFormat: 'JWT',
 *     },
 *   },
 * }, {
 *   customSiteTitle: 'My API Documentation',
 *   basicAuth: { username: 'admin', password: 'secret' },
 * });
 *
 * // Serve documentation at /docs
 * app.use('/docs', ...serve);
 *
 * // Or get the raw document
 * app.get('/swagger.json', (req, res) => res.json(document));
 * ```
 */
export function createSwaggerMiddleware(
  router: Router | ExpressRouter,
  generatorOptions: SwaggerGeneratorOptions,
  serveOptions: SwaggerServeOptions = {},
): {
  serve: RequestHandler[];
  document: OpenAPIDocument;
  generator: SwaggerGenerator;
  json: RequestHandler;
  yaml: RequestHandler;
} {
  const generator = new SwaggerGenerator(router as ExpressRouter, generatorOptions);
  const document = generator.generate();
  const serve = serveSwaggerUI(document, serveOptions);

  // JSON endpoint middleware
  const json: RequestHandler = (_req: Request, res: Response) => {
    res.json(document);
  };

  // YAML endpoint middleware
  const yaml: RequestHandler = (_req: Request, res: Response) => {
    res.type('text/yaml').send(generator.toYAML());
  };

  return {
    serve,
    document,
    generator,
    json,
    yaml,
  };
}

/**
 * Quick setup for adding Swagger documentation to an Express app
 *
 * @param app - Express application
 * @param router - Router to generate docs from
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { setupSwagger } from 'zod-express-swagger';
 *
 * const app = express();
 * const router = express.Router();
 *
 * // ... define your routes ...
 *
 * setupSwagger(app, router, {
 *   docsPath: '/docs',
 *   jsonPath: '/swagger.json',
 *   yamlPath: '/swagger.yaml',
 *   generator: {
 *     info: { title: 'My API', version: '1.0.0' },
 *   },
 *   serve: {
 *     customSiteTitle: 'My API Docs',
 *   },
 * });
 * ```
 */
export function setupSwagger(
  app: { use: (path: string, ...handlers: RequestHandler[]) => void; get: (path: string, handler: RequestHandler) => void },
  router: Router | ExpressRouter,
  options: {
    docsPath?: string;
    jsonPath?: string;
    yamlPath?: string;
    generator: SwaggerGeneratorOptions;
    serve?: SwaggerServeOptions;
  },
): {
  document: OpenAPIDocument;
  generator: SwaggerGenerator;
} {
  const { serve, document, generator, json, yaml } = createSwaggerMiddleware(
    router,
    options.generator,
    options.serve,
  );

  const docsPath = options.docsPath ?? '/docs';
  const jsonPath = options.jsonPath ?? '/swagger.json';
  const yamlPath = options.yamlPath ?? '/swagger.yaml';

  app.use(docsPath, ...serve);
  app.get(jsonPath, json);
  app.get(yamlPath, yaml);

  return { document, generator };
}
