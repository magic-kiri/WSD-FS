import { test, describe } from 'node:test';
import assert from 'node:assert';

// Import ExportService
import ExportService from '../../src/services/exportService.js';

describe('ExportService Unit Tests', () => {
  test('should be a class with static methods', () => {
    assert(typeof ExportService === 'function');
    assert(ExportService.name === 'ExportService');

    // Check that key methods exist and are functions
    const staticMethods = [
      'generateExportId',
      'generateCacheKey',
      'buildQueryFromFilters',
      'getSortOptions',
      'initiateExport',
      'processExport',
      'getExportData',
      'getExportStatus',
      'getExportHistory'
    ];

    staticMethods.forEach((method) => {
      assert(
        typeof ExportService[method] === 'function',
        `${method} should be a static function`
      );
    });
  });

  test('should have correct constants', () => {
    assert(typeof ExportService.CACHE_TTL === 'number');
    assert(ExportService.CACHE_TTL === 30 * 60); // 30 minutes in seconds

    assert(typeof ExportService.MAX_EXPORT_SIZE === 'number');
    assert(ExportService.MAX_EXPORT_SIZE === 100000); // 100k tasks
  });

  test('generateExportId should return unique identifiers', () => {
    const id1 = ExportService.generateExportId();
    const id2 = ExportService.generateExportId();

    assert(typeof id1 === 'string');
    assert(typeof id2 === 'string');
    assert(id1 !== id2);
    assert(id1.startsWith('export_'));
    assert(id2.startsWith('export_'));
  });

  test('generateCacheKey should return consistent hash for same inputs', () => {
    const filters1 = { status: ['pending'], priority: ['high'] };
    const filters2 = { status: ['pending'], priority: ['high'] };
    const format = 'csv';

    const key1 = ExportService.generateCacheKey(filters1, format);
    const key2 = ExportService.generateCacheKey(filters2, format);

    assert(typeof key1 === 'string');
    assert(typeof key2 === 'string');
    assert.strictEqual(key1, key2);
    assert(key1.startsWith('export:'));
  });

  test('generateCacheKey should return different hash for different inputs', () => {
    const filters1 = { status: ['pending'] };
    const filters2 = { status: ['completed'] };
    const format = 'csv';

    const key1 = ExportService.generateCacheKey(filters1, format);
    const key2 = ExportService.generateCacheKey(filters2, format);

    assert(key1 !== key2);
  });

  test('buildQueryFromFilters should handle status filters', () => {
    const filters = { status: ['pending', 'completed'] };
    const query = ExportService.buildQueryFromFilters(filters);

    assert(typeof query === 'object');
    assert(query.status.$in);
    assert(query.status.$in.includes('pending'));
    assert(query.status.$in.includes('completed'));
  });

  test('buildQueryFromFilters should handle single status filter', () => {
    const filters = { status: ['pending'] };
    const query = ExportService.buildQueryFromFilters(filters);

    assert.strictEqual(query.status, 'pending');
  });

  test('buildQueryFromFilters should handle priority filters', () => {
    const filters = { priority: ['high', 'medium'] };
    const query = ExportService.buildQueryFromFilters(filters);

    assert(query.priority.$in);
    assert(query.priority.$in.includes('high'));
    assert(query.priority.$in.includes('medium'));
  });

  test('buildQueryFromFilters should handle date range filters', () => {
    const filters = {
      createdFrom: '2024-01-01',
      createdTo: '2024-01-31',
      completedFrom: '2024-01-15',
      completedTo: '2024-01-31'
    };
    const query = ExportService.buildQueryFromFilters(filters);

    assert(query.createdAt);
    assert(query.createdAt.$gte instanceof Date);
    assert(query.createdAt.$lte instanceof Date);

    assert(query.completedAt);
    assert(query.completedAt.$gte instanceof Date);
    assert(query.completedAt.$lte instanceof Date);
  });

  test('getSortOptions should return correct sort object', () => {
    const filters1 = { sortBy: 'title', sortOrder: 'asc' };
    const sort1 = ExportService.getSortOptions(filters1);
    assert.deepStrictEqual(sort1, { title: 1 });

    const filters2 = { sortBy: 'createdAt', sortOrder: 'desc' };
    const sort2 = ExportService.getSortOptions(filters2);
    assert.deepStrictEqual(sort2, { createdAt: -1 });

    // Test defaults
    const sort3 = ExportService.getSortOptions({});
    assert.deepStrictEqual(sort3, { createdAt: -1 });
  });

  test('calculateProgress should return correct percentages', () => {
    assert.strictEqual(ExportService.calculateProgress('pending'), 0);
    assert.strictEqual(ExportService.calculateProgress('processing'), 50);
    assert.strictEqual(ExportService.calculateProgress('completed'), 100);
    assert.strictEqual(ExportService.calculateProgress('failed'), 0);
    assert.strictEqual(ExportService.calculateProgress('unknown'), 0);
  });

  test('generateFilename should create descriptive filenames', () => {
    const format = 'csv';
    const filters = { status: ['pending'], priority: ['high'] };
    const taskCount = 25;

    const filename = ExportService.generateFilename(format, filters, taskCount);

    assert(typeof filename === 'string');
    assert(filename.endsWith('.csv'));
    assert(filename.includes('filtered-25'));
    assert(filename.includes(new Date().toISOString().split('T')[0])); // Today's date
  });

  test('generateFilename should handle no filters', () => {
    const format = 'json';
    const filters = {};
    const taskCount = 100;

    const filename = ExportService.generateFilename(format, filters, taskCount);

    assert(filename.endsWith('.json'));
    assert(filename.includes('all-100'));
  });

  test('getMimeType should return correct MIME types', () => {
    assert.strictEqual(ExportService.getMimeType('csv'), 'text/csv');
    assert.strictEqual(ExportService.getMimeType('json'), 'application/json');
    assert.strictEqual(
      ExportService.getMimeType('unknown'),
      'application/octet-stream'
    );
  });

  test('all async methods should be async functions', () => {
    const asyncMethods = [
      'initiateExport',
      'processExport',
      'getExportData',
      'getExportStatus',
      'getExportHistory'
    ];

    asyncMethods.forEach((method) => {
      assert(
        ExportService[method].constructor.name === 'AsyncFunction',
        `${method} should be async`
      );
    });
  });

  test('should expose service structure correctly', () => {
    // Test that service has the expected static properties and methods
    assert(ExportService.CACHE_TTL);
    assert(ExportService.MAX_EXPORT_SIZE);

    // Test critical method signatures
    assert.strictEqual(ExportService.generateExportId.length, 0);
    assert.strictEqual(ExportService.generateCacheKey.length, 2);
    assert.strictEqual(ExportService.buildQueryFromFilters.length, 1);
    assert.strictEqual(ExportService.getSortOptions.length, 1);
  });
});
