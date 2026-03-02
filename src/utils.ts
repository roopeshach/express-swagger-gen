import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type {
  Endpoint,
  ExpressKey,
  ExpressLayer,
  ExpressMiddleware,
  ExpressRouter,
  JsonSchemaObject,
  SwaggerMeta,
  SwaggerParameter,
  SwaggerRequestBody,
  SwaggerResponse,
  SwaggerTaggedMiddleware,
} from './types';

// ============================================
// Path Utilities
// ============================================

/**
 * Normalize Express path params to OpenAPI format
 * Converts `:param` to `{param}`
 */
export const normalizePath = (value: string): string =>
  value.replace(/:([^/]+)/g, '{$1}');

const splitPathSegments = (value: string): string[] =>
  value.split('/').filter(Boolean);

const stripCommonPrefix = (base: string, next: string): string => {
  if (!next.startsWith('/')) {
    return next;
  }

  const baseSegments = splitPathSegments(base);
  const nextSegments = splitPathSegments(next);

  if (baseSegments.length === 0 || nextSegments.length === 0) {
    return next;
  }

  let index = 0;
  const minLen = Math.min(baseSegments.length, nextSegments.length);
  while (index < minLen && baseSegments[index] === nextSegments[index]) {
    index++;
  }

  return index === 0 ? next : `/${nextSegments.slice(index).join('/')}`;
};

const joinPaths = (base: string, next: string): string => {
  const basePath = base.endsWith('/') ? base.slice(0, -1) : base;
  const nextInput = next.startsWith('/') ? next : `/${next}`;
  const nextPath = stripCommonPrefix(basePath, nextInput);

  if (!basePath) {
    return nextPath === '/' ? '' : nextPath;
  }
  if (nextPath === '/') {
    return basePath;
  }

  return basePath + nextPath;
};

const isPathPrefix = (prefix: string, full: string): boolean => {
  if (prefix === '' || prefix === '/') {
    return true;
  }
  if (prefix === full) {
    return true;
  }

  return full.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
};

// ============================================
// Regex Utilities - Optimized
// ============================================

/** Combined regex patterns for Express path param extraction */
const PARAM_GROUP_PATTERNS = /\(\?:\/\(\[\^\/]\+\?\)\)|\(\?:\/\(\[\^\/]\+\)\)|\/\(\[\^\/]\+\?\)|\/\(\[\^\/]\+\)|\(\[\^\/]\+\?\)|\(\[\^\/]\+\)|\(\?:\[\^\/]\+\?\)|\(\?:\[\^\/]\+\)/g;

/** Characters to strip from regex source */
const CLEANUP_PATTERN = /\(\?:|\)|\?|\||\\|\/+/g;

/**
 * Extract path from Express layer regex
 */
const getLayerPath = (layer: ExpressLayer): string | null => {
  if (layer.path) {
    return layer.path;
  }
  if (layer.regexp?.fast_slash) {
    return '';
  }
  if (!layer.regexp?.source) {
    return null;
  }

  const keys = Array.isArray(layer.keys) ? layer.keys : [];
  let keyIndex = 0;

  // Remove anchors and Express suffix in one pass
  let source = layer.regexp.source
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)/g, '')
    .replace(/\(\?=\\\/\|\$\)/g, '');

  // Replace param groups with :paramName
  source = source.replace(PARAM_GROUP_PATTERNS, (match) => {
    const key = keys[keyIndex++];
    const paramName = typeof key === 'string' ? key : key?.name ?? 'param';
    return match.startsWith('/') || match.includes('/') ? `/:${paramName}` : `:${paramName}`;
  });

  // Unescape and cleanup
  source = source
    .replace(/\\\//g, '/')
    .replace(/\\\./g, '.')
    .replace(CLEANUP_PATTERN, (char) => char === '/' ? '/' : '');

  // Normalize slashes
  source = source.replace(/\/+/g, '/');
  
  if (!source.startsWith('/')) {
    source = `/${source}`;
  }
  if (source !== '/' && source.endsWith('/')) {
    source = source.slice(0, -1);
  }

  return source === '/?' ? '' : source;
};

// ============================================
// Middleware Detection
// ============================================

const isSwaggerTaggedMiddleware = (
  middleware: unknown,
): middleware is SwaggerTaggedMiddleware =>
  typeof middleware === 'function' && '__swagger' in middleware;

const isRouterHandle = (value: unknown): value is ExpressRouter =>
  typeof value === 'function' && Array.isArray((value as ExpressRouter).stack);

// ============================================
// Swagger Meta Collection - Optimized
// ============================================

/**
 * Collect Swagger metadata from middleware chain
 */
export const collectSwaggerMeta = (
  middlewares: ExpressMiddleware[],
): SwaggerMeta[] => {
  const result: SwaggerMeta[] = [];
  for (const middleware of middlewares) {
    const tagged = middleware as unknown as SwaggerTaggedMiddleware;
    if (isSwaggerTaggedMiddleware(tagged) && tagged.__swagger) {
      result.push(tagged.__swagger);
    }
  }
  return result;
};

/**
 * Collect Swagger metadata as a map for O(1) lookup
 */
export const collectSwaggerMetaMap = (
  middlewares: ExpressMiddleware[],
): Map<SwaggerMeta['in'], SwaggerMeta> => {
  const map = new Map<SwaggerMeta['in'], SwaggerMeta>();
  for (const middleware of middlewares) {
    const tagged = middleware as unknown as SwaggerTaggedMiddleware;
    if (isSwaggerTaggedMiddleware(tagged) && tagged.__swagger) {
      map.set(tagged.__swagger.in, tagged.__swagger);
    }
  }
  return map;
};

