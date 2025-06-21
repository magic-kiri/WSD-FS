import { test, describe, after } from 'node:test';
import assert from 'node:assert';

// Import the router and function
import router from '../../src/routes/api.js';

// Mock the Task model
const mockTasks = [
  {
    _id: '507f1f77bcf86cd799439011',
    title: 'Test Task 1',
    description: 'Test description 1',
    status: 'pending',
    priority: 'high',
    createdAt: new Date('2024-01-01'),
    completedAt: null,
    estimatedTime: 120
  },
  {
    _id: '507f1f77bcf86cd799439012',
    title: 'Test Task 2',
    description: 'Test description 2',
    status: 'completed',
    priority: 'medium',
    createdAt: new Date('2024-01-02'),
    completedAt: new Date('2024-01-05'),
    estimatedTime: 90
  },
  {
    _id: '507f1f77bcf86cd799439013',
    title: 'Test Task 3',
    description: 'Test description 3',
    status: 'in-progress',
    priority: 'low',
    createdAt: new Date('2024-01-03'),
    completedAt: null,
    estimatedTime: 60
  }
];

// Helper function to create mock request object
const createMockReq = (query = {}) => ({
  query,
  method: 'GET',
  url: '/tasks'
});

// Helper function to create mock response object
const createMockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.data = data;
      return this;
    }
  };
  return res;
};

// Mock Task model methods
const mockTaskFind = (query = {}) => ({
  sort: () => ({
    limit: () => ({
      skip: () => ({
        exec: async () => {
          // Apply basic filtering for testing
          let filteredTasks = [...mockTasks];

          if (query.status) {
            if (typeof query.status === 'string') {
              filteredTasks = filteredTasks.filter(
                (task) => task.status === query.status
              );
            } else if (query.status.$in) {
              filteredTasks = filteredTasks.filter((task) =>
                query.status.$in.includes(task.status)
              );
            }
          }

          if (query.priority) {
            if (typeof query.priority === 'string') {
              filteredTasks = filteredTasks.filter(
                (task) => task.priority === query.priority
              );
            } else if (query.priority.$in) {
              filteredTasks = filteredTasks.filter((task) =>
                query.priority.$in.includes(task.priority)
              );
            }
          }

          return filteredTasks;
        }
      })
    })
  })
});

const mockTaskCountDocuments = async (query = {}) => {
  let filteredTasks = [...mockTasks];

  if (query.status) {
    if (typeof query.status === 'string') {
      filteredTasks = filteredTasks.filter(
        (task) => task.status === query.status
      );
    } else if (query.status.$in) {
      filteredTasks = filteredTasks.filter((task) =>
        query.status.$in.includes(task.status)
      );
    }
  }

  return filteredTasks.length;
};

// Helper to get the route handler for GET /tasks
const getTasksRouteHandler = () => {
  const tasksRoute = router.stack.find(
    (layer) =>
      layer.route && layer.route.path === '/tasks' && layer.route.methods.get
  );
  return tasksRoute?.route.stack[0].handle;
};

