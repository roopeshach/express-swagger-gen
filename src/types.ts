import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

// ============================================
// Swagger Metadata Types
// ============================================

/**
 * Metadata attached to validation middlewares for Swagger generation
 */
export type SwaggerMeta = {
  /** Where the schema belongs */
  in: 'body' | 'query' | 'params' | 'response';
  /** The Zod schema instance */
  schema: ZodTypeAny;
  /** Optional configuration */
  opts?: { path?: string };
};

/**
 * A middleware function with optional Swagger metadata
 */
export type SwaggerTaggedMiddleware = RequestHandler & {
  __swagger?: SwaggerMeta;
};

/**
 * Generic middleware function type
 */
export type ExpressMiddleware = (...args: unknown[]) => unknown;

// ============================================
// Express Router Types (Internal)
// ============================================

export type ExpressKey = { name: string } | string;

export type ExpressRegExp = {
  source?: string;
  fast_slash?: boolean;
};

export type ExpressRoute = {
  path: string;
  methods: Record<string, boolean>;
  stack: { handle: ExpressMiddleware }[];
};

export type ExpressLayer = {
  path?: string;
  regexp?: ExpressRegExp;
  keys?: ExpressKey[];
  handle?: unknown;
  name?: string;
  route?: ExpressRoute;
};

export type ExpressRouter = {
  stack?: (ExpressLayer | unknown)[];
};

// ============================================
// Discovered Endpoint Type
// ============================================

/**
 * A discovered route endpoint from Express router traversal
 */
export type Endpoint = {
  /** HTTP method (get, post, put, delete, etc.) */
  method: string;
  /** Full route path (before normalization) */
  path: string;
  /** Middleware chain for this route */
  middlewares: ExpressMiddleware[];
};

// ============================================
// OpenAPI Types
// ============================================

export type JsonSchemaObject = {
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
};

export type SwaggerParameter = {
  name: string;
  in: 'query' | 'path';
  required: boolean;
  schema: Record<string, unknown>;
  description?: string;
};

export type SwaggerResponse = {
  description: string;
  content?: Record<string, { schema: Record<string, unknown> }>;
};

export type SwaggerRequestBody = {
  required: boolean;
  content: Record<string, { schema: Record<string, unknown> }>;
};

export type SwaggerOperation = {
  tags: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: SwaggerParameter[];
  requestBody?: SwaggerRequestBody;
  responses: Record<string, SwaggerResponse>;
  security?: Record<string, string[]>[];
};

export type OpenAPISecurityScheme = {
  type: 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';
  scheme?: string;
  bearerFormat?: string;
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  description?: string;
};

export type OpenAPIInfo = {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
};

export type OpenAPIDocument = {
  openapi: '3.0.0' | '3.0.1' | '3.0.2' | '3.0.3' | '3.1.0';
  info: OpenAPIInfo;
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, SwaggerOperation>>;
  components?: {
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
    schemas?: Record<string, unknown>;
    parameters?: Record<string, SwaggerParameter>;
  };
  tags?: Array<{ name: string; description?: string }>;
  security?: Record<string, string[]>[];
};

// ============================================
// Generator Options
// ============================================

/**
 * Mapping of path segments to tag names
 */
export type TagMapping = Record<string, string>;

/**
 * Options for the Swagger generator
 */
export type SwaggerGeneratorOptions = {
  /** OpenAPI document info */
  info: OpenAPIInfo;
  
  /** OpenAPI version (default: '3.0.0') */
  openApiVersion?: OpenAPIDocument['openapi'];
  
  /** API servers */
  servers?: OpenAPIDocument['servers'];
  
  /** Security schemes */
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
  
  /** Global security requirements */
  security?: Record<string, string[]>[];
  
  /** Middleware names that indicate authentication is required */
  securityMiddlewares?: string[];
  
  /** Custom tag mapping for path segments */
  tagMappings?: TagMapping;
  
  /** Nested tag mappings (e.g., for workspace/feature paths) */
  nestedTagMappings?: Record<string, TagMapping>;
  
  /** Base path prefix to strip from generated paths */
  basePath?: string;
  
  /** Extra endpoints to include (e.g., webhooks, health checks) */
  extraEndpoints?: Array<{ method: string; path: string; middlewares?: ExpressMiddleware[] }>;
  
  /** Endpoints to exclude from generation */
  excludeEndpoints?: Array<{ method: string; path: string }>;
  
  /** Output path for YAML file (if using file generation) */
  outputPath?: string;
  
  /** Enable verbose logging */
  verbose?: boolean;
};

/**
 * Options for serving Swagger UI
 */
export type SwaggerServeOptions = {
  /** Custom site title */
  customSiteTitle?: string;
  
  /** Custom CSS */
  customCss?: string;
  
  /** Custom favicon URL */
  customFavIcon?: string;
  
  /** Swagger UI options */
  swaggerOptions?: {
    /** Persist authorization across browser sessions */
    persistAuthorization?: boolean;
    /** Display request duration */
    displayRequestDuration?: boolean;
    /** Doc expansion (none, list, full) */
    docExpansion?: 'none' | 'list' | 'full';
    /** Filter */
    filter?: boolean;
    /** Show extensions */
    showExtensions?: boolean;
    /** Show common extensions */
    showCommonExtensions?: boolean;
    [key: string]: unknown;
  };
  
  /** Basic auth for protecting docs */
  basicAuth?: {
    username: string;
    password: string;
  };
};