// ============================================
// Schema Conversion
// ============================================

const zodToJsonSchemaSafe = zodToJsonSchema as unknown as (
  schema: ZodTypeAny,
  options: unknown,
) => unknown;

/**
 * Convert Zod schema to JSON Schema object
 */
export const toJsonSchemaObject = (schema: ZodTypeAny): JsonSchemaObject =>
  zodToJsonSchemaSafe(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as JsonSchemaObject;

/**
 * Convert Zod schema to JSON Schema record
 */
export const toJsonSchemaRecord = (
  schema: ZodTypeAny,
): Record<string, unknown> =>
  zodToJsonSchemaSafe(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, unknown>;

/**
 * Build OpenAPI parameters from Zod schema
 */
export const buildParametersFromSchema = (
  schema: ZodTypeAny | undefined,
  location: 'query' | 'path',
): SwaggerParameter[] => {
  if (!schema) {
    return [];
  }
  const json = toJsonSchemaObject(schema);
  const properties = json.properties ?? {};
  const required = new Set<string>(json.required ?? []);

  return Object.entries(properties).map(([name, propSchema]) => ({
    name,
    in: location,
    required: location === 'path' ? true : required.has(name),
    schema: propSchema ?? {},
  }));
};

/**
 * Build OpenAPI request body from Zod schema
 */
export const buildRequestBody = (
  schema: ZodTypeAny | undefined,
): SwaggerRequestBody | undefined => {
  if (!schema) {
    return undefined;
  }
  const json = toJsonSchemaRecord(schema);

  return {
    required: true,
    content: {
      'application/json': {
        schema: json,
      },
    },
  };
};

/**
 * Build OpenAPI response from Zod schema
 */
export const buildResponse = (
  schema: ZodTypeAny | undefined,
): SwaggerResponse => {
  if (!schema) {
    return { description: 'OK' };
  }
  const json = toJsonSchemaRecord(schema);

  return {
    description: 'OK',
    content: {
      'application/json': {
        schema: json,
      },
    },
  };
};

// ============================================
// Endpoint Extraction
// ============================================

/**
 * Extract all endpoints from an Express router recursively
 */
export const extractEndpoints = (
  router: ExpressRouter,
  basePath = '',
  inherited: ExpressMiddleware[] = [],
): Endpoint[] => {
  const endpoints: Endpoint[] = [];
  const pathMiddlewares = new Map<string, ExpressMiddleware[]>();

  for (const layer of router.stack ?? []) {
    const typedLayer = layer as ExpressLayer;
    const layerPath = getLayerPath(typedLayer);
    const fullLayerPath =
      layerPath === null ? null : joinPaths(basePath, layerPath);

    // Collect swagger-tagged middlewares from router.use()
    if (
      !typedLayer.route &&
      isSwaggerTaggedMiddleware(typedLayer.handle) &&
      fullLayerPath !== null
    ) {
      const list = pathMiddlewares.get(fullLayerPath) ?? [];
      list.push(typedLayer.handle as ExpressMiddleware);
      pathMiddlewares.set(fullLayerPath, list);
    }

    // Handle mounted routers
    if (typedLayer.handle && isRouterHandle(typedLayer.handle)) {
      const mountPath = layerPath ?? '';
      const fullMountPath = joinPaths(basePath, mountPath);
      const inheritedForChild = [
        ...inherited,
        ...(pathMiddlewares.get(fullMountPath) ?? []),
      ];
      endpoints.push(
        ...extractEndpoints(
          typedLayer.handle,
          fullMountPath,
          inheritedForChild,
        ),
      );
      continue;
    }

    // Handle route definitions
    if (typedLayer.route?.path) {
      const routePaths = Array.isArray(typedLayer.route.path)
        ? typedLayer.route.path.map((routePath) =>
            joinPaths(basePath, String(routePath)),
          )
        : [joinPaths(basePath, String(typedLayer.route.path))];
      const routeMiddlewares = typedLayer.route.stack.map(
        (stackLayer) => stackLayer.handle,
      );

      for (const routePath of routePaths) {
        const inheritedFromUse = [...pathMiddlewares.entries()]
          .filter(([mwPath]) => isPathPrefix(mwPath, routePath))
          .flatMap(([, mws]) => mws);

        for (const method of Object.keys(typedLayer.route.methods || {})) {
          endpoints.push({
            method,
            path: routePath,
            middlewares: [
              ...inherited,
              ...inheritedFromUse,
              ...routeMiddlewares,
            ],
          });
        }
      }
    }
  }

  return endpoints;
};

// ============================================
// Deep Merge Utility
// ============================================

type JSONValue = string | number | boolean | null | JSONObject | JSONValue[];
type JSONObject = { [key: string]: JSONValue };

/**
 * Deep merge objects
 */
export function mergeDeep(
  target: JSONObject,
  ...sources: JSONObject[]
): JSONObject {
  if (!sources.length) {
    return target;
  }
  const source = sources.shift();

  if (
    typeof target !== 'object' ||
    typeof source !== 'object' ||
    !target ||
    !source
  ) {
    return target;
  }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) {
          target[key] = {};
        }
        mergeDeep(target[key] as JSONObject, source[key] as JSONObject);
      } else {
        target[key] = source[key];
      }
    }
  }

  return mergeDeep(target, ...sources);
}
