// Core Types
export type { SwaggerMeta, SwaggerTaggedMiddleware } from './types';
export type { Endpoint, ExpressRouter, ExpressLayer, ExpressRoute } from './types';
export type {
  SwaggerParameter,
  SwaggerResponse,
  SwaggerRequestBody,
  SwaggerOperation,
  JsonSchemaObject,
  OpenAPIDocument,
  OpenAPIInfo,
  OpenAPISecurityScheme,
  SwaggerGeneratorOptions,
  SwaggerServeOptions,
  TagMapping,
} from './types';

// Validation Middlewares
export {
  validateBody,
  validateParams,
  validateQuery,
  validateResponse,
} from './validators';

// Generator
export { SwaggerGenerator } from './generator';

// Express Middleware for serving docs
export { serveSwaggerUI, createSwaggerMiddleware } from './serve';

// Utilities
export {
  extractEndpoints,
  normalizePath,
  collectSwaggerMeta,
  buildParametersFromSchema,
  buildRequestBody,
  buildResponse,
  toJsonSchemaObject,
  toJsonSchemaRecord,
} from './utils';

// Default export for convenience
export { SwaggerGenerator as default } from './generator';
