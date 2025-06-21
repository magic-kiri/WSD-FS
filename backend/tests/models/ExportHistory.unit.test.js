import { test, describe } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';

// Import ExportHistory model
import ExportHistory, {
  EXPORT_FORMATS,
  EXPORT_STATUSES
} from '../../src/models/ExportHistory.js';

describe('ExportHistory Model Unit Tests', () => {
  test('should be a mongoose model', () => {
    assert(ExportHistory);
    assert(ExportHistory.modelName === 'ExportHistory');
    assert(ExportHistory.schema instanceof mongoose.Schema);
  });

  test('should export EXPORT_FORMATS constant', () => {
    assert(Array.isArray(EXPORT_FORMATS));
    assert(EXPORT_FORMATS.includes('csv'));
    assert(EXPORT_FORMATS.includes('json'));
    assert.strictEqual(EXPORT_FORMATS.length, 2);
  });

  test('should export EXPORT_STATUSES constant', () => {
    assert(Array.isArray(EXPORT_STATUSES));
    assert(EXPORT_STATUSES.includes('pending'));
    assert(EXPORT_STATUSES.includes('processing'));
    assert(EXPORT_STATUSES.includes('completed'));
    assert(EXPORT_STATUSES.includes('failed'));
    assert.strictEqual(EXPORT_STATUSES.length, 4);
  });

  test('should have correct schema structure', () => {
    const schema = ExportHistory.schema;
    const paths = schema.paths;

    // Check required fields
    assert(paths.exportId);
    assert(paths.exportId.isRequired === true);
    assert(paths.exportId.instance === 'String');
    assert(paths.exportId.options.unique === true);

    assert(paths.filters);
    assert(paths.filters.isRequired === true);

    assert(paths.format);
    assert(paths.format.isRequired === true);
    assert(paths.format.instance === 'String');

    // Note: cacheKey is now a virtual property, not a database field
    assert(!paths.cacheKey, 'cacheKey should be virtual, not a database field');

    // Note: expiresAt is now a virtual property, not a database field
    assert(
      !paths.expiresAt,
      'expiresAt should be virtual, not a database field'
    );

    // Check optional fields with defaults
    assert(paths.status);
    assert(paths.status.defaultValue === 'pending');

    assert(paths.fileSize);
    assert(paths.fileSize.defaultValue === 0);

    assert(paths.taskCount);
    assert(paths.taskCount.defaultValue === 0);

    assert(paths.downloadCount);
    assert(paths.downloadCount.defaultValue === 0);
  });

  test('should have correct enum values', () => {
    const schema = ExportHistory.schema;
    const paths = schema.paths;

    // Check format enum
    assert(Array.isArray(paths.format.enumValues));
    assert(paths.format.enumValues.includes('csv'));
    assert(paths.format.enumValues.includes('json'));

    // Check status enum
    assert(Array.isArray(paths.status.enumValues));
    assert(paths.status.enumValues.includes('pending'));
    assert(paths.status.enumValues.includes('processing'));
    assert(paths.status.enumValues.includes('completed'));
    assert(paths.status.enumValues.includes('failed'));
  });

  test('should have correct default values', () => {
    const schema = ExportHistory.schema;
    const paths = schema.paths;

    assert(paths.status.defaultValue === 'pending');
    assert(paths.fileSize.defaultValue === 0);
    assert(paths.taskCount.defaultValue === 0);
    assert(paths.downloadCount.defaultValue === 0);
    assert(paths.completedAt.defaultValue === null);
    assert(paths.errorMessage.defaultValue === null);
  });

  test('should have indexes defined', () => {
    const indexes = ExportHistory.schema.indexes();

    // Should have index on exportId (unique)
    const exportIdIndex = indexes.find(
      (idx) => idx[0].exportId && Object.keys(idx[0]).length === 1
    );
    assert(exportIdIndex, 'Should have index on exportId');

    // Should have compound index for status and createdAt
    const statusCreatedAtIndex = indexes.find(
      (idx) =>
        idx[0].status && idx[0].createdAt && Object.keys(idx[0]).length === 2
    );
    assert(
      statusCreatedAtIndex,
      'Should have compound index on status and createdAt'
    );

    // Note: TTL index on expiresAt was removed since expiresAt is now virtual
  });

  test('should have timestamps enabled', () => {
    const schema = ExportHistory.schema;
    assert(schema.options.timestamps === true);
  });

  test('should have pre-save middleware', () => {
    const schema = ExportHistory.schema;
    assert(schema.pre, 'Schema should have pre hooks');
  });

  test('should have isExpired virtual property', () => {
    const instance = new ExportHistory({
      exportId: 'test',
      filters: {},
      format: 'csv'
    });
    assert(
      typeof instance.isExpired === 'boolean',
      'isExpired should be a virtual property returning boolean'
    );
  });

  test('isExpired should return false for non-expired export', () => {
    const exportHistory = new ExportHistory({
      exportId: 'test',
      filters: {},
      format: 'csv',
      createdAt: new Date() // Just created, should not be expired
    });

    const result = exportHistory.isExpired;
    assert.strictEqual(result, false);
  });

  test('isExpired should return true for expired export', () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const exportHistory = new ExportHistory({
      exportId: 'test',
      filters: {},
      format: 'csv',
      createdAt: pastDate
    });

    const result = exportHistory.isExpired;
    assert.strictEqual(result, true);
  });

  test('should have cacheKey virtual property', () => {
    const instance = new ExportHistory({
      exportId: 'test',
      filters: { status: ['pending'] },
      format: 'csv'
    });
    assert(
      typeof instance.cacheKey === 'string',
      'cacheKey should be a virtual property returning string'
    );
    assert(
      instance.cacheKey.startsWith('export:'),
      'cacheKey should start with export:'
    );
  });

  test('should validate required fields', () => {
    const schema = ExportHistory.schema;
    const paths = schema.paths;

    // Updated required fields list (removed cacheKey since it's now virtual)
    const requiredFields = ['exportId', 'filters', 'format'];

    requiredFields.forEach((field) => {
      assert(paths[field].isRequired === true, `${field} should be required`);
    });
  });

  test('should have Mixed type for filters field', () => {
    const schema = ExportHistory.schema;
    const filtersPath = schema.paths.filters;

    assert(filtersPath.instance === 'Mixed');
  });

  test('should have Number type for numeric fields', () => {
    const schema = ExportHistory.schema;

    const numericFields = ['fileSize', 'taskCount', 'downloadCount'];

    numericFields.forEach((field) => {
      assert(
        schema.paths[field].instance === 'Number',
        `${field} should be Number type`
      );
    });
  });

  test('should have Date type for date fields', () => {
    const schema = ExportHistory.schema;

    // Updated date fields list (removed expiresAt since it's now virtual)
    const dateFields = ['createdAt', 'completedAt'];

    dateFields.forEach((field) => {
      assert(
        schema.paths[field].instance === 'Date',
        `${field} should be Date type`
      );
    });
  });
});
