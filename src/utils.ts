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
// Constants
// ============================================

const ZERO = 0;
const ONE = 1;
const NEGATIVE_ONE = -1;

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
  value.split('/').filter((segment) => segment.length > ZERO);

const stripCommonPrefix = (base: string, next: string): string => {
  if (!next.startsWith('/')) {
    return next;
  }

  const baseSegments = splitPathSegments(base);
  const nextSegments = splitPathSegments(next);

  if (baseSegments.length === ZERO || nextSegments.length === ZERO) {
    return next;
  }

  let index = 0;
  while (
    index < baseSegments.length &&
    index < nextSegments.length &&
    baseSegments[index] === nextSegments[index]
  ) {
    index += ONE;
  }

  if (index === ZERO) {
    return next;
  }

  return `/${nextSegments.slice(index).join('/')}`;
};

const joinPaths = (base: string, next: string): string => {
  const basePath = base.endsWith('/') ? base.slice(ZERO, NEGATIVE_ONE) : base;
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
// Regex Utilities
// ============================================

const stripRegexAnchors = (value: string): string =>
  value.replace(/^\^/, '').replace(/\$$/, '');

const stripExpressRegexSuffix = (value: string): string =>
  value.replace(/\\\/\?\(\?=\\\/\|\$\)/g, '').replace(/\(\?=\\\/\|\$\)/g, '');

const unescapeRegexTokens = (value: string): string =>
  value.replace(/\\\//g, '/').replace(/\\\./g, '.');

/**
 * Replace Express path param capture groups with `:paramName`
 */
const replaceParamGroups = (value: string, keys: ExpressKey[]): string => {
  let keyIndex = 0;
  const nextKey = (): string => {
    const key = keys[keyIndex++];
    if (typeof key === 'string') {
      return `:${key}`;
    }
    return `:${key?.name ?? 'param'}`;
  };

  const replacements: [RegExp, () => string][] = [
    [/\(\?:\/\(\[\^\/\]\+\?\)\)/g, (): string => `/${nextKey()}`],
    [/\(\?:\/\(\[\^\/\]\+\)\)/g, (): string => `/${nextKey()}`],
    [/\/\(\[\^\/\]\+\?\)/g, (): string => `/${nextKey()}`],
    [/\/\(\[\^\/\]\+\)/g, (): string => `/${nextKey()}`],
    [/\(\[\^\/\]\+\?\)/g, (): string => nextKey()],
    [/\(\[\^\/\]\+\)/g, (): string => nextKey()],
    [/\(\?:\[\^\/\]\+\?\)/g, (): string => nextKey()],
    [/\(\?:\[\^\/\]\+\)/g, (): string => nextKey()],
  ];

  return replacements.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    value,
  );
};

/**
 * Strip leftover regex tokens and normalize slashes
 */
const stripRemainingRegexTokens = (value: string): string => {
  const cleanup: [RegExp, string][] = [
    [/\(\?:/g, ''],
    [/\)/g, ''],
    [/\?/g, ''],
    [/\|/g, ''],
    [/\\/g, ''],
    [/\/+/g, '/'],
  ];

  return cleanup.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    value,
  );
};

// ============================================
// Layer Path Extraction
// ============================================

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

  let source = stripRegexAnchors(layer.regexp.source);
  source = stripExpressRegexSuffix(source);
  source = replaceParamGroups(source, keys);
  source = unescapeRegexTokens(source);
  source = stripRemainingRegexTokens(source);

  if (!source.startsWith('/')) {
    source = `/${source}`;
  }
  if (source !== '/' && source.endsWith('/')) {
    source = source.slice(ZERO, NEGATIVE_ONE);
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
// Swagger Meta Collection
// ============================================

/**
 * Collect Swagger metadata from middleware chain
 */
export const collectSwaggerMeta = (
  middlewares: ExpressMiddleware[],
): SwaggerMeta[] =>
  middlewares
    .map((middleware) => {
      const tagged = middleware as SwaggerTaggedMiddleware;
      return isSwaggerTaggedMiddleware(tagged) ? tagged.__swagger : undefined;
    })
    .filter((meta): meta is SwaggerMeta => Boolean(meta));

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
