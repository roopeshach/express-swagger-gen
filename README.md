# zod-express-swagger

Auto-generate OpenAPI 3.0 documentation from Express routes with Zod schema validation.

[![npm version](https://badge.fury.io/js/zod-express-swagger.svg)](https://www.npmjs.com/package/zod-express-swagger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔄 **Auto-discovery** - Automatically discovers all Express routes
- 📝 **Zod Integration** - Extracts request/response schemas from Zod validation middlewares
- 🎨 **Swagger UI** - Built-in middleware to serve beautiful API documentation
- 🔒 **Security Support** - Automatic detection of authentication middlewares
- 📁 **File Generation** - Generate YAML or JSON OpenAPI specs
- ✅ **Verification** - Compare routes against generated documentation
- 🎯 **TypeScript** - Full TypeScript support

## Installation

```bash
npm install zod-express-swagger
# or
yarn add zod-express-swagger
# or
pnpm add zod-express-swagger
```

## Peer Dependencies

This package requires the following peer dependencies:
- `express` ^4.0.0 || ^5.0.0
- `zod` ^3.0.0

## Quick Start

### 1. Use validation middlewares in your routes

```typescript
import express from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from 'zod-express-swagger';

const router = express.Router();

// Define Zod schemas
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).optional(),
});

const UserParamsSchema = z.object({
  userId: z.string().uuid(),
});

const PaginationSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

// Use validation middlewares - schemas are automatically extracted for docs
router.post('/users',
  validateBody(CreateUserSchema),
  createUser
);

router.get('/users/:userId',
  validateParams(UserParamsSchema),
  getUser
);

router.get('/users',
  validateQuery(PaginationSchema),
  listUsers
);

export { router };
```

### 2. Generate and serve documentation

```typescript
import express from 'express';
import { setupSwagger } from 'zod-express-swagger';
import { router } from './routes';

const app = express();

app.use(express.json());
app.use('/api', router);

// Setup Swagger documentation
setupSwagger(app, router, {
  docsPath: '/docs',        // Swagger UI at /docs
  jsonPath: '/swagger.json', // JSON spec at /swagger.json
  yamlPath: '/swagger.yaml', // YAML spec at /swagger.yaml
  generator: {
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'My awesome API',
    },
    securitySchemes: {
      JWT: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
    },
  },
  serve: {
    customSiteTitle: 'My API Documentation',
    basicAuth: {
      username: 'admin',
      password: 'secret',
    },
  },
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('API Docs: http://localhost:3000/docs');
});
```

## API Reference

### Validation Middlewares

#### `validateBody(schema: ZodTypeAny)`

Validates request body and attaches Zod schema for documentation.

```typescript
router.post('/users', validateBody(CreateUserSchema), handler);
```

#### `validateParams(schema: AnyZodObject)`

Validates URL parameters and attaches Zod schema for documentation.

```typescript
router.get('/users/:id', validateParams(UserIdSchema), handler);
```

#### `validateQuery(schema: AnyZodObject)`

Validates query parameters and attaches Zod schema for documentation.

```typescript
router.get('/users', validateQuery(PaginationSchema), handler);
```

#### `validateResponse(schema: ZodTypeAny, opts?: { path?: string })`

Validates response body for documentation purposes.

```typescript
router.get('/users/:id', validateResponse(UserSchema, { path: 'data' }), handler);
```

### SwaggerGenerator

Main class for generating OpenAPI documentation.

```typescript
import { SwaggerGenerator } from 'zod-express-swagger';

const generator = new SwaggerGenerator(router, {
  info: {
    title: 'My API',
    version: '1.0.0',
  },
});

// Get OpenAPI document
const doc = generator.generate();

// Get as JSON string
const json = generator.toJSON();

// Get as YAML string
const yaml = generator.toYAML();

// Write to file
generator.generateToFile('./docs/swagger.yaml');

// Verify routes match documentation
const report = generator.verify();
```

#### Generator Options

```typescript
interface SwaggerGeneratorOptions {
  // Required: API info
  info: {
    title: string;
    version: string;
    description?: string;
  };

  // OpenAPI version (default: '3.0.0')
  openApiVersion?: '3.0.0' | '3.0.1' | '3.0.2' | '3.0.3' | '3.1.0';

  // API servers
  servers?: Array<{ url: string; description?: string }>;

  // Security schemes
  securitySchemes?: Record<string, OpenAPISecurityScheme>;

  // Middleware names that require authentication
  securityMiddlewares?: string[]; // default: ['verifyAuthorization', 'authenticate', 'auth', 'requireAuth']

  // Custom tag mappings
  tagMappings?: Record<string, string>;
  
  // Nested tag mappings (e.g., workspace/feature)
  nestedTagMappings?: Record<string, Record<string, string>>;

  // Extra endpoints to include
  extraEndpoints?: Array<{ method: string; path: string }>;

  // Endpoints to exclude
  excludeEndpoints?: Array<{ method: string; path: string }>;

  // Enable verbose logging
  verbose?: boolean;
}
```

### Serving Documentation

#### `serveSwaggerUI(document, options)`

Create middleware to serve Swagger UI.

```typescript
import { serveSwaggerUI, SwaggerGenerator } from 'zod-express-swagger';

const generator = new SwaggerGenerator(router, options);
app.use('/docs', ...serveSwaggerUI(generator, {
  customSiteTitle: 'My API Docs',
  basicAuth: { username: 'admin', password: 'secret' },
}));
```

#### `createSwaggerMiddleware(router, generatorOptions, serveOptions)`

Create a complete Swagger setup.

```typescript
import { createSwaggerMiddleware } from 'zod-express-swagger';

const { serve, document, generator, json, yaml } = createSwaggerMiddleware(
  router,
  { info: { title: 'API', version: '1.0.0' } },
  { customSiteTitle: 'API Docs' }
);

app.use('/docs', ...serve);
app.get('/swagger.json', json);
app.get('/swagger.yaml', yaml);
```

#### `setupSwagger(app, router, options)`

Quick setup function for common use cases.

```typescript
import { setupSwagger } from 'zod-express-swagger';

setupSwagger(app, router, {
  docsPath: '/docs',
  jsonPath: '/swagger.json',
  yamlPath: '/swagger.yaml',
  generator: { info: { title: 'API', version: '1.0.0' } },
  serve: { customSiteTitle: 'API Docs' },
});
```

### CLI

Generate documentation from command line.

```bash
# Install globally
npm install -g zod-express-swagger

# Generate from router file
zod-express-swagger -r ./src/routes/index.ts -o ./docs/swagger.yaml

# Use config file
zod-express-swagger -c ./swagger.config.js
```

#### Config File Example

```javascript
// swagger.config.js
module.exports = {
  router: './src/routes/index.ts',
  routerExport: 'router',  // Export name
  output: './docs/swagger.yaml',
  
  info: {
    title: 'My API',
    version: '1.0.0',
  },
  
  securitySchemes: {
    JWT: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
  
  tagMappings: {
    auth: 'Authentication',
    users: 'Users',
  },
};
```

## Advanced Usage

### Custom Tag Mappings

```typescript
const generator = new SwaggerGenerator(router, {
  info: { title: 'API', version: '1.0.0' },
  tagMappings: {
    auth: 'Authentication',
    users: 'User Management',
    admin: 'Administration',
  },
  nestedTagMappings: {
    workspace: {
      users: 'Workspace Users',
      projects: 'Workspace Projects',
      settings: 'Workspace Settings',
    },
  },
});
```

### Multiple Security Schemes

```typescript
const generator = new SwaggerGenerator(router, {
  info: { title: 'API', version: '1.0.0' },
  securitySchemes: {
    JWT: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    ApiKey: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    },
  },
  securityMiddlewares: ['verifyJWT', 'verifyApiKey'],
});
```

### Verification

```typescript
const generator = new SwaggerGenerator(router, options);
const report = generator.verify();

console.log(`Total routes: ${report.totalRoutes}`);
console.log(`Documented: ${report.totalSwaggerEndpoints}`);
console.log(`Missing: ${report.missingInSwagger.length}`);
console.log(`Extra: ${report.extraInSwagger.length}`);
```

## How It Works

1. **Route Discovery**: Traverses Express router stack recursively to find all routes
2. **Schema Extraction**: Reads `__swagger` metadata from validation middlewares
3. **Path Normalization**: Converts Express `:param` to OpenAPI `{param}` format
4. **Tag Derivation**: Automatically assigns tags based on path segments
5. **Security Detection**: Identifies auth middlewares by function name
6. **Document Generation**: Builds complete OpenAPI 3.0 document

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit a pull request.

## License

MIT © Your Name
