#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

interface CliOptions {
  router?: string;
  output?: string;
  config?: string;
  format?: 'yaml' | 'json';
  help?: boolean;
  version?: boolean;
}

const parseArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '-r':
      case '--router':
        options.router = nextArg;
        i++;
        break;
      case '-o':
      case '--output':
        options.output = nextArg;
        i++;
        break;
      case '-c':
      case '--config':
        options.config = nextArg;
        i++;
        break;
      case '-f':
      case '--format':
        options.format = nextArg as 'yaml' | 'json';
        i++;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
    }
  }

  return options;
};

const showHelp = (): void => {
  console.log(`
express-swagger-gen - Auto-generate OpenAPI documentation from Express routes

USAGE:
  express-swagger-gen [options]

OPTIONS:
  -r, --router <path>   Path to the file that exports the Express router
  -o, --output <path>   Output path for the generated swagger file
  -c, --config <path>   Path to configuration file (JSON or JS)
  -f, --format <type>   Output format: yaml (default) or json
  -h, --help            Show this help message
  -v, --version         Show version number

EXAMPLES:
  # Generate swagger from router file
  express-swagger-gen -r ./src/routes/index.ts -o ./docs/swagger.yaml

  # Use a config file
  express-swagger-gen -c ./swagger.config.js

CONFIG FILE FORMAT (swagger.config.js):
  module.exports = {
    router: './src/routes/index.ts',  // Path to router export
    routerExport: 'default',          // Export name (default: 'default' or 'router')
    output: './docs/swagger.yaml',    // Output path
    
    // Generator options
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API description',
    },
    
    securitySchemes: {
      JWT: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    
    // Optional mappings
    tagMappings: {
      auth: 'Authentication',
      users: 'Users',
    },
    
    // Extra endpoints not in router
    extraEndpoints: [
      { method: 'get', path: '/health' },
    ],
  };
`);
};

const showVersion = (): void => {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(`express-swagger-gen v${pkg.version}`);
  } catch {
    console.log('express-swagger-gen v1.0.0');
  }
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    showVersion();
    process.exit(0);
  }

  // Load config if provided
  let config: Record<string, unknown> = {};
  if (options.config) {
    const configPath = path.resolve(options.config);
    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found: ${configPath}`);
      process.exit(1);
    }
    config = require(configPath);
  }

  // Merge CLI options with config
  const routerPath = options.router ?? (config.router as string);
  const outputPath = options.output ?? (config.output as string) ?? './swagger.yaml';
  const format = options.format ?? (config.format as 'yaml' | 'json') ?? 'yaml';

  if (!routerPath) {
    console.error('Error: Router path is required. Use -r <path> or provide in config file.');
    console.log('Run with --help for usage information.');
    process.exit(1);
  }

  // Resolve router path
  const resolvedRouterPath = path.resolve(routerPath);
  if (!fs.existsSync(resolvedRouterPath)) {
    console.error(`Router file not found: ${resolvedRouterPath}`);
    process.exit(1);
  }

  console.log(`Loading router from: ${resolvedRouterPath}`);

  try {
    // Dynamically import the router
    const routerModule = require(resolvedRouterPath);
    const routerExport = (config.routerExport as string) ?? 'default';
    const router = routerModule[routerExport] ?? routerModule.router ?? routerModule.default ?? routerModule;

    if (!router || typeof router !== 'function' || !Array.isArray(router.stack)) {
      console.error('Error: Could not find valid Express router in the specified file.');
      console.error('Make sure to export the router as default or named export.');
      process.exit(1);
    }

    // Import generator
    const { SwaggerGenerator } = require('./generator');

    // Build generator options
    const generatorOptions: Record<string, unknown> = {
      info: (config.info as object) ?? {
        title: 'API Documentation',
        version: '1.0.0',
      },
      verbose: true,
    };

    if (config.securitySchemes) {
      generatorOptions.securitySchemes = config.securitySchemes;
    }
    if (config.tagMappings) {
      generatorOptions.tagMappings = config.tagMappings;
    }
    if (config.nestedTagMappings) {
      generatorOptions.nestedTagMappings = config.nestedTagMappings;
    }
    if (config.extraEndpoints) {
      generatorOptions.extraEndpoints = config.extraEndpoints;
    }
    if (config.excludeEndpoints) {
      generatorOptions.excludeEndpoints = config.excludeEndpoints;
    }
    if (config.securityMiddlewares) {
      generatorOptions.securityMiddlewares = config.securityMiddlewares;
    }
    if (config.servers) {
      generatorOptions.servers = config.servers;
    }

    const generator = new SwaggerGenerator(router, generatorOptions);

    // Determine output path with correct extension
    let finalOutputPath = path.resolve(outputPath);
    if (format === 'json' && !finalOutputPath.endsWith('.json')) {
      finalOutputPath = finalOutputPath.replace(/\.(yaml|yml)$/, '.json');
      if (!finalOutputPath.endsWith('.json')) {
        finalOutputPath += '.json';
      }
    } else if (format === 'yaml' && !finalOutputPath.match(/\.(yaml|yml)$/)) {
      finalOutputPath = finalOutputPath.replace(/\.json$/, '.yaml');
      if (!finalOutputPath.match(/\.(yaml|yml)$/)) {
        finalOutputPath += '.yaml';
      }
    }

    // Generate and write
    generator.generateToFile(finalOutputPath);
    console.log(`✅ Swagger documentation generated: ${finalOutputPath}`);

    // Run verification
    const report = generator.verify();
    console.log(`\n📊 Verification Report:`);
    console.log(`   Total routes: ${report.totalRoutes}`);
    console.log(`   Total swagger endpoints: ${report.totalSwaggerEndpoints}`);

    if (report.missingInSwagger.length > 0) {
      console.log(`\n⚠️  Missing in swagger (${report.missingInSwagger.length}):`);
      report.missingInSwagger.forEach((ep: string) => console.log(`   - ${ep}`));
    }

    if (report.extraInSwagger.length > 0) {
      console.log(`\n⚠️  Extra in swagger (${report.extraInSwagger.length}):`);
      report.extraInSwagger.forEach((ep: string) => console.log(`   - ${ep}`));
    }

    if (report.missingInSwagger.length === 0 && report.extraInSwagger.length === 0) {
      console.log(`\n✅ All routes documented correctly!`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error generating swagger documentation:', error);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
