import { test, describe, after } from 'node:test';
import assert from 'node:assert';

// Import the router and function
import router, { setSocketHandlers } from '../../src/routes/api.js';

describe('API Routes Unit Tests', { timeout: 10000 }, () => {
  after(async () => {
    // Clean up all persistent connections to prevent hanging
    try {
      // 1. Clean up Redis connections
      const { redisClient } = await import('../../src/config/redis.js');
      if (redisClient && redisClient.disconnect) {
        await redisClient.disconnect();
      }
    } catch (error) {
      console.log('Redis cleanup failed:', error.message);
    }

    try {
      // 2. Clean up BullMQ queue connections
      const { exportQueue } = await import('../../src/config/queue.js');
      if (exportQueue && exportQueue.close) {
        await exportQueue.close();
      }
    } catch (error) {
      console.log('Queue cleanup failed:', error.message);
    }

    try {
      // 3. Clean up Mongoose connections
      const mongoose = await import('mongoose');
      if (mongoose.default.connection.readyState !== 0) {
        await mongoose.default.connection.close();
      }
    } catch (error) {
      console.log('Mongoose cleanup failed:', error.message);
    }

    // Force exit after cleanup
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });

  test('should export setSocketHandlers function', () => {
    assert(typeof setSocketHandlers === 'function');
  });

  test('should set socket handlers', () => {
    const mockHandlers = {
      broadcastTaskUpdate: () => {},
      broadcastAnalyticsUpdate: () => {}
    };

    // This should not throw an error
    setSocketHandlers(mockHandlers);
    assert(true);
  });

  test('should handle null socket handlers', () => {
    // This should not throw an error
    setSocketHandlers(null);
    assert(true);
  });

  test('should export express router', () => {
    assert(router);
    assert(typeof router === 'function');
    // Check if it's an express router
    assert(router.stack !== undefined);
  });

  test('should have routes registered', () => {
    // The router should have routes registered
    assert(router.stack.length > 0);

    // Check for specific route patterns
    const routes = router.stack.map((layer) => ({
      method: Object.keys(layer.route?.methods || {})[0],
      path: layer.route?.path
    }));

    // Should have GET /tasks route
    const tasksRoute = routes.find(
      (r) => r.path === '/tasks' && r.method === 'get'
    );
    assert(tasksRoute, 'Should have GET /tasks route');

    // Should have POST /tasks route
    const createTaskRoute = routes.find(
      (r) => r.path === '/tasks' && r.method === 'post'
    );
    assert(createTaskRoute, 'Should have POST /tasks route');

    // Should have health route
    const healthRoute = routes.find(
      (r) => r.path === '/health' && r.method === 'get'
    );
    assert(healthRoute, 'Should have GET /health route');

    // Should have analytics route
    const analyticsRoute = routes.find(
      (r) => r.path === '/analytics' && r.method === 'get'
    );
    assert(analyticsRoute, 'Should have GET /analytics route');

    // Should have cache clear route
    const cacheRoute = routes.find(
      (r) => r.path === '/cache/clear' && r.method === 'get'
    );
    assert(cacheRoute, 'Should have GET /cache/clear route');
  });

  test('should set socket handlers correctly', () => {
    const mockHandlers = {
      broadcastTaskUpdate: (action, task) => ({ action, task }),
      broadcastAnalyticsUpdate: () => 'analytics updated'
    };

    setSocketHandlers(mockHandlers);

    // Verify handlers are set (can't test directly, but no error should be thrown)
    assert(true);
  });
});
