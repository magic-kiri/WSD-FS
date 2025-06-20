import { test, describe } from 'node:test';
import assert from 'node:assert';

// Import ExportService
import ExportService from '../../src/services/exportService.js';
// Import formatting utilities
import {
  formatAsCSV,
  formatAsJSON,
  prepareTaskData,
  formatDateForExport
} from '../../src/utils/exportFormatters.js';

describe('ExportService Logic Tests', () => {
  test('should process CSV formatting correctly', () => {
    const taskData = [
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
      },
      {
        id: '2',
        title: 'Task 2',
        description: 'Second task',
        status: 'completed',
        priority: 'medium',
        estimatedTime: 30,
        actualTime: 25,
        createdAt: '2024-01-15 09:00:00',
        updatedAt: '2024-01-15 09:30:00',
        completedAt: '2024-01-15 09:25:00'
      }
    ];

    const csv = formatAsCSV(taskData);
    const lines = csv.split('\n');

    // Should have header + 2 data rows
    assert.strictEqual(lines.length, 3);

    // Check header
    const expectedHeaders = [
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
    const headers = lines[0].split(',');
    assert.deepStrictEqual(headers, expectedHeaders);

    // Check first data row
    const firstRow = lines[1].split(',');
    assert.strictEqual(firstRow[0], '1');
    assert.strictEqual(firstRow[1], 'Task 1');
    assert.strictEqual(firstRow[3], 'pending');
    assert.strictEqual(firstRow[4], 'high');

    // Check second data row
    const secondRow = lines[2].split(',');
    assert.strictEqual(secondRow[0], '2');
    assert.strictEqual(secondRow[3], 'completed');
    assert.strictEqual(secondRow[9], '2024-01-15 09:25:00'); // completedAt
  });

  test('should process JSON formatting correctly', () => {
    const taskData = [
      {
        id: '1',
        title: 'Task 1',
        status: 'pending',
        priority: 'high'
      }
    ];

    const jsonString = formatAsJSON(taskData);
    const parsed = JSON.parse(jsonString);

    // Check structure
    assert(typeof parsed.exportedAt === 'string');
    assert(typeof parsed.totalTasks === 'number');
    assert(Array.isArray(parsed.tasks));

    // Check values
    assert.strictEqual(parsed.totalTasks, 1);
    assert.strictEqual(parsed.tasks.length, 1);
    assert.strictEqual(parsed.tasks[0].id, '1');
    assert.strictEqual(parsed.tasks[0].title, 'Task 1');
    assert.strictEqual(parsed.tasks[0].status, 'pending');
    assert.strictEqual(parsed.tasks[0].priority, 'high');

    // Check timestamp format
    const exportedAt = new Date(parsed.exportedAt);
    assert(!isNaN(exportedAt.getTime()));
  });

  test('should build complex MongoDB queries correctly', () => {
    const complexFilters = {
      status: ['pending', 'in-progress'],
      priority: ['high'],
      createdFrom: '2024-01-01',
      createdTo: '2024-01-31',
      completedFrom: '2024-01-15',
      completedTo: '2024-01-31'
    };

    const query = ExportService.buildQueryFromFilters(complexFilters);

    // Status filter
    assert(query.status.$in);
    assert.strictEqual(query.status.$in.length, 2);
    assert(query.status.$in.includes('pending'));
    assert(query.status.$in.includes('in-progress'));

    // Priority filter
    assert.strictEqual(query.priority, 'high'); // Single value, not array

    // Created date range
    assert(query.createdAt);
    assert(query.createdAt.$gte instanceof Date);
    assert(query.createdAt.$lte instanceof Date);
    assert.strictEqual(
      query.createdAt.$gte.toISOString().split('T')[0],
      '2024-01-01'
    );
    assert.strictEqual(
      query.createdAt.$lte.toISOString().split('T')[0],
      '2024-01-31'
    );

    // Completed date range
    assert(query.completedAt);
    assert(query.completedAt.$gte instanceof Date);
    assert(query.completedAt.$lte instanceof Date);
  });

  test('should handle empty filters correctly', () => {
    const query = ExportService.buildQueryFromFilters({});

    // Empty filters should result in empty query
    assert.deepStrictEqual(query, {});
  });

  test('should handle single value arrays in filters', () => {
    const filters = {
      status: ['pending'],
      priority: ['high']
    };

    const query = ExportService.buildQueryFromFilters(filters);

    // Single values should not use $in operator
    assert.strictEqual(query.status, 'pending');
    assert.strictEqual(query.priority, 'high');
  });

  test('should process task data transformation correctly', () => {
    const mockTasks = [
      {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        priority: 'high',
        estimatedTime: 60,
        actualTime: null, // Should default to 0
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z'),
        completedAt: null
      },
      {
        _id: { toString: () => '507f1f77bcf86cd799439012' },
        title: 'Completed Task',
        description: '', // Empty description
        status: 'completed',
        priority: 'medium',
        estimatedTime: undefined, // Should default to 0
        actualTime: 45,
        createdAt: new Date('2024-01-14T09:00:00Z'),
        updatedAt: new Date('2024-01-14T09:45:00Z'),
        completedAt: new Date('2024-01-14T09:45:00Z')
      }
    ];

    const result = prepareTaskData(mockTasks);

    assert.strictEqual(result.length, 2);

    // First task
    const task1 = result[0];
    assert.strictEqual(task1.id, '507f1f77bcf86cd799439011');
    assert.strictEqual(task1.title, 'Test Task');
    assert.strictEqual(task1.description, 'Test Description');
    assert.strictEqual(task1.status, 'pending');
    assert.strictEqual(task1.priority, 'high');
    assert.strictEqual(task1.estimatedTime, 60);
    assert.strictEqual(task1.actualTime, 0); // null converted to 0
    assert.strictEqual(task1.createdAt, '2024-01-15 10:00:00');
    assert.strictEqual(task1.updatedAt, '2024-01-15 11:00:00');
    assert.strictEqual(task1.completedAt, ''); // null converted to empty string

    // Second task
    const task2 = result[1];
    assert.strictEqual(task2.id, '507f1f77bcf86cd799439012');
    assert.strictEqual(task2.title, 'Completed Task');
    assert.strictEqual(task2.description, ''); // Empty string preserved
    assert.strictEqual(task2.status, 'completed');
    assert.strictEqual(task2.priority, 'medium');
    assert.strictEqual(task2.estimatedTime, 0); // undefined converted to 0
    assert.strictEqual(task2.actualTime, 45);
    assert.strictEqual(task2.completedAt, '2024-01-14 09:45:00'); // Date formatted
  });

  test('should generate consistent cache keys for same filter sets', () => {
    const filters1 = {
      status: ['pending', 'completed'],
      priority: ['high'],
      createdFrom: '2024-01-01'
    };

    const filters2 = {
      priority: ['high'],
      status: ['pending', 'completed'],
      createdFrom: '2024-01-01'
    };

    const key1 = ExportService.generateCacheKey(filters1, 'csv');
    const key2 = ExportService.generateCacheKey(filters2, 'csv');

    // Keys should be the same regardless of property order
    assert.strictEqual(key1, key2);
  });

  test('should generate different cache keys for different formats', () => {
    const filters = { status: ['pending'] };

    const csvKey = ExportService.generateCacheKey(filters, 'csv');
    const jsonKey = ExportService.generateCacheKey(filters, 'json');

    assert(csvKey !== jsonKey);
    assert(csvKey.startsWith('export:'));
    assert(jsonKey.startsWith('export:'));
  });

  test('should handle CSV escaping edge cases', () => {
    const taskData = [
      {
        id: '1',
        title: 'Task with\nnewline',
        description: 'Has "quotes" and, commas',
        status: 'pending'
      },
      {
        id: '2',
        title: 'Task with ""double quotes""',
        description: 'Normal description',
        status: 'completed'
      }
    ];

    const csv = formatAsCSV(taskData);

    // Check that newlines are properly escaped
    assert(csv.includes('"Task with\nnewline"'));

    // Check that quotes and commas are properly escaped
    assert(csv.includes('"Has ""quotes"" and, commas"'));

    // Check that double quotes are properly escaped
    assert(csv.includes('"Task with """"double quotes"""""'));
  });

  test('should process sort options correctly', () => {
    const testCases = [
      { input: { sortBy: 'title', sortOrder: 'asc' }, expected: { title: 1 } },
      {
        input: { sortBy: 'title', sortOrder: 'desc' },
        expected: { title: -1 }
      },
      {
        input: { sortBy: 'createdAt', sortOrder: 'asc' },
        expected: { createdAt: 1 }
      },
      {
        input: { sortBy: 'priority', sortOrder: 'desc' },
        expected: { priority: -1 }
      },
      { input: {}, expected: { createdAt: -1 } }, // Default case
      { input: { sortBy: 'status' }, expected: { status: -1 } } // Default order
    ];

    testCases.forEach(({ input, expected }, index) => {
      const result = ExportService.getSortOptions(input);
      assert.deepStrictEqual(result, expected, `Test case ${index + 1} failed`);
    });
  });

  test('should calculate progress accurately', () => {
    const progressTests = [
      { status: 'pending', expected: 0 },
      { status: 'processing', expected: 50 },
      { status: 'completed', expected: 100 },
      { status: 'failed', expected: 0 },
      { status: null, expected: 0 },
      { status: undefined, expected: 0 },
      { status: 'invalid', expected: 0 }
    ];

    progressTests.forEach(({ status, expected }) => {
      const progress = ExportService.calculateProgress(status);
      assert.strictEqual(
        progress,
        expected,
        `Progress for status '${status}' should be ${expected}`
      );
    });
  });

  test('should handle date formatting edge cases', () => {
    const dateTests = [
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
      },
      { input: '2024-01-15T10:30:45.123Z', expected: '2024-01-15 10:30:45' },
      { input: null, expected: '' },
      { input: undefined, expected: '' },
      { input: '', expected: '' }
    ];

    dateTests.forEach(({ input, expected }, index) => {
      const result = formatDateForExport(input);
      assert.strictEqual(
        result,
        expected,
        `Date formatting test ${index + 1} failed`
      );
    });
  });

  test('should generate descriptive filenames with various scenarios', () => {
    const filenameTests = [
      {
        format: 'csv',
        filters: { status: ['pending'], priority: ['high'] },
        taskCount: 25,
        shouldInclude: ['csv', 'filtered-25']
      },
      {
        format: 'json',
        filters: {},
        taskCount: 100,
        shouldInclude: ['json', 'all-100']
      },
      {
        format: 'csv',
        filters: {
          status: ['pending', 'completed'],
          priority: ['high', 'medium'],
          createdFrom: '2024-01-01'
        },
        taskCount: 50,
        shouldInclude: ['csv', 'filtered-50']
      }
    ];

    const today = new Date().toISOString().split('T')[0];

    filenameTests.forEach(
      ({ format, filters, taskCount, shouldInclude }, index) => {
        const filename = ExportService.generateFilename(
          format,
          filters,
          taskCount
        );

        shouldInclude.forEach((substring) => {
          assert(
            filename.includes(substring),
            `Filename test ${index + 1}: should include '${substring}' in '${filename}'`
          );
        });

        assert(
          filename.includes(today),
          `Filename test ${index + 1}: should include today's date`
        );
      }
    );
  });

  test('should handle MIME type mapping correctly', () => {
    const mimeTests = [
      { format: 'csv', expected: 'text/csv' },
      { format: 'json', expected: 'application/json' },
      { format: 'pdf', expected: 'application/octet-stream' },
      { format: 'xlsx', expected: 'application/octet-stream' },
      { format: '', expected: 'application/octet-stream' },
      { format: null, expected: 'application/octet-stream' },
      { format: undefined, expected: 'application/octet-stream' }
    ];

    mimeTests.forEach(({ format, expected }) => {
      const mimeType = ExportService.getMimeType(format);
      assert.strictEqual(
        mimeType,
        expected,
        `MIME type for '${format}' should be '${expected}'`
      );
    });
  });

  test('should handle large task datasets in preparation', () => {
    // Create a large mock dataset
    const largeTasks = Array.from({ length: 1000 }, (_, index) => ({
      _id: { toString: () => `task_${index.toString().padStart(4, '0')}` },
      title: `Task ${index + 1}`,
      description: `Description for task ${index + 1}`,
      status: ['pending', 'in-progress', 'completed'][index % 3],
      priority: ['low', 'medium', 'high'][index % 3],
      estimatedTime: (index + 1) * 10,
      actualTime: index * 8,
      createdAt: new Date(Date.now() - index * 60000),
      updatedAt: new Date(Date.now() - index * 30000),
      completedAt: index % 3 === 2 ? new Date(Date.now() - index * 15000) : null
    }));

    const startTime = Date.now();
    const result = prepareTaskData(largeTasks);
    const endTime = Date.now();

    // Should process 1000 tasks
    assert.strictEqual(result.length, 1000);

    // Should be reasonably fast (less than 1 second)
    assert(
      endTime - startTime < 1000,
      'Processing 1000 tasks should take less than 1 second'
    );

    // Spot check some results
    assert.strictEqual(result[0].id, 'task_0000');
    assert.strictEqual(result[0].title, 'Task 1');
    assert.strictEqual(result[999].id, 'task_0999');
    assert.strictEqual(result[999].title, 'Task 1000');
  });
});
