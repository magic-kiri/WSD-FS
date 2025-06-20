// Mock data for testing
const mockTasks = [
  {
    _id: '1',
    title: 'Task 1',
    description: 'Description 1',
    status: 'pending',
    priority: 'high',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z')
  },
  {
    _id: '2',
    title: 'Task 2',
    description: 'Description 2',
    status: 'completed',
    priority: 'medium',
    createdAt: new Date('2024-01-02T10:00:00Z'),
    updatedAt: new Date('2024-01-02T10:00:00Z'),
    completedAt: new Date('2024-01-02T15:00:00Z')
  },
  {
    _id: '3',
    title: 'Task 3',
    description: 'Description 3',
    status: 'in-progress',
    priority: 'low',
    createdAt: new Date('2024-01-03T10:00:00Z'),
    updatedAt: new Date('2024-01-03T10:00:00Z')
  }
];

// Helper function to create mock request object
export const createMockReq = (query = {}) => ({
  query,
  method: 'GET',
  url: '/tasks'
});

// Helper function to create mock response object
export const createMockRes = () => {
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

// Mock Task model find method
const mockTaskFind = (query = {}) => ({
  sort: () => ({
    limit: () => ({
      skip: () => ({
        exec: async () => {
          // Apply basic filtering for testing
          let filteredTasks = [...mockTasks];

          // Date filtering
          if (query.createdAt) {
            if (query.createdAt.$gte) {
              filteredTasks = filteredTasks.filter(
                (task) =>
                  new Date(task.createdAt) >= new Date(query.createdAt.$gte)
              );
            }
            if (query.createdAt.$lte) {
              filteredTasks = filteredTasks.filter(
                (task) =>
                  new Date(task.createdAt) <= new Date(query.createdAt.$lte)
              );
            }
          }

          if (query.completedAt) {
            if (query.completedAt.$gte) {
              filteredTasks = filteredTasks.filter(
                (task) =>
                  task.completedAt &&
                  new Date(task.completedAt) >= new Date(query.completedAt.$gte)
              );
            }
            if (query.completedAt.$lte) {
              filteredTasks = filteredTasks.filter(
                (task) =>
                  task.completedAt &&
                  new Date(task.completedAt) <= new Date(query.completedAt.$lte)
              );
            }
          }

          // Status filtering
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

          // Priority filtering
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

// Mock Task model countDocuments method
const mockTaskCountDocuments = async (query = {}) => {
  let filteredTasks = [...mockTasks];

  // Date filtering
  if (query.createdAt) {
    if (query.createdAt.$gte) {
      filteredTasks = filteredTasks.filter(
        (task) => new Date(task.createdAt) >= new Date(query.createdAt.$gte)
      );
    }
    if (query.createdAt.$lte) {
      filteredTasks = filteredTasks.filter(
        (task) => new Date(task.createdAt) <= new Date(query.createdAt.$lte)
      );
    }
  }

  if (query.completedAt) {
    if (query.completedAt.$gte) {
      filteredTasks = filteredTasks.filter(
        (task) =>
          task.completedAt &&
          new Date(task.completedAt) >= new Date(query.completedAt.$gte)
      );
    }
    if (query.completedAt.$lte) {
      filteredTasks = filteredTasks.filter(
        (task) =>
          task.completedAt &&
          new Date(task.completedAt) <= new Date(query.completedAt.$lte)
      );
    }
  }

  // Status filtering
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

  // Priority filtering
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

  return filteredTasks.length;
};

// Setup mocks for testing
export const setupMocks = async () => {
  // Mock the Task model
  const TaskModule = await import('../../src/models/Task.js');
  TaskModule.default.find = mockTaskFind;
  TaskModule.default.countDocuments = mockTaskCountDocuments;
};

// Export mock data for use in tests
export { mockTasks };
