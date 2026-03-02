# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-03-02

### Added

- Initial release of express-swagger-gen
- Auto-discovery of Express routes via router traversal
- Zod schema extraction from validation middlewares
- OpenAPI 3.0 document generation
- Validation middlewares: validateBody, validateParams, validateQuery, validateResponse
- SwaggerGenerator class with generate, toJSON, toYAML, generateToFile methods
- Swagger UI serving middleware with basic auth support
- CLI tool for command-line generation
- GitHub Actions workflows for CI and automated releases

[Unreleased]: https://github.com/roopeshach/express-swagger-gen/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/roopeshach/express-swagger-gen/releases/tag/v1.0.0
