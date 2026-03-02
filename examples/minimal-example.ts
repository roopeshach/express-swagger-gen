/**
 * Minimal example - Quick start with zod-express-swagger
 */

import express from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, SwaggerGenerator, serveSwaggerUI } from 'zod-express-swagger';

const app = express();
const router = express.Router();

// Define schemas
const TodoSchema = z.object({
  title: z.string(),
  completed: z.boolean().default(false),
});

const QuerySchema = z.object({
  completed: z.string().optional(),
});

// Routes with validation (schemas auto-discovered)
router.post('/todos', validateBody(TodoSchema), (req, res) => {
  res.json({ id: 1, ...req.body });
});

router.get('/todos', validateQuery(QuerySchema), (req, res) => {
  res.json([]);
});

// Mount router
app.use(express.json());
app.use('/api', router);

// Generate and serve docs
const generator = new SwaggerGenerator(router, {
  info: {
    title: 'Todo API',
    version: '1.0.0',
  },
});

app.use('/docs', ...serveSwaggerUI(generator));

app.listen(3000, () => {
  console.log('Server: http://localhost:3000');
  console.log('Docs: http://localhost:3000/docs');
});
