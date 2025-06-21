import { test, describe, after } from 'node:test';
import assert from 'node:assert';

// Import formatting utilities
import {
  formatDateForExport,
  formatTaskForExport,
  taskToCsvRow,
  formatChunksAsCSV,
  formatChunksAsJSON,
  getDefaultFields,
  buildQueryFromFilters
} from '../../src/utils/exportFormatters.js';

describe('Export Formatters Unit Tests', { timeout: 10000 }, () => {
  after(async () => {
    // Force exit after cleanup
    setTimeout(() => {
      console.log('🚪 Force exiting...');
      process.exit(0);
    }, 200);
  });

  describe('getDefaultFields', () => {
    test('should return correct default field names', () => {
      const fields = getDefaultFields();
      const expectedFields = [
        'id',
        'title',
        'description',
        'status',
        'priority',
        'estimatedTime',
        'actualTime',
        'createdAt',
        'updatedAt',
        'completedAt'
      ];

      assert(Array.isArray(fields), 'Should return an array');
      assert.strictEqual(
        fields.length,
        expectedFields.length,
        'Should have correct number of fields'
      );
      assert.deepStrictEqual(
        fields,
        expectedFields,
        'Should return expected field names in correct order'
      );
    });

    test('should return same array on multiple calls', () => {
      const fields1 = getDefaultFields();
      const fields2 = getDefaultFields();

      assert.deepStrictEqual(
        fields1,
        fields2,
        'Should return consistent results'
      );
    });
  });

  describe('buildQueryFromFilters - Text Search', () => {
    test('should handle text search with single word', () => {
      const filters = { text: 'urgent' };
      const query = buildQueryFromFilters(filters);

      assert(query.$or, 'Should have $or query');
      assert.strictEqual(query.$or.length, 2, 'Should search in 2 fields');

      // Check title search
      assert(query.$or[0].title, 'Should search in title');
      assert(query.$or[0].title.$regex, 'Should use regex for title');
      assert.strictEqual(
        query.$or[0].title.$regex.source,
        'urgent',
        'Should search for correct text in title'
      );
      assert.strictEqual(
        query.$or[0].title.$regex.flags,
        'i',
        'Should be case insensitive for title'
      );

      // Check description search
      assert(query.$or[1].description, 'Should search in description');
      assert(
        query.$or[1].description.$regex,
        'Should use regex for description'
      );
      assert.strictEqual(
        query.$or[1].description.$regex.source,
        'urgent',
        'Should search for correct text in description'
      );
      assert.strictEqual(
        query.$or[1].description.$regex.flags,
        'i',
        'Should be case insensitive for description'
      );
    });

    test('should handle text search with multiple words', () => {
      const filters = { text: 'urgent task' };
      const query = buildQueryFromFilters(filters);

      assert(query.$or, 'Should have $or query');
      assert.strictEqual(
        query.$or[0].title.$regex.source,
        'urgent task',
        'Should search for full phrase in title'
      );
      assert.strictEqual(
        query.$or[1].description.$regex.source,
        'urgent task',
        'Should search for full phrase in description'
      );
    });

    test('should handle text search with special regex characters', () => {
      const filters = { text: 'test (urgent)' };
      const query = buildQueryFromFilters(filters);

      assert(query.$or, 'Should have $or query');
      assert.strictEqual(
        query.$or[0].title.$regex.source,
        'test \\(urgent\\)',
        'Should escape special characters in title for security'
      );
      assert.strictEqual(
        query.$or[1].description.$regex.source,
        'test \\(urgent\\)',
        'Should escape special characters in description for security'
      );
    });

    test('should trim whitespace from text search', () => {
      const filters = { text: '  urgent  ' };
      const query = buildQueryFromFilters(filters);

      assert(query.$or, 'Should have $or query');
      assert.strictEqual(
        query.$or[0].title.$regex.source,
        'urgent',
        'Should trim whitespace from title search'
      );
      assert.strictEqual(
        query.$or[1].description.$regex.source,
        'urgent',
        'Should trim whitespace from description search'
      );
    });

    test('should not add text search for empty string', () => {
      const filters = { text: '' };
      const query = buildQueryFromFilters(filters);

      assert(!query.$or, 'Should not have $or query for empty string');
    });

    test('should not add text search for whitespace-only string', () => {
      const filters = { text: '   ' };
      const query = buildQueryFromFilters(filters);

      assert(
        !query.$or,
        'Should not have $or query for whitespace-only string'
      );
    });

    test('should not add text search for null text', () => {
      const filters = { text: null };
      const query = buildQueryFromFilters(filters);

      assert(!query.$or, 'Should not have $or query for null text');
    });

    test('should not add text search for undefined text', () => {
      const filters = { text: undefined };
      const query = buildQueryFromFilters(filters);

      assert(!query.$or, 'Should not have $or query for undefined text');
    });

    test('should combine text search with other filters', () => {
      const filters = {
        text: 'urgent',
        status: ['pending'],
        priority: ['high']
      };
      const query = buildQueryFromFilters(filters);

      // Should have text search
      assert(query.$or, 'Should have text search');
      assert.strictEqual(
        query.$or[0].title.$regex.source,
        'urgent',
        'Should have text search in title'
      );

      // Should have status filter
      assert.strictEqual(query.status, 'pending', 'Should have status filter');

      // Should have priority filter
      assert.strictEqual(query.priority, 'high', 'Should have priority filter');
    });
  });

  describe('formatDateForExport', () => {
    test('should format ISO date strings correctly', () => {
      const testCases = [
        {
          input: new Date('2024-01-15T10:30:45.123Z'),
          expected: '2024-01-15 10:30:45'
        },
        {
          input: new Date('2024-12-31T23:59:59.999Z'),
          expected: '2024-12-31 23:59:59'
        },
        {
          input: new Date('2024-01-01T00:00:00.000Z'),
          expected: '2024-01-01 00:00:00'
        }
      ];

      testCases.forEach(({ input, expected }, index) => {
        const result = formatDateForExport(input);
        assert.strictEqual(result, expected, `Test case ${index + 1} failed`);
      });
    });

    test('should format string dates correctly', () => {
      const result = formatDateForExport('2024-01-15T10:30:45.123Z');
      assert.strictEqual(result, '2024-01-15 10:30:45');
    });

    test('should handle null, undefined, and empty values', () => {
      const testCases = [
        { input: null, expected: '' },
        { input: undefined, expected: '' },
        { input: '', expected: '' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formatDateForExport(input);
        assert.strictEqual(result, expected, `Failed for input: ${input}`);
      });
    });

    test('should handle edge case dates', () => {
      const testCases = [
        {
          input: new Date('1970-01-01T00:00:00.000Z'),
          expected: '1970-01-01 00:00:00'
        },
        {
          input: new Date('2099-12-31T23:59:59.000Z'),
          expected: '2099-12-31 23:59:59'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formatDateForExport(input);
        assert.strictEqual(result, expected);
      });
    });
  });

  describe('formatTaskForExport', () => {
    test('should transform basic task data correctly', () => {
      const mockTask = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        priority: 'high',
        estimatedTime: 60,
        actualTime: 45,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z'),
        completedAt: new Date('2024-01-15T11:30:00Z')
      };

      const result = formatTaskForExport(mockTask);

      assert.strictEqual(result.id, '507f1f77bcf86cd799439011');
      assert.strictEqual(result.title, 'Test Task');
      assert.strictEqual(result.description, 'Test Description');
      assert.strictEqual(result.status, 'pending');
      assert.strictEqual(result.priority, 'high');
      assert.strictEqual(result.estimatedTime, 60);
      assert.strictEqual(result.actualTime, 45);
      assert.strictEqual(result.createdAt, '2024-01-15 10:00:00');
      assert.strictEqual(result.updatedAt, '2024-01-15 11:00:00');
      assert.strictEqual(result.completedAt, '2024-01-15 11:30:00');
    });

    test('should handle missing and null fields correctly', () => {
      const mockTask = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        title: 'Minimal Task',
        // description missing
        status: 'pending',
        priority: 'medium',
        // estimatedTime missing
        actualTime: null,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z'),
        completedAt: null
      };

      const result = formatTaskForExport(mockTask);

      assert.strictEqual(result.description, '');
      assert.strictEqual(result.estimatedTime, 0);
      assert.strictEqual(result.actualTime, 0);
      assert.strictEqual(result.completedAt, '');
    });
  });

  describe('taskToCsvRow', () => {
    test('should convert task to CSV row correctly', () => {
      const task = {
        id: '1',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        priority: 'high'
      };

      const csvRow = taskToCsvRow(task);
      assert.strictEqual(csvRow, '1,Test Task,Test Description,pending,high');
    });

    test('should handle CSV escaping', () => {
      const task = {
        id: '1',
        title: 'Task with "quotes"',
        description: 'Description with, comma',
        status: 'pending'
      };

      const csvRow = taskToCsvRow(task);
      assert(csvRow.includes('"Task with ""quotes"""'));
      assert(csvRow.includes('"Description with, comma"'));
    });
  });

  describe('formatChunksAsCSV', () => {
    test('should format task chunks as CSV', () => {
      const chunks = [
        [
          {
            id: '1',
            title: 'Task 1',
            description: 'First task',
            status: 'pending',
            priority: 'high',
            estimatedTime: 60,
            actualTime: 0,
            createdAt: '2024-01-15 10:00:00',
            updatedAt: '2024-01-15 11:00:00',
            completedAt: ''
          }
        ]
      ];

      const csv = formatChunksAsCSV(chunks);
      const lines = csv.split('\n');

      // Should have header + 1 data row + empty line at end
      assert(lines.length >= 2);
      assert(lines[0].includes('id,title,description'));
      assert(lines[1].includes('1,Task 1,First task'));
    });
  });

  describe('formatChunksAsJSON', () => {
    test('should format task chunks as JSON', () => {
      const chunks = [
        [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending'
          }
        ]
      ];

      const jsonString = formatChunksAsJSON(chunks, 1);
      const parsed = JSON.parse(jsonString);

      assert(typeof parsed.exportedAt === 'string');
      assert.strictEqual(parsed.totalTasks, 1);
      assert(Array.isArray(parsed.tasks));
      assert.strictEqual(parsed.tasks.length, 1);
      assert.strictEqual(parsed.tasks[0].id, '1');
    });
  });
});
