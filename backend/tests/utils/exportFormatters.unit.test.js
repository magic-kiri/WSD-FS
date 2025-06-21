import { test, describe, after } from 'node:test';
import assert from 'node:assert';

// Import formatting utilities
import {
  formatDateForExport,
  prepareTaskData,
  formatAsCSV,
  formatAsJSON
} from '../../src/utils/exportFormatters.js';

describe('Export Formatters Unit Tests', { timeout: 10000 }, () => {
  after(async () => {
    // Force exit after cleanup
    setTimeout(() => {
      console.log('🚪 Force exiting...');
      process.exit(0);
    }, 200);
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

  describe('prepareTaskData', () => {
    test('should transform basic task data correctly', () => {
      const mockTasks = [
        {
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
        }
      ];

      const result = prepareTaskData(mockTasks);

      assert(Array.isArray(result));
      assert.strictEqual(result.length, 1);

      const task = result[0];
      assert.strictEqual(task.id, '507f1f77bcf86cd799439011');
      assert.strictEqual(task.title, 'Test Task');
      assert.strictEqual(task.description, 'Test Description');
      assert.strictEqual(task.status, 'pending');
      assert.strictEqual(task.priority, 'high');
      assert.strictEqual(task.estimatedTime, 60);
      assert.strictEqual(task.actualTime, 45);
      assert.strictEqual(task.createdAt, '2024-01-15 10:00:00');
      assert.strictEqual(task.updatedAt, '2024-01-15 11:00:00');
      assert.strictEqual(task.completedAt, '2024-01-15 11:30:00');
    });

    test('should handle missing and null fields correctly', () => {
      const mockTasks = [
        {
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
        }
      ];

      const result = prepareTaskData(mockTasks);
      const task = result[0];

      assert.strictEqual(task.description, '');
      assert.strictEqual(task.estimatedTime, 0);
      assert.strictEqual(task.actualTime, 0);
      assert.strictEqual(task.completedAt, '');
    });

    test('should handle empty array', () => {
      const result = prepareTaskData([]);
      assert(Array.isArray(result));
      assert.strictEqual(result.length, 0);
    });

    test('should handle multiple tasks with different data types', () => {
      const mockTasks = [
        {
          _id: { toString: () => 'task1' },
          title: 'Task 1',
          description: 'Description 1',
          status: 'pending',
          priority: 'high',
          estimatedTime: 120,
          actualTime: 100,
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T12:00:00Z'),
          completedAt: null
        },
        {
          _id: { toString: () => 'task2' },
          title: 'Task 2',
          description: '',
          status: 'completed',
          priority: 'low',
          estimatedTime: 0,
          actualTime: 15,
          createdAt: new Date('2024-01-14T09:00:00Z'),
          updatedAt: new Date('2024-01-14T09:15:00Z'),
          completedAt: new Date('2024-01-14T09:15:00Z')
        }
      ];

      const result = prepareTaskData(mockTasks);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].id, 'task1');
      assert.strictEqual(result[0].completedAt, '');
      assert.strictEqual(result[1].id, 'task2');
      assert.strictEqual(result[1].description, '');
      assert.strictEqual(result[1].completedAt, '2024-01-14 09:15:00');
    });
  });

  describe('formatAsCSV', () => {
    test('should generate valid CSV with headers', () => {
      const taskData = [
        {
          id: '1',
          title: 'Task 1',
          description: 'Description 1',
          status: 'pending',
          priority: 'high'
        },
        {
          id: '2',
          title: 'Task 2',
          description: 'Description 2',
          status: 'completed',
          priority: 'medium'
        }
      ];

      const csv = formatAsCSV(taskData);
      const lines = csv.split('\n');

      assert.strictEqual(lines.length, 3); // header + 2 data rows
      assert.strictEqual(lines[0], 'id,title,description,status,priority');
      assert.strictEqual(lines[1], '1,Task 1,Description 1,pending,high');
      assert.strictEqual(lines[2], '2,Task 2,Description 2,completed,medium');
    });

    test('should handle empty array', () => {
      const csv = formatAsCSV([]);
      assert.strictEqual(csv, '');
    });

    test('should escape CSV special characters correctly', () => {
      const taskData = [
        {
          id: '1',
          title: 'Task with "quotes"',
          description: 'Description with, comma',
          status: 'pending'
        },
        {
          id: '2',
          title: 'Task with\nnewline',
          description: 'Description with ""double quotes""',
          status: 'completed'
        },
        {
          id: '3',
          title: 'Normal task',
          description: 'Text with\r\ncarriage return',
          status: 'in-progress'
        }
      ];

      const csv = formatAsCSV(taskData);

      // Check proper escaping
      assert(csv.includes('"Task with ""quotes"""'));
      assert(csv.includes('"Description with, comma"'));
      assert(csv.includes('"Task with\nnewline"'));
      assert(csv.includes('"Description with """"double quotes"""""'));
      assert(csv.includes('"Text with\r\ncarriage return"'));
    });

    test('should handle numeric and boolean values', () => {
      const taskData = [
        {
          id: 1,
          title: 'Task 1',
          estimatedTime: 120,
          actualTime: 0,
          isCompleted: false
        }
      ];

      const csv = formatAsCSV(taskData);
      const lines = csv.split('\n');

      assert.strictEqual(lines[1], '1,Task 1,120,0,false');
    });

    test('should handle null and undefined values', () => {
      const taskData = [
        {
          id: '1',
          title: 'Task 1',
          description: null,
          notes: undefined,
          status: 'pending'
        }
      ];

      const csv = formatAsCSV(taskData);
      const lines = csv.split('\n');

      // Check that the CSV contains the proper values
      assert.strictEqual(lines[0], 'id,title,description,notes,status');
      assert.strictEqual(lines[1], '1,Task 1,,,pending');

      // Verify that null and undefined become empty strings in CSV
      const values = lines[1].split(',');
      assert.strictEqual(values[2], ''); // null description becomes empty
      assert.strictEqual(values[3], ''); // undefined notes becomes empty
    });
  });

  describe('formatAsJSON', () => {
    test('should generate valid JSON with metadata', () => {
      const taskData = [
        {
          id: '1',
          title: 'Task 1',
          status: 'pending'
        },
        {
          id: '2',
          title: 'Task 2',
          status: 'completed'
        }
      ];

      const jsonString = formatAsJSON(taskData);
      const parsed = JSON.parse(jsonString);

      // Check structure
      assert(typeof parsed.exportedAt === 'string');
      assert(typeof parsed.totalTasks === 'number');
      assert(Array.isArray(parsed.tasks));

      // Check values
      assert.strictEqual(parsed.totalTasks, 2);
      assert.strictEqual(parsed.tasks.length, 2);
      assert.strictEqual(parsed.tasks[0].id, '1');
      assert.strictEqual(parsed.tasks[1].id, '2');

      // Check timestamp format (should be valid ISO string)
      const exportedAt = new Date(parsed.exportedAt);
      assert(!isNaN(exportedAt.getTime()));
    });

    test('should handle empty array', () => {
      const jsonString = formatAsJSON([]);
      const parsed = JSON.parse(jsonString);

      assert.strictEqual(parsed.totalTasks, 0);
      assert(Array.isArray(parsed.tasks));
      assert.strictEqual(parsed.tasks.length, 0);
      assert(typeof parsed.exportedAt === 'string');
    });

    test('should preserve data types in JSON', () => {
      const taskData = [
        {
          id: 1,
          title: 'Task 1',
          isCompleted: true,
          estimatedTime: 120.5,
          tags: ['urgent', 'bug'],
          metadata: {
            source: 'api',
            version: 2
          }
        }
      ];

      const jsonString = formatAsJSON(taskData);
      const parsed = JSON.parse(jsonString);

      const task = parsed.tasks[0];
      assert.strictEqual(typeof task.id, 'number');
      assert.strictEqual(typeof task.isCompleted, 'boolean');
      assert.strictEqual(typeof task.estimatedTime, 'number');
      assert(Array.isArray(task.tags));
      assert(typeof task.metadata === 'object');
      assert.strictEqual(task.metadata.version, 2);
    });

    test('should format JSON with proper indentation', () => {
      const taskData = [{ id: '1', title: 'Task 1' }];
      const jsonString = formatAsJSON(taskData);

      // Check that it's formatted with 2-space indentation
      assert(jsonString.includes('  "exportedAt"'));
      assert(jsonString.includes('  "totalTasks"'));
      assert(jsonString.includes('  "tasks"'));
    });

    test('should handle complex nested data', () => {
      const taskData = [
        {
          id: '1',
          title: 'Complex Task',
          assignees: [
            { name: 'John', role: 'developer' },
            { name: 'Jane', role: 'designer' }
          ],
          history: {
            created: '2024-01-15T10:00:00Z',
            lastModified: '2024-01-15T11:00:00Z',
            changes: 5
          }
        }
      ];

      const jsonString = formatAsJSON(taskData);
      const parsed = JSON.parse(jsonString);

      const task = parsed.tasks[0];
      assert.strictEqual(task.assignees.length, 2);
      assert.strictEqual(task.assignees[0].name, 'John');
      assert.strictEqual(task.history.changes, 5);
    });
  });

  describe('Integration Tests', () => {
    test('should work together for complete export flow', () => {
      const mockTasks = [
        {
          _id: { toString: () => 'task1' },
          title: 'Integration Task',
          description: 'Test description with, comma',
          status: 'completed',
          priority: 'high',
          estimatedTime: 60,
          actualTime: 45,
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:45:00Z'),
          completedAt: new Date('2024-01-15T10:45:00Z')
        }
      ];

      // Prepare data
      const preparedData = prepareTaskData(mockTasks);
      assert.strictEqual(preparedData.length, 1);

      // Format as CSV
      const csv = formatAsCSV(preparedData);
      assert(csv.includes('Integration Task'));
      assert(csv.includes('"Test description with, comma"'));

      // Format as JSON
      const jsonString = formatAsJSON(preparedData);
      const parsed = JSON.parse(jsonString);
      assert.strictEqual(parsed.totalTasks, 1);
      assert.strictEqual(parsed.tasks[0].title, 'Integration Task');
    });

    test('should handle large datasets efficiently', () => {
      // Create a larger dataset
      const largeMockTasks = Array.from({ length: 100 }, (_, index) => ({
        _id: { toString: () => `task_${index}` },
        title: `Task ${index + 1}`,
        description: `Description ${index + 1}`,
        status: ['pending', 'completed', 'in-progress'][index % 3],
        priority: ['low', 'medium', 'high'][index % 3],
        estimatedTime: (index + 1) * 10,
        actualTime: index * 8,
        createdAt: new Date(Date.now() - index * 60000),
        updatedAt: new Date(Date.now() - index * 30000),
        completedAt:
          index % 3 === 1 ? new Date(Date.now() - index * 15000) : null
      }));

      const startTime = Date.now();

      const preparedData = prepareTaskData(largeMockTasks);
      const csvData = formatAsCSV(preparedData);
      const jsonData = formatAsJSON(preparedData);

      const endTime = Date.now();

      // Performance check (should complete within reasonable time)
      assert(endTime - startTime < 1000, 'Processing should be fast');

      // Data integrity checks
      assert.strictEqual(preparedData.length, 100);
      assert(csvData.split('\n').length >= 100); // At least 100 rows + header

      const parsedJson = JSON.parse(jsonData);
      assert.strictEqual(parsedJson.totalTasks, 100);
      assert.strictEqual(parsedJson.tasks.length, 100);
    });
  });
});
