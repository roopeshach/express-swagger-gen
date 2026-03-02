import fs from 'fs';
import path from 'path';

import YAML from 'yaml';

import type {
  Endpoint,
  ExpressMiddleware,
  ExpressRouter,
  OpenAPIDocument,
  SwaggerGeneratorOptions,
  SwaggerOperation,
  TagMapping,
} from './types';
import {
  buildParametersFromSchema,
  buildRequestBody,
  buildResponse,
  collectSwaggerMeta,
  extractEndpoints,
  normalizePath,
} from './utils';

const ONE = 1;
const TWO = 2;
const ZERO = 0;

/**
 * SwaggerGenerator - Auto-generate OpenAPI 3.0 documentation from Express routes
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { SwaggerGenerator } from 'zod-express-swagger';
 *
 * const app = express();
 * const router = express.Router();
 *
 * // ... define routes with validation middlewares ...
 *
 * const generator = new SwaggerGenerator(router, {
 *   info: {
 *     title: 'My API',
 *     version: '1.0.0',
 *   },
 * });
 *
 * // Get the OpenAPI document
 * const document = generator.generate();
 *
 * // Or write to file
 * generator.generateToFile('./docs/swagger.yaml');
 * ```
 */
export class SwaggerGenerator {
  private router: ExpressRouter;
  private options: SwaggerGeneratorOptions;
  private securityMiddlewares: Set<string>;

  constructor(router: ExpressRouter, options: SwaggerGeneratorOptions) {
    this.router = router;
    this.options = {
      openApiVersion: '3.0.0',
      securityMiddlewares: ['verifyAuthorization', 'authenticate', 'auth', 'requireAuth'],
      ...options,
    };
    this.securityMiddlewares = new Set(this.options.securityMiddlewares);
  }

