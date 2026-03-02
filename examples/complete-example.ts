/**
 * Complete example of using zod-express-swagger
 */

import express from 'express';
import { z } from 'zod';
import {
  validateBody,
  validateParams,
  validateQuery,
  validateResponse,
  setupSwagger,
} from 'zod-express-swagger';

// ============================================
// Define Zod Schemas
// ============================================

const CreateUserSchema = z.object({
  name: z.string().min(1).describe('User full name'),
  email: z.string().email().describe('User email address'),
  age: z.number().min(0).max(150).optional().describe('User age'),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
});

const UpdateUserSchema = CreateUserSchema.partial();

const UserParamsSchema = z.object({
  userId: z.string().uuid().describe('User unique identifier'),
});

const PaginationSchema = z.object({
  page: z.string().optional().describe('Page number'),
  limit: z.string().optional().describe('Items per page'),
  sortBy: z.string().optional().describe('Sort field'),
  order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
});

const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const UsersListResponseSchema = z.array(UserResponseSchema);

// ============================================
// Controllers
// ============================================

const createUser: express.RequestHandler = (req, res) => {
  const user = {
    id: crypto.randomUUID(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  res.status(201).json({ message: 'User created', data: user });
};

const getUser: express.RequestHandler = (req, res) => {
  res.json({
    message: 'User found',
    data: {
      id: req.params.userId,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
};

const listUsers: express.RequestHandler = (req, res) => {
  res.json({
    message: 'Users list',
    data: [],
    pagination: {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      total: 0,
    },
  });
};

const updateUser: express.RequestHandler = (req, res) => {
  res.json({
    message: 'User updated',
    data: {
      id: req.params.userId,
      ...req.body,
      updatedAt: new Date().toISOString(),
    },
  });
};

const deleteUser: express.RequestHandler = (req, res) => {
  res.json({ message: 'User deleted' });
};

// ============================================
// Auth Middleware (for security detection)
// ============================================

const verifyAuthorization: express.RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  // Verify token here...
  next();
};

// ============================================
// Routes
// ============================================

const router = express.Router();

// Public routes
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes
router.post(
  '/users',
  verifyAuthorization,
  validateBody(CreateUserSchema),
  validateResponse(UserResponseSchema, { path: 'data' }),
  createUser
);

router.get(
  '/users',
  verifyAuthorization,
  validateQuery(PaginationSchema),
  validateResponse(UsersListResponseSchema, { path: 'data' }),
  listUsers
);

router.get(
  '/users/:userId',
  verifyAuthorization,
  validateParams(UserParamsSchema),
  validateResponse(UserResponseSchema, { path: 'data' }),
  getUser
);

router.put(
  '/users/:userId',
  verifyAuthorization,
  validateParams(UserParamsSchema),
  validateBody(UpdateUserSchema),
  validateResponse(UserResponseSchema, { path: 'data' }),
  updateUser
);

router.delete(
  '/users/:userId',
  verifyAuthorization,
  validateParams(UserParamsSchema),
  deleteUser
);

// ============================================
// App Setup
// ============================================

const app = express();

app.use(express.json());
app.use('/api', router);

// Setup Swagger documentation
setupSwagger(app, router, {
  docsPath: '/docs',
  jsonPath: '/swagger.json',
  yamlPath: '/swagger.yaml',
  generator: {
    info: {
      title: 'Example API',
      version: '1.0.0',
      description: 'Example API demonstrating zod-express-swagger',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      { url: 'http://localhost:3000/api', description: 'Development' },
      { url: 'https://api.example.com', description: 'Production' },
    ],
    securitySchemes: {
      JWT: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
    },
    tagMappings: {
      users: 'Users',
      health: 'Health',
    },
    extraEndpoints: [
      { method: 'get', path: '/health' },
    ],
    verbose: true,
  },
  serve: {
    customSiteTitle: 'Example API Documentation',
    customCss: '.swagger-ui .topbar { background-color: #1976d2; }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
    },
  },
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/docs`);
  console.log(`📄 Swagger JSON: http://localhost:${PORT}/swagger.json`);
  console.log(`📄 Swagger YAML: http://localhost:${PORT}/swagger.yaml`);
});

export { app, router };
