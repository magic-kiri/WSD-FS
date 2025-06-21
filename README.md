# Tech Test: Task Analytics Dashboard

> **Note**: This repository is used for internal technical candidate assessments and is not intended for production use.

A real-time task analytics dashboard built with Vue.js 3, Node.js, MongoDB, and Redis. This application demonstrates full-stack development skills with WebSocket integration and caching strategies.

## 🚀 Features

### Backend Features
- ✅ **RESTful API** with Express.js for task CRUD operations
- ✅ **MongoDB Integration** with Mongoose for data persistence
- ✅ **Redis Caching** for individual task lookups (GET /tasks/:id)
- ✅ **Socket.IO** for real-time analytics and notifications
- ✅ **Analytics Engine** calculating metrics in real-time
- ✅ **Task Management** with status and priority tracking
- ✅ **Error Handling** with comprehensive middleware
- ✅ **Code Coverage** with Node.js test runner and comprehensive reporting

### Frontend Features
- ✅ **Vue.js 3 SPA** with Composition API
- ✅ **Vuetify 3** for modern UI components
- ✅ **Pinia** for state management
- ✅ **Real-time Updates** via Socket.IO client
- ✅ **Analytics Dashboard** with live charts
- ✅ **Task Management** with filtering and pagination
- ✅ **Responsive Design** for desktop and mobile
- ✅ **Dark Mode** support
- ✅ **Code Coverage** with Vitest and detailed reporting

### Real-time Features
- 📊 **Live Analytics Updates** - Task metrics update in real-time
- 🔔 **Smart Notifications** - Alerts when completion rate drops below 50%
- ⚡ **Instant Task Updates** - Changes sync across all connected clients
- 🌐 **Connection Status** - Visual indicator of WebSocket connection

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vue.js 3 SPA  │────│   Express API   │────│    MongoDB      │
│   (Frontend)    │    │   (Backend)     │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       
         │                       │              ┌─────────────────┐
         │                       └──────────────│     Redis       │
         │                                      │   (Caching)     │
         │                                      └─────────────────┘
         │                                               
         │              ┌─────────────────┐              
         └──────────────│   Socket.IO     │              
                        │  (Real-time)    │              
                        └─────────────────┘              
```

## 📋 Prerequisites

- **Node.js v24+** (specified in package.json engines)
- **Docker & Docker Compose** for MongoDB and Redis
- **Git** for version control

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd wsd-fullstack-js-tech-test
```

### 2. Start Database Services

```bash
docker-compose up -d
```

This starts:
- **MongoDB** on port 27018 (no authentication)
- **Redis** on port 6380 (no authentication)

### 3. Setup Backend

```bash
cd backend
cp .env.example .env    # Important: Copy environment variables
npm install
npm run seed            # Generate sample task data (optional)
npm run dev
```

**Note**: Make sure to copy `.env.example` to `.env` - the application reads configuration from the `.env` file.

Backend runs on `http://localhost:3001`

### 4. Setup Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## 🎯 Running the Application

### Development Mode

1. **Start databases**: `docker-compose up -d`
2. **Start backend**: `cd backend && npm run dev`
3. **Start frontend**: `cd frontend && npm run dev`
4. **Generate sample data**: `cd backend && npm run seed` (optional)
5. **Access dashboard**: `http://localhost:5173`

### Sample Data Generation

Generate realistic sample tasks to populate the dashboard:

```bash
cd backend
npm run seed          # Generate 50 sample tasks (default)
npm run seed:small    # Generate 25 sample tasks
npm run seed:large    # Generate 100 sample tasks
```

The seeding script creates:
- **Diverse task categories**: Development, design, planning, maintenance
- **Realistic distributions**: 40% completed, 30% in-progress, 30% pending
- **Priority weighting**: 20% high, 50% medium, 30% low
- **Time tracking**: Estimated and actual completion times
- **Historical data**: Tasks spanning the last 3 months

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test                    # Run tests
npm run test:coverage      # Run with coverage
```

### Frontend Tests

```bash
cd frontend
npm test                    # Run tests
npm run test:coverage      # Run with coverage
```

Both test suites include comprehensive coverage reporting.

## 📊 API Reference

### Base URL
```
http://localhost:3001/api
```

### Authentication
No authentication required for this technical assessment.

### Endpoints

#### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List tasks with pagination and filtering |
| GET | `/tasks/:id` | Get single task (cached with Redis) |
| POST | `/tasks` | Create new task |
| PUT | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |

#### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics` | Get task analytics and metrics |

