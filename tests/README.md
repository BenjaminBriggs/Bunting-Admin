# JSON Spec Compliance Test Suite

This comprehensive test suite validates that the Bunting admin API generates configuration artifacts that **exactly match** the JSON Spec format requirements.

## 🧪 Test Overview

### Coverage Goals

- ✅ **100% JSON Spec Compliance** - Every generated config validates against JSON Schema
- ✅ **Cross-Platform Consistency** - Bucketing algorithm produces identical results
- ✅ **Type Safety** - All TypeScript types match JSON Spec exactly
- ✅ **Naming Rules** - Strict validation of identifier patterns
- ✅ **Condition System** - All condition types and operators work correctly
- ✅ **Variant Evaluation** - Order-based evaluation with type constraints

## 📋 Test Suite Structure

```
tests/
├── unit/
│   ├── json-spec-compliance.test.js     # Core JSON format validation
│   ├── bucketing-algorithm.test.js      # SHA-256 bucketing tests
│   └── condition-evaluation.test.js     # Condition system tests
├── integration/
│   └── end-to-end-config.test.js        # Complete pipeline tests
├── helpers/
│   ├── database.js                      # Database test utilities
│   └── mockData.js                      # Test data generators
├── json-spec-test-suite.js              # Test runner script
└── README.md                            # This file
```

## 🚀 Running Tests

### Quick Start

```bash
# Run all JSON Spec compliance tests
npm run test:json-spec

# Run specific test categories
npm run test:json-spec:compliance    # JSON format validation
npm run test:json-spec:bucketing     # Bucketing algorithm
npm run test:json-spec:conditions    # Condition evaluation
npm run test:json-spec:e2e          # End-to-end pipeline
```

### Individual Test Suites

```bash
# Core compliance tests
npm run test:json-spec:compliance

# Bucketing algorithm tests
npm run test:json-spec:bucketing

# Condition evaluation tests
npm run test:json-spec:conditions

# End-to-end integration tests
npm run test:json-spec:e2e
```

### Development Testing

```bash
# Watch mode for development
npm run test:watch

# Coverage reporting
npm run test:coverage

# All unit tests
npm run test:unit

# All integration tests
npm run test:integration
```

## 📊 Test Categories

### 1. JSON Format Compliance (`json-spec-compliance.test.js`)

**Tests:** Core configuration structure validation

- ✅ **Top-level Structure** - `schema_version`, `config_version`, `published_at`, `app_identifier`
- ✅ **Flag Type Mapping** - `BOOL` → `boolean`, `INT` → `integer`, etc.
- ✅ **Environment Structure** - `development`, `beta`, `production` with defaults and variants
- ✅ **Variant Types** - `conditional`, `test`, `rollout` with proper fields
- ✅ **Condition Format** - `{id, type, values[], operator}` structure
- ✅ **Tests/Rollouts** - Separate objects with type-specific fields
- ✅ **Naming Rules** - `^[a-z_]+$` pattern enforcement
- ✅ **Schema Validation** - Complete JSON Schema compliance

```javascript
describe('JSON Spec Compliance', () => {
	test('generates config with all required top-level fields', async () => {
		const config = await generateConfigFromDb(testApp.id);

		const validation = validateConfigArtifact(config);
		expect(validation.valid).toBe(true);
		expect(validation.errors).toEqual([]);
	});
});
```

### 2. Bucketing Algorithm (`bucketing-algorithm.test.js`)

**Tests:** SHA-256 deterministic bucketing per JSON Spec

- ✅ **Deterministic Results** - Same input produces same bucket (1-100)
- ✅ **Cross-Platform Consistency** - Big-endian 64-bit conversion
- ✅ **Distribution Testing** - Roughly uniform distribution across buckets
- ✅ **Salt Validation** - No colons, minimum length requirements
- ✅ **Edge Cases** - Empty inputs, special characters, long strings
- ✅ **Performance** - Efficient for large numbers of calculations

```javascript
describe('Bucketing Algorithm', () => {
	test('produces consistent results for same input', () => {
		const salt = 'test-salt-123';
		const localId = '550e8400-e29b-41d4-a716-446655440000';

		const result1 = bucketForNode(salt, localId);
		const result2 = bucketForNode(salt, localId);

		expect(result1).toBe(result2);
		expect(result1).toBeGreaterThanOrEqual(1);
		expect(result1).toBeLessThanOrEqual(100);
	});
});
```

### 3. Condition Evaluation (`condition-evaluation.test.js`)

**Tests:** Complete condition system per JSON Spec

- ✅ **Version Conditions** - `app_version`, `os_version` with all operators
- ✅ **List Conditions** - `platform`, `device_model`, `region`
- ✅ **Custom Conditions** - `custom_attribute` with SDK integration
- ✅ **Operator Testing** - All operators: `equals`, `greater_than`, `in`, etc.
- ✅ **Multiple Conditions** - AND logic evaluation
- ✅ **Error Handling** - Missing attributes, unknown types, invalid operators
- ✅ **Edge Cases** - Empty values, malformed versions

```javascript
describe('Condition Evaluation', () => {
	test('app_version greater_than_or_equal operator', async () => {
		const condition = {
			id: 'app-version-gte',
			type: 'app_version',
			values: ['2.0.0'],
			operator: 'greater_than_or_equal',
		};

		const result = await evaluateCondition(condition, mockContext);
		expect(result).toBe(true);
	});
});
```