  /**
   * Derive tag from path based on configured mappings
   */
  private deriveTag(pathValue: string): string {
    const segments = pathValue.replace(/^\//, '').split('/');
    const root = segments[ZERO] ?? '';

    // Check for nested tag mappings (e.g., workspace/feature)
    if (this.options.nestedTagMappings?.[root]) {
      const nestedMapping = this.options.nestedTagMappings[root];
      const feature = segments[TWO] ?? segments[ONE] ?? '';

      if (feature && nestedMapping[feature]) {
        return nestedMapping[feature];
      }

      // Default nested tag format
      if (feature) {
        return `${this.capitalize(root)} ${this.capitalize(feature)}`;
      }

      return this.capitalize(root);
    }

    // Check root tag mappings
    if (this.options.tagMappings?.[root]) {
      return this.options.tagMappings[root];
    }

    // Default: capitalize root
    return this.capitalize(root || 'root');
  }

  private capitalize(str: string): string {
    return str
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Check if endpoint requires authentication based on middleware names
   */
  private hasSecurityMiddleware(
    middlewares: ExpressMiddleware[],
  ): boolean {
    return middlewares.some((mw) => this.securityMiddlewares.has(mw.name));
  }

  /**
   * Build the complete OpenAPI document
   */
  private buildSwagger(): OpenAPIDocument {
    const extraEndpoints = (this.options.extraEndpoints ?? []).map((ep) => ({
      method: ep.method,
      path: ep.path,
      middlewares: ep.middlewares ?? [],
    }));

    const excludeSet = new Set(
      (this.options.excludeEndpoints ?? []).map(
        (ep) => `${ep.method.toUpperCase()} ${ep.path}`,
      ),
    );

    const allEndpoints = [
      ...extractEndpoints(this.router),
      ...extraEndpoints,
    ].filter(
      (ep) => !excludeSet.has(`${ep.method.toUpperCase()} ${ep.path}`),
    );

    const paths: Record<string, Record<string, SwaggerOperation>> = {};

    for (const endpoint of allEndpoints) {
      const normalizedPath = normalizePath(endpoint.path);
      const swaggerMeta = collectSwaggerMeta(endpoint.middlewares);

      const bodySchema = swaggerMeta.find((meta) => meta.in === 'body')?.schema;
      const querySchema = swaggerMeta.find((meta) => meta.in === 'query')?.schema;
      const paramsSchema = swaggerMeta.find((meta) => meta.in === 'params')?.schema;
      const responseSchema = swaggerMeta.find((meta) => meta.in === 'response')?.schema;

      const pathParams = buildParametersFromSchema(paramsSchema, 'path');
      const queryParams = buildParametersFromSchema(querySchema, 'query');

      // Infer path params from URL pattern
      const inferredParams = Array.from(
        normalizedPath.matchAll(/\{([^}]+)\}/g),
      ).map((match) => ({
        name: match[ONE],
        in: 'path' as const,
        required: true,
        schema: { type: 'string' },
      }));

      const parameters = [...pathParams, ...queryParams];
      for (const inferred of inferredParams) {
        if (
          !parameters.some(
            (param) => param.name === inferred.name && param.in === 'path',
          )
        ) {
          parameters.push(inferred);
        }
      }

      if (!paths[normalizedPath]) {
        paths[normalizedPath] = {};
      }

      const operation: SwaggerOperation = {
        tags: [this.deriveTag(normalizedPath)],
        parameters: parameters.length ? parameters : undefined,
        requestBody: buildRequestBody(bodySchema),
        responses: {
          '200': buildResponse(responseSchema),
        },
      };

      // Add security if required
      if (this.hasSecurityMiddleware(endpoint.middlewares)) {
        const securitySchemeNames = Object.keys(
          this.options.securitySchemes ?? { JWT: {} },
        );
        operation.security = securitySchemeNames.map((name) => ({ [name]: [] }));
      }

      paths[normalizedPath][endpoint.method] = operation;
    }

    // Build unique tags array
    const uniqueTags = Array.from(
      new Set(
        Object.values(paths).flatMap((methods) =>
          Object.values(methods).flatMap((op) => op.tags),
        ),
      ),
    ).map((name) => ({ name }));

    const document: OpenAPIDocument = {
      openapi: this.options.openApiVersion!,
      info: this.options.info,
      paths,
      tags: uniqueTags,
    };

    // Add servers if provided
    if (this.options.servers) {
      document.servers = this.options.servers;
    }

    // Add components
    if (this.options.securitySchemes) {
      document.components = {
        securitySchemes: this.options.securitySchemes,
      };
    }

    // Add global security
    if (this.options.security) {
      document.security = this.options.security;
    }

    return document;
  }

  /**
   * Generate the OpenAPI document
   */
  generate(): OpenAPIDocument {
    return this.buildSwagger();
  }

  /**
   * Generate OpenAPI document as JSON string
   */
  toJSON(pretty = true): string {
    const doc = this.generate();
    return pretty ? JSON.stringify(doc, null, 2) : JSON.stringify(doc);
  }

  /**
   * Generate OpenAPI document as YAML string
   */
  toYAML(): string {
    const doc = this.generate();
    return YAML.stringify(doc);
  }

  /**
   * Write OpenAPI document to file
   *
   * @param outputPath - Path to write the file (supports .json and .yaml/.yml)
   */
  generateToFile(outputPath?: string): void {
    const filePath = outputPath ?? this.options.outputPath;

    if (!filePath) {
      throw new Error('Output path is required. Provide it as argument or in options.');
    }

    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);

    // Create directory if it doesn't exist
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      fs.writeFileSync(resolvedPath, this.toJSON(), 'utf8');
    } else {
      fs.writeFileSync(resolvedPath, this.toYAML(), 'utf8');
    }

    if (this.options.verbose) {
      console.log(`Swagger documentation generated: ${resolvedPath}`);
    }
  }

  /**
   * Verify generated swagger against actual routes
   *
   * @returns Verification report
   */
  verify(): {
    totalRoutes: number;
    totalSwaggerEndpoints: number;
    missingInSwagger: string[];
    extraInSwagger: string[];
  } {
    const doc = this.generate();
    const routerEndpoints = extractEndpoints(this.router);

    const swaggerEndpoints = new Set<string>();
    for (const [pathValue, methods] of Object.entries(doc.paths)) {
      for (const method of Object.keys(methods)) {
        swaggerEndpoints.add(`${method.toUpperCase()} ${pathValue}`);
      }
    }

    const routerEndpointKeys = new Set(
      routerEndpoints.map(
        (ep) => `${ep.method.toUpperCase()} ${normalizePath(ep.path)}`,
      ),
    );

    const missingInSwagger = [...routerEndpointKeys].filter(
      (key) => !swaggerEndpoints.has(key),
    );
    const extraInSwagger = [...swaggerEndpoints].filter(
      (key) => !routerEndpointKeys.has(key),
    );

    return {
      totalRoutes: routerEndpointKeys.size,
      totalSwaggerEndpoints: swaggerEndpoints.size,
      missingInSwagger,
      extraInSwagger,
    };
  }
}

/**
 * Create a SwaggerGenerator instance
 *
 * @param router - Express router to generate docs from
 * @param options - Generator options
 * @returns SwaggerGenerator instance
 */
export function createSwaggerGenerator(
  router: ExpressRouter,
  options: SwaggerGeneratorOptions,
): SwaggerGenerator {
  return new SwaggerGenerator(router, options);
}