#### Exports

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/exports` | Initiate a new export request |
| GET | `/exports/:exportId/status` | Get export status and progress |
| GET | `/exports/:exportId/download` | Download completed export file |
| GET | `/exports/history` | Get user's export history with pagination |
| POST | `/exports/:exportId/repeat` | Repeat a failed export |

#### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health check |

### Request/Response Examples

#### GET /tasks
```bash
curl "http://localhost:3001/api/tasks?page=1&limit=5&status=completed"
```

#### POST /tasks
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement new feature",
    "description": "Add user profile functionality",
    "priority": "high",
    "estimatedTime": 120
  }'
```

#### PUT /tasks/:id
```bash
curl -X PUT http://localhost:3001/api/tasks/123456 \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

#### POST /exports
```bash
curl -X POST http://localhost:3001/api/exports \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "filters": {
      "status": ["completed", "in-progress"],
      "priority": "high",
      "createdFrom": "2024-01-01",
      "createdTo": "2024-12-31"
    }
  }'
```

#### GET /exports/:exportId/status
```bash
curl "http://localhost:3001/api/exports/abc123/status"
```

#### GET /exports/history
```bash
curl "http://localhost:3001/api/exports/history?page=1&limit=10&status=completed"
```

### Query Parameters (GET /tasks)

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status (pending, in-progress, completed)
- `priority`: Filter by priority (low, medium, high)
- `sortBy`: Sort field (createdAt, updatedAt, title, priority, status)
- `sortOrder`: Sort direction (asc, desc)

### Query Parameters (GET /exports/history)

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by export status (pending, processing, completed, failed, expired)
- `format`: Filter by export format (csv, json)

### Export Request Schema

```json
{
  "format": "csv|json (required)",
  "filters": {
    "text": "string (search in title/description)",
    "status": "string|array (task status filter)",
    "priority": "string|array (task priority filter)",
    "createdFrom": "string (YYYY-MM-DD format)",
    "createdTo": "string (YYYY-MM-DD format)",
    "completedFrom": "string (YYYY-MM-DD format)",
    "completedTo": "string (YYYY-MM-DD format)"
  }
}
```

### Export Response Schema

```json
{
  "exportId": "string (unique identifier)",
  "status": "pending|processing|completed|failed|expired",
  "format": "csv|json",
  "filters": "object (applied filters)",
  "progress": "number (0-100 percentage)",
  "totalRecords": "number (total tasks to export)",
  "processedRecords": "number (tasks processed so far)",
  "fileSize": "number (file size in bytes)",
  "downloadUrl": "string (download endpoint)",
  "createdAt": "ISO 8601 date",
  "completedAt": "ISO 8601 date or null",
  "expiresAt": "ISO 8601 date",
  "cached": "boolean (whether result was cached)"
}
```

### Task Schema

```json
{
  "_id": "string",
  "title": "string (required, max 200 chars)",
  "description": "string (max 1000 chars)",
  "status": "pending|in-progress|completed",
  "priority": "low|medium|high",
  "createdAt": "ISO 8601 date",
  "updatedAt": "ISO 8601 date",
  "completedAt": "ISO 8601 date or null",
  "estimatedTime": "number (hours)",
  "actualTime": "number (hours)"
}
```

## 🔄 Real-time Events

### Socket.IO Events

#### Client → Server
- `join-analytics`: Join analytics room for updates
- `request-analytics`: Request current analytics data

#### Server → Client
- `analytics-update`: Real-time analytics data
- `task-update`: Task CRUD notifications
- `notification`: System notifications
- `connect/disconnect`: Connection status

## 📈 Analytics Metrics

The dashboard tracks:

- **Total Tasks**: Count of all tasks
- **Completion Rate**: Percentage of completed tasks
- **Tasks Created Today**: New tasks in the last 24 hours
- **Tasks Completed Today**: Completed tasks in the last 24 hours
- **Average Completion Time**: Mean time from creation to completion
- **Status Distribution**: Tasks grouped by status
- **Priority Distribution**: Tasks grouped by priority
- **Recent Activity**: Last 10 task updates

## 🎨 UI Components

### Dashboard Views
- **Dashboard**: Overview with metrics and charts
- **Tasks**: Full task management with CRUD operations
- **Analytics**: Detailed analytics and reporting

### Key Components
- **MetricCard**: Display key performance indicators
- **TaskList**: Paginated task listing with filters
- **TaskFormDialog**: Create/edit task modal
- **TaskStatusChart**: Pie chart for status distribution
- **TaskPriorityChart**: Bar chart for priority distribution
- **RecentActivity**: Live activity feed
- **NotificationDrawer**: Real-time notifications

## ⚙️ Configuration

### Environment Variables

#### Backend (.env)
```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27018/task_analytics
REDIS_HOST=localhost
REDIS_PORT=6380
SOCKET_IO_CORS_ORIGIN=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
```

## 🔧 Code Quality

### ESLint Configuration
- **Backend**: Google JavaScript Style Guide with ES modules
- **Frontend**: Vue.js style guide with Prettier integration
- **Rules**: Enforce semicolons, single quotes, proper indentation

### Prettier Configuration
- Consistent code formatting
- Aligned with ESLint rules
- Automatic formatting on save

## 🚀 Deployment

### Production Build

```bash
# Backend
cd backend
npm run start