### 4. End-to-End Pipeline (`end-to-end-config.test.js`)

**Tests:** Complete database-to-JSON pipeline

- ✅ **Real-World Scenarios** - Complex flags with multiple variants
- ✅ **All Entity Types** - Flags, tests, rollouts working together
- ✅ **Validation Pipeline** - Schema + naming validation
- ✅ **Performance Testing** - Large configs (100+ flags)
- ✅ **Edge Cases** - Empty configs, missing data, invalid structures
- ✅ **Type Integration** - All flag types in realistic combinations

```javascript
describe('End-to-End Config Generation', () => {
	test('generates JSON Spec compliant config for complex scenario', async () => {
		// Create realistic test data with all entity types
		await createComplexTestScenario(testApp.id);

		const config = await generateConfigFromDb(testApp.id);

		// Comprehensive validation
		const schemaValidation = validateConfigArtifact(config);
		expect(schemaValidation.valid).toBe(true);

		const namingValidation = validateNamingRules(config);
		expect(namingValidation).toEqual([]);
	});
});
```

## 🎯 Validation Levels

### Level 1: JSON Schema Compliance

- Validates against complete JSON Schema from JSON Spec
- Checks required fields, data types, and structure
- Ensures all entities follow exact specification

### Level 2: Naming Rule Enforcement

- Validates `^[a-z_]+$` pattern for all identifiers
- Prevents leading/trailing underscores
- Enforces 64-character maximum length

### Level 3: Cross-Platform Consistency

- Tests bucketing algorithm against known vectors
- Validates big-endian SHA-256 implementation
- Ensures deterministic results across platforms

### Level 4: Business Logic Validation

- Tests condition evaluation logic
- Validates variant ordering and type constraints
- Ensures proper environment isolation

## 🔍 Test Data Patterns

### Minimal Valid Setup

```javascript
const minimalSetup = {
	app: { identifier: 'com.test.app' },
	flag: {
		key: 'simple_flag',
		type: 'boolean',
		defaultValues: { development: false, beta: false, production: false },
	},
};
```

### Complex Realistic Setup

```javascript
const complexSetup = {
	tests: ['checkout_flow_test'],
	rollouts: ['dark_mode_rollout'],
	flags: ['enable_new_checkout', 'api_timeout_seconds', 'feature_config'],
	variants: ['conditional', 'test', 'rollout'],
};
```

### Invalid Test Cases

```javascript
const invalidCases = {
	badKeys: ['_invalid', 'invalid_', 'Invalid-Flag'],
	badConditions: [{ type: 'unknown', values: [] }],
	missingFields: { flag: { key: 'test' } }, // Missing type, defaults
};
```

## 📈 Success Criteria

### Required Passing Tests

- ✅ All config artifacts validate against JSON Schema
- ✅ All generated keys follow naming rules
- ✅ Bucketing algorithm produces consistent results
- ✅ All condition types evaluate correctly
- ✅ Complex scenarios generate valid configurations

### Performance Benchmarks

- ✅ Large configs (100+ flags) generate in < 5 seconds
- ✅ 10,000 bucketing calculations complete in < 1 second
- ✅ Complex condition evaluation completes in < 100ms

### Cross-Platform Consistency

- ✅ Bucketing algorithm matches reference implementations
- ✅ Generated configs validate in other language SDKs
- ✅ Condition evaluation produces identical results

## 🚨 Failure Analysis

### Common Failure Patterns

1. **Schema Violations** - Missing required fields, wrong types
2. **Naming Rule Violations** - Invalid characters, length limits
3. **Condition Errors** - Unknown types, missing operators
4. **Type Mapping Errors** - Prisma enum ↔ JSON Spec mismatches

### Debugging Commands

```bash
# Run with detailed output
npm run test:json-spec:compliance -- --verbose

# Run single test with debugging
npm run test:json-spec:compliance -- --testNamePattern="generates config"

# Coverage analysis
npm run test:coverage
```

## 🔧 Development Workflow

### Adding New Tests

1. Create test in appropriate category (`unit/` or `integration/`)
2. Use `DatabaseHelper` for consistent test data
3. Validate against both JSON Schema and naming rules
4. Add performance assertions for large datasets

### Test Data Creation

```javascript
// Use DatabaseHelper for consistent setup
const testApp = await DatabaseHelper.createTestApp();
const testFlag = await DatabaseHelper.createTestFlag(testApp.id, {
	key: 'custom_flag',
	type: 'BOOL',
});
```

### Validation Pattern

```javascript
// Standard validation pattern
const config = await generateConfigFromDb(testApp.id);

const schemaValidation = validateConfigArtifact(config);
expect(schemaValidation.valid).toBe(true);

const namingValidation = validateNamingRules(config);
expect(namingValidation).toEqual([]);
```

## 🎉 Success Metrics

When all tests pass, you can be confident that:

- ✅ **JSON Spec Compliance**: 100% conformance to specification
- ✅ **Cross-Platform Consistency**: Deterministic bucketing across languages
- ✅ **Type Safety**: Complete TypeScript type alignment
- ✅ **Production Ready**: Robust validation and error handling
- ✅ **Performance**: Efficient generation of large configurations

The test suite provides comprehensive coverage ensuring the Bunting admin API generates **exactly** the JSON format specified in the JSON Spec, with confidence for production deployment.
