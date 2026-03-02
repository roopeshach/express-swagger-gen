# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-03-02)


### Features

* **cli:** add command-line interface ([cf2b382](https://github.com/roopeshach/express-swagger-gen/commit/cf2b382bf49f611b649b386f9ad779161c51af04))
* create main entry point with all exports ([e63932e](https://github.com/roopeshach/express-swagger-gen/commit/e63932ef6c652acc256c9250ab4e00117d4a7276))
* **generator:** implement SwaggerGenerator class ([b18894b](https://github.com/roopeshach/express-swagger-gen/commit/b18894bd304daa35c74e2a6b03d2cf222ee0c827))
* **serve:** add Swagger UI serving middleware ([0b94fdd](https://github.com/roopeshach/express-swagger-gen/commit/0b94fddff6f2280da759b88095c7d2a8d7417919))
* **types:** add comprehensive TypeScript type definitions ([3b0f7f7](https://github.com/roopeshach/express-swagger-gen/commit/3b0f7f764719c42e2ac9e831440eaf6c013b1411))
* **utils:** implement Express router traversal utilities ([780a7f2](https://github.com/roopeshach/express-swagger-gen/commit/780a7f2dd111065b3af71f40615e588f30f03056))
* **validators:** add Zod validation middlewares ([ad1da22](https://github.com/roopeshach/express-swagger-gen/commit/ad1da2202e73f3f2f4bfeaf41b7f32302574d8ca))


### Bug Fixes

* **ci:** add package-lock.json and fix release-please action ([5d793d7](https://github.com/roopeshach/express-swagger-gen/commit/5d793d701f2dd1b3f1514d77fda467167d217a37))
* remove lint and test scripts without dependencies ([8af8980](https://github.com/roopeshach/express-swagger-gen/commit/8af8980704b1de0c2b56facf8e05d0c5d0cf9875))

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