# Frontend
cd frontend
npm run build
npm run preview
```

### Docker Support
The `docker-compose.yml` includes MongoDB and Redis services. For full containerization, add Dockerfile for the application services.

## 📝 Technical Decisions

### Why These Technologies?

- **Vue.js 3**: Modern reactive framework with Composition API
- **Vuetify 3**: Material Design components for rapid UI development
- **Pinia**: Official Vue.js state management with TypeScript support
- **Node.js v24**: Latest LTS with ES modules and test runner
- **MongoDB**: Document database perfect for task data structure
- **Redis**: High-performance caching for individual task lookups
- **Socket.IO**: Reliable real-time communication

### Architecture Patterns

- **Separation of Concerns**: Clear separation between frontend, backend, and database
- **RESTful API Design**: Standard HTTP methods and status codes
- **Real-time First**: WebSocket integration for live updates
- **Caching Strategy**: Strategic Redis caching for performance
- **Error Handling**: Comprehensive error middleware and user feedback

## 🔍 Performance Optimizations

- **Redis Caching**: Individual task lookups cached for 5 minutes
- **MongoDB Indexing**: Optimized queries for status, priority, and dates
- **Pagination**: Efficient handling of large task lists
- **Real-time Throttling**: Analytics updates limited to prevent spam
- **Component Lazy Loading**: Vue.js route-based code splitting

## 🐛 Troubleshooting

### Common Issues

1. **Connection Refused**: Check if Docker services are running
2. **Module Not Found**: Ensure all dependencies are installed
3. **Port Already in Use**: Check if ports 3001, 5173, 27018, 6380 are available
4. **MongoDB Authentication Failed**: Clean restart Docker volumes (see below)
5. **Real-time Not Working**: Verify CORS settings and Socket.IO connection

#### MongoDB Authentication Issues

If you get "Authentication failed" errors, clean restart the Docker containers:

```bash
# Stop and remove containers with volumes
docker-compose down -v

# Remove any existing volumes (this will delete all data)
docker volume prune -f

# Start fresh
docker-compose up -d

# Wait for services to be ready
sleep 10

# Verify MongoDB is accessible
mongosh "mongodb://localhost:27018/task_analytics" --eval "db.runCommand('ping')"
```

### Debug Commands

```bash
# Check Docker services
docker-compose ps

# Check API health
curl http://localhost:3001/api/health

# Test database connections
mongosh "mongodb://localhost:27018/task_analytics"
redis-cli -h localhost -p 6380 ping

# View logs
docker-compose logs mongodb
docker-compose logs redis
```

## 📚 Learning Resources

This project demonstrates:
- Modern JavaScript (ES2024)
- Vue.js 3 Composition API
- Node.js backend development
- MongoDB document modeling
- Redis caching strategies
- Real-time WebSocket communication
- RESTful API design
- Test-driven development
- Code quality tools (ESLint, Prettier)

## 🤝 Contributing

1. Follow the established code style (ESLint + Prettier)
2. Maintain test coverage above 60%
3. Document new features and API changes
4. Test both frontend and backend changes

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for the technical assessment. This project showcases full-stack JavaScript development with modern tools and best practices.
