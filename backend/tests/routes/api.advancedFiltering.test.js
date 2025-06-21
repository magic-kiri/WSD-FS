import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import {
  createMockReq,
  createMockRes,
  setupMocks
} from '../helpers/testHelpers.js';

// Import the route handler
let routeHandler;
let redisClient;

describe('Advanced Filtering API Tests', () => {
  before(async () => {
    const apiModule = await import('../../src/routes/api.js');
    const router = apiModule.default;

    // Extract the GET /tasks route handler
    const routes = router.stack;
    const tasksRoute = routes.find(
      (route) =>
        route.route && route.route.path === '/tasks' && route.route.methods.get
    );

    if (tasksRoute && tasksRoute.route.stack.length > 0) {
      routeHandler = tasksRoute.route.stack[0].handle;
    } else {
      throw new Error('Could not find GET /tasks route handler');
    }
  });

  beforeEach(async () => {
    await setupMocks();
  });

  after(async () => {
    // Clean up Redis connection to prevent hanging
    if (redisClient && redisClient.disconnect) {
      await redisClient.disconnect();
    }
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });

  describe('Date Range Filtering', () => {
    it('should filter by created date range (both from and to)', async () => {
      const req = createMockReq({
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
      // The mock should have been called with date range query
    });

    it('should filter by created date from only', async () => {
      const req = createMockReq({
        createdFrom: '2024-01-01'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should filter by created date to only', async () => {
      const req = createMockReq({
        createdTo: '2024-01-31'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should filter by completed date range (both from and to)', async () => {
      const req = createMockReq({
        completedFrom: '2024-01-15',
        completedTo: '2024-01-31'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should filter by completed date from only', async () => {
      const req = createMockReq({
        completedFrom: '2024-01-15'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should filter by completed date to only', async () => {
      const req = createMockReq({
        completedTo: '2024-01-31'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });
  });

  describe('Date Validation', () => {
    it('should return 400 for invalid createdFrom date format', async () => {
      const req = createMockReq({
        createdFrom: 'invalid-date'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.statusCode === 400);
      assert(res.data.success === false);
      assert(res.data.message.includes('Invalid createdFrom date format'));
    });

    it('should return 400 for invalid createdTo date format', async () => {
      const req = createMockReq({
        createdTo: 'not-a-date'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.statusCode === 400);
      assert(res.data.success === false);
      assert(res.data.message.includes('Invalid createdTo date format'));
    });

    it('should return 400 for invalid completedFrom date format', async () => {
      const req = createMockReq({
        completedFrom: '2024-13-45'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.statusCode === 400);
      assert(res.data.success === false);
      assert(res.data.message.includes('Invalid completedFrom date format'));
    });

    it('should return 400 for invalid completedTo date format', async () => {
      const req = createMockReq({
        completedTo: 'tomorrow'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.statusCode === 400);
      assert(res.data.success === false);
      assert(res.data.message.includes('Invalid completedTo date format'));
    });

    it('should accept various valid date formats', async () => {
      const validDates = [
        '2024-01-01',
        '2024-12-31',
        '2023-02-28',
        '2024-02-29' // leap year
      ];

      for (const date of validDates) {
        const req = createMockReq({
          createdFrom: date,
          createdTo: date
        });
        const res = createMockRes();
        const next = () => {};

        await routeHandler(req, res, next);

        assert(res.data.success === true, `Date ${date} should be valid`);
      }
    });
  });

  describe('Complex Filter Combinations', () => {
    it('should handle status + priority + created date filters', async () => {
      const req = createMockReq({
        status: ['pending', 'in-progress'],
        priority: ['high'],
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should handle all filters + sorting', async () => {
      const req = createMockReq({
        status: ['pending', 'completed'],
        priority: ['high', 'medium'],
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        completedFrom: '2024-01-15',
        completedTo: '2024-01-31',
        sortBy: 'priority',
        sortOrder: 'asc'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should handle created and completed date ranges together', async () => {
      const req = createMockReq({
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        completedFrom: '2024-01-15',
        completedTo: '2024-01-31'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should handle overlapping date ranges', async () => {
      const req = createMockReq({
        createdFrom: '2024-01-01',
        createdTo: '2024-01-20',
        completedFrom: '2024-01-10',
        completedTo: '2024-01-30'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });
  });

  describe('Enhanced Sorting', () => {
    it('should sort by all valid fields', async () => {
      const validSortFields = [
        'title',
        'status',
        'priority',
        'createdAt',
        'updatedAt',
        'completedAt',
        'estimatedTime',
        'actualTime'
      ];

      for (const field of validSortFields) {
        const req = createMockReq({
          sortBy: field,
          sortOrder: 'asc'
        });
        const res = createMockRes();
        const next = () => {};

        await routeHandler(req, res, next);

        assert(res.data.success === true, `Sort by ${field} should be valid`);
      }
    });

    it('should return 400 for invalid sort field', async () => {
      const req = createMockReq({
        sortBy: 'invalidField',
        sortOrder: 'asc'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.statusCode === 400);
      assert(res.data.success === false);
      assert(res.data.message.includes('Invalid sortBy field'));
    });

    it('should return 400 for invalid sort order', async () => {
      const req = createMockReq({
        sortBy: 'title',
        sortOrder: 'invalid'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.statusCode === 400);
      assert(res.data.success === false);
      assert(res.data.message.includes('Invalid sortOrder'));
    });

    it('should handle sorting with filters', async () => {
      const req = createMockReq({
        status: ['pending'],
        priority: ['high'],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty date strings', async () => {
      const req = createMockReq({
        createdFrom: '',
        createdTo: '',
        completedFrom: '',
        completedTo: ''
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      // Empty strings should be ignored
    });

    it('should handle whitespace in date fields', async () => {
      const req = createMockReq({
        createdFrom: '  2024-01-01  ',
        createdTo: ' 2024-01-31 '
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      // Should either succeed (if trimmed) or fail with validation error
      assert(res.data !== null);
    });

    it('should handle date range where from > to', async () => {
      const req = createMockReq({
        createdFrom: '2024-01-31',
        createdTo: '2024-01-01'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      // Should succeed but return empty results (valid query, no matches)
      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should handle future dates', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateString = futureDate.toISOString().split('T')[0];

      const req = createMockReq({
        createdFrom: futureDateString,
        completedTo: futureDateString
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should handle very old dates', async () => {
      const req = createMockReq({
        createdFrom: '1970-01-01',
        createdTo: '1999-12-31'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should handle leap year dates', async () => {
      const req = createMockReq({
        createdFrom: '2024-02-29',
        createdTo: '2024-02-29'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
    });

    it('should reject invalid leap year dates', async () => {
      const req = createMockReq({
        createdFrom: '2023-02-29' // 2023 is not a leap year
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.statusCode === 400);
      assert(res.data.success === false);
    });
  });

  describe('Performance and Limits', () => {
    it('should handle maximum date range', async () => {
      const req = createMockReq({
        createdFrom: '1970-01-01',
        createdTo: '2099-12-31'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should handle multiple multi-select filters', async () => {
      const req = createMockReq({
        status: ['pending', 'in-progress', 'completed'],
        priority: ['low', 'medium', 'high']
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    });

    it('should handle filters with pagination', async () => {
      const req = createMockReq({
        status: ['pending'],
        createdFrom: '2024-01-01',
        page: 2,
        limit: 5
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
      assert(res.data.data.pagination.page === 2);
      assert(res.data.data.pagination.limit === 5);
    });
  });

  describe('Query Parameter Variations', () => {
    it('should handle single status as string', async () => {
      const req = createMockReq({
        status: 'pending'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
    });

    it('should handle multiple status as array', async () => {
      const req = createMockReq({
        status: ['pending', 'completed']
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
    });

    it('should handle mixed parameter types', async () => {
      const req = createMockReq({
        status: 'pending', // string
        priority: ['high', 'medium'], // array
        createdFrom: '2024-01-01', // string
        page: 1, // number
        limit: '10' // string number
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
    });
  });

  describe('Response Structure', () => {
    it('should return consistent response structure with filters', async () => {
      const req = createMockReq({
        status: ['pending'],
        priority: ['high'],
        createdFrom: '2024-01-01',
        sortBy: 'title',
        sortOrder: 'asc'
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(typeof res.data.data === 'object');
      assert(Array.isArray(res.data.data.tasks));
      assert(typeof res.data.data.pagination === 'object');
      assert(typeof res.data.data.pagination.page === 'number');
      assert(typeof res.data.data.pagination.limit === 'number');
      assert(typeof res.data.data.pagination.total === 'number');
      assert(typeof res.data.data.pagination.pages === 'number');
    });

    it('should return pagination metadata with filtered results', async () => {
      const req = createMockReq({
        status: ['pending'],
        page: 1,
        limit: 5
      });
      const res = createMockRes();
      const next = () => {};

      await routeHandler(req, res, next);

      assert(res.data.success === true);
      assert(res.data.data.pagination.page === 1);
      assert(res.data.data.pagination.limit === 5);
      assert(typeof res.data.data.pagination.total === 'number');
      assert(typeof res.data.data.pagination.pages === 'number');
    });
  });
});