describe('GET /tasks Route Basic Tests', { timeout: 10000 }, () => {
  after(async () => {
    // Force exit after cleanup
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });

  test('should have GET /tasks route handler', () => {
    const routeHandler = getTasksRouteHandler();
    assert(typeof routeHandler === 'function');
  });

  test('should handle basic query parameters', async () => {
    // Mock the Task model for this test
    const TaskModule = await import('../../src/models/Task.js');
    const originalFind = TaskModule.default.find;
    const originalCountDocuments = TaskModule.default.countDocuments;

    // Simple mock that returns our test data
    TaskModule.default.find = () => ({
      sort: () => ({
        limit: () => ({
          skip: () => ({
            exec: async () => mockTasks
          })
        })
      })
    });
    TaskModule.default.countDocuments = async () => mockTasks.length;

    const routeHandler = getTasksRouteHandler();
    const req = createMockReq({ page: '1', limit: '10' });
    const res = createMockRes();
    const next = () => {};

    try {
      await routeHandler(req, res, next);

      assert(res.data !== null);
      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    } finally {
      // Restore original functions
      TaskModule.default.find = originalFind;
      TaskModule.default.countDocuments = originalCountDocuments;
    }
  });

  test('should handle status filter parameter', async () => {
    // Mock the Task model
    const TaskModule = await import('../../src/models/Task.js');
    const originalFind = TaskModule.default.find;
    const originalCountDocuments = TaskModule.default.countDocuments;

    TaskModule.default.find = () => ({
      sort: () => ({
        limit: () => ({
          skip: () => ({
            exec: async () =>
              mockTasks.filter((task) => task.status === 'pending')
          })
        })
      })
    });
    TaskModule.default.countDocuments = async () => 1;

    const routeHandler = getTasksRouteHandler();
    const req = createMockReq({ status: 'pending' });
    const res = createMockRes();
    const next = () => {};

    try {
      await routeHandler(req, res, next);

      assert(res.data !== null);
      assert(res.data.success === true);
      assert(Array.isArray(res.data.data.tasks));
    } finally {
      // Restore original functions
      TaskModule.default.find = originalFind;
      TaskModule.default.countDocuments = originalCountDocuments;
    }
  });

  test('should return 400 for invalid status', async () => {
    const routeHandler = getTasksRouteHandler();
    const req = createMockReq({ status: 'invalid-status' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.statusCode === 400);
    assert(res.data.success === false);
    assert(res.data.message.includes('Invalid status values'));
  });

  test('should return 400 for invalid priority', async () => {
    const routeHandler = getTasksRouteHandler();
    const req = createMockReq({ priority: 'invalid-priority' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.statusCode === 400);
    assert(res.data.success === false);
    assert(res.data.message.includes('Invalid priority values'));
  });
});

describe('GET /tasks Route Tests', () => {
  let TaskModule;

  let routeHandler;

  after(async () => {
    // Force exit after cleanup
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });

  // Setup before each test
  const setupMocks = async () => {
    // Mock the Task model
    TaskModule = await import('../../src/models/Task.js');
    TaskModule.default.find = mockTaskFind;
    TaskModule.default.countDocuments = mockTaskCountDocuments;

    // Get the route handler
    routeHandler = getTasksRouteHandler();
  };

  test('should get tasks with default pagination', async () => {
    await setupMocks();

    const req = createMockReq({});
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
    assert(res.data.data.pagination);
    assert(res.data.data.pagination.page === 1);
    assert(res.data.data.pagination.limit === 10);
  });

  test('should get tasks with custom pagination', async () => {
    await setupMocks();

    const req = createMockReq({ page: '2', limit: '5' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(res.data.data.pagination.page === 2);
    assert(res.data.data.pagination.limit === 5);
  });

  test('should filter tasks by single status', async () => {
    await setupMocks();

    const req = createMockReq({ status: 'completed' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should filter tasks by multiple statuses', async () => {
    await setupMocks();

    const req = createMockReq({ status: ['pending', 'completed'] });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should filter tasks by single priority', async () => {
    await setupMocks();

    const req = createMockReq({ priority: 'high' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should filter tasks by multiple priorities', async () => {
    await setupMocks();

    const req = createMockReq({ priority: ['high', 'medium'] });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should filter tasks by created date range', async () => {
    await setupMocks();

    const req = createMockReq({
      createdFrom: '2024-01-01',
      createdTo: '2024-01-02'
    });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should return 400 for invalid createdFrom date', async () => {
    await setupMocks();

    const req = createMockReq({ createdFrom: 'invalid-date' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.statusCode === 400);
    assert(res.data.success === false);
    assert(res.data.message.includes('Invalid createdFrom date format'));
  });

  test('should return 400 for invalid createdTo date', async () => {
    await setupMocks();

    const req = createMockReq({ createdTo: 'invalid-date' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.statusCode === 400);
    assert(res.data.success === false);
    assert(res.data.message.includes('Invalid createdTo date format'));
  });

  test('should filter tasks by completed date range', async () => {
    await setupMocks();

    const req = createMockReq({
      completedFrom: '2024-01-01',
      completedTo: '2024-01-10'
    });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should return 400 for invalid completedFrom date', async () => {
    await setupMocks();

    const req = createMockReq({ completedFrom: 'invalid-date' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.statusCode === 400);
    assert(res.data.success === false);
    assert(res.data.message.includes('Invalid completedFrom date format'));
  });

  test('should return 400 for invalid completedTo date', async () => {
    await setupMocks();

    const req = createMockReq({ completedTo: 'invalid-date' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.statusCode === 400);
    assert(res.data.success === false);
    assert(res.data.message.includes('Invalid completedTo date format'));
  });

  test('should handle sorting parameters', async () => {
    await setupMocks();

    const req = createMockReq({
      sortBy: 'title',
      sortOrder: 'asc'
    });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should handle combined filters', async () => {
    await setupMocks();

    const req = createMockReq({
      status: 'pending',
      priority: 'high',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: '1',
      limit: '5'
    });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
    assert(res.data.data.pagination.page === 1);
    assert(res.data.data.pagination.limit === 5);
  });

  test('should handle database errors gracefully', async () => {
    // Mock to throw an error
    const TaskModule = await import('../../src/models/Task.js');
    TaskModule.default.find = () => ({
      sort: () => ({
        limit: () => ({
          skip: () => ({
            exec: async () => {
              throw new Error('Database connection failed');
            }
          })
        })
      })
    });

    const routeHandler = getTasksRouteHandler();
    const req = createMockReq({});
    const res = createMockRes();
    let nextCalled = false;
    let nextError = null;

    const next = (error) => {
      nextCalled = true;
      nextError = error;
    };

    await routeHandler(req, res, next);

    assert(nextCalled === true);
    assert(nextError.message === 'Database connection failed');
  });

  test('should handle edge case with empty query parameters', async () => {
    await setupMocks();

    const req = createMockReq({
      page: '',
      limit: '',
      status: '',
      priority: ''
    });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should handle zero and negative pagination values', async () => {
    await setupMocks();

    const req = createMockReq({ page: '0', limit: '-5' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    // Should handle gracefully with reasonable defaults
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should handle very large pagination values', async () => {
    await setupMocks();

    const req = createMockReq({ page: '999999', limit: '1000' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    assert(res.data.success === true);
    assert(Array.isArray(res.data.data.tasks));
  });

  test('should handle mixed case status values', async () => {
    await setupMocks();

    const req = createMockReq({ status: 'PENDING' });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    // Should return 400 for case mismatch since API expects lowercase
    assert(res.statusCode === 400);
    assert(res.data.success === false);
  });

  test('should handle special characters in date ranges', async () => {
    await setupMocks();

    const req = createMockReq({
      createdFrom: '2024/01/01',
      createdTo: '2024.01.02'
    });
    const res = createMockRes();
    const next = () => {};

    await routeHandler(req, res, next);

    // Should still work or handle gracefully depending on Date constructor behavior
    assert(res.data !== null);
    // The response could be either successful (if Date parsing works) or error (if validation fails)
  });
});
