# Stage 1: Notification System Design

## REST API Endpoints

**POST /api/v1/notifications** - Create notification
```json
{
  "title": "string",
  "message": "string", 
  "category": "PLACEMENT | EVENT | RESULT",
  "priority": "LOW | MEDIUM | HIGH",
  "targetGroup": "ALL | BATCH_2024 | BATCH_2025",
  "metadata": { "placementId": "string", "actionUrl": "string" }
}
```
**GET /api/v1/notifications** - Get user notifications

**GET /api/v1/notifications/:id** - Get single notification

**PATCH /api/v1/notifications/:id/read** - Mark as read

**PATCH /api/v1/notifications/bulk/read** - Mark multiple as read
```json
{ "notificationIds": ["id1", "id2"] }
```

**DELETE /api/v1/notifications/:id** - Delete notification

**GET /api/v1/notifications/stats** - Get stats (total, unread, by category)

**PATCH /api/v1/subscriptions** - Update preferences
```json
{ "categories": { "PLACEMENT": true }, "emailNotifications": true }
```
`wss://api.campus-notifications.com/ws/notifications`

**Authentication:**
```json
{ "type": "AUTHENTICATE", "token": "Bearer <JWT>" }
{ "type": "AUTHENTICATED", "userId": "string" }
```

**Notification Received:**
```json
{
  "type": "NOTIFICATION_RECEIVED",
  "data": { "notificationId": "string", "title": "string", "category": "string" }
}
```

**Keep-Alive:** PING -> PONG

## Tech Stack
- WebSocket: Socket.io
- Cache: Redis (subscriptions, user prefs)
- Queue: Redis (notifications)
## Security
- JWT authentication on all endpoints
- RBAC for admin (role-based access)
- Rate limiting: 100 req/min per user
- Input validation

## API Standards
- Endpoints: kebab-case `/api/v1/notifications`
- Query/JSON: camelCase `sortBy`, `isRead`
- Methods: GET, POST, PATCH, DELETE
- Error: `{ status: "error", code: "BAD_REQUEST", message: "..." }`

---

# Stage 2: Database Schema & Persistence

## Database Choice: MongoDB (NoSQL)

**Why MongoDB?**
- Flexible schema (notifications have different metadata)
- Horizontal scaling (sharding support)
- Fast writes/reads for high-volume real-time data
- Documents store nested data (metadata, user refs)

## Collections & Schema

### notifications
```javascript
{
  _id: ObjectId,
  notificationId: "UUID",
  title: "string",
  message: "string",
  category: "PLACEMENT|EVENT|RESULT",
  priority: "LOW|MEDIUM|HIGH",
  createdAt: ISODate,
  expiresAt: ISODate,
  metadata: {
    placementId: "string",
    eventId: "string",
    actionUrl: "string"
  },
  targetGroup: "ALL|BATCH_2024|BATCH_2025",
  isActive: boolean
}
```

### user_notifications (junction table for tracking user reads)
```javascript
{
  _id: ObjectId,
  userId: "UUID",
  notificationId: "UUID",
  isRead: boolean,
  readAt: ISODate,
  createdAt: ISODate
}
```



## Indexes (Performance)
```javascript
// notifications collection
db.notifications.createIndex({ createdAt: -1 })
db.notifications.createIndex({ category: 1, createdAt: -1 })
db.notifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
db.notifications.createIndex({ targetGroup: 1 })

// user_notifications collection
db.user_notifications.createIndex({ userId: 1, createdAt: -1 })
db.user_notifications.createIndex({ notificationId: 1, userId: 1 })
db.user_notifications.createIndex({ isRead: 1, userId: 1 })

// subscriptions collection
db.subscriptions.createIndex({ userId: 1 }, { unique: true })
```

## Scaling Problems & Solutions

### Problem 1: Data Volume Explosion
**As millions of user-notification mappings pile up**
- Solution: TTL index on expiresAt to auto-delete old data
- Solution: Archive notifications after 90 days to cold storage
- Solution: Separate collection for read status (user_notifications) prevents replicating data

### Problem 2: Query Performance Degrades
**Searching across huge datasets gets slow**
- Solution: Sharding by userId (ensures data is distributed)
- Solution: Create indexes on frequently queried fields
- Solution: Pagination (max 100 records per request)

### Problem 3: Write Bottlenecks
**High throughput of notifications slows writes**
- Solution: Use message queue (Redis/RabbitMQ) before inserting to DB
- Solution: Batch inserts (insert multiple records at once)
- Solution: Write replicas for read-heavy operations

### Problem 4: Real-time Delivery Lag
**Notifications pile up faster than delivery**
- Solution: Caching layer (Redis) for hot data
- Solution: Async write-behind caching
- Solution: Event streaming (Kafka) for notification distribution

## Sample Queries (MongoDB)

### 1. Create Notification (POST /api/v1/notifications)
```javascript
db.notifications.insertOne({
  notificationId: UUID(),
  title: "Google SDE Hiring",
  message: "New placement opportunity",
  category: "PLACEMENT",
  priority: "HIGH",
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 30*24*60*60*1000),
  metadata: { placementId: "PLM_001", actionUrl: "/placements/PLM_001" },
  targetGroup: "BATCH_2024",
  isActive: true
})

// Insert for each affected user in user_notifications
db.user_notifications.insertMany([
  { userId: "USER_1", notificationId: "NOT_001", isRead: false, createdAt: new Date() },
  { userId: "USER_2", notificationId: "NOT_001", isRead: false, createdAt: new Date() }
])
```

### 2. Get User Notifications (GET /api/v1/notifications?page=1&limit=20&category=PLACEMENT)
```javascript
db.user_notifications.aggregate([
  { $match: { userId: "USER_123", isRead: false } },
  { $lookup: {
      from: "notifications",
      localField: "notificationId",
      foreignField: "notificationId",
      as: "notification"
    }
  },
  { $unwind: "$notification" },
  { $match: { "notification.category": "PLACEMENT" } },
  { $sort: { "notification.createdAt": -1 } },
  { $skip: 0 },
  { $limit: 20 },
  { $project: { 
      notificationId: 1, 
      title: "$notification.title", 
      message: "$notification.message",
      category: "$notification.category",
      isRead: 1,
      createdAt: "$notification.createdAt"
    }
  }
])
```

### 3. Mark as Read (PATCH /api/v1/notifications/:id/read)
```javascript
db.user_notifications.updateOne(
  { userId: "USER_123", notificationId: "NOT_001" },
  { 
    $set: { 
      isRead: true, 
      readAt: new Date() 
    } 
  }
)
```

### 4. Bulk Mark as Read (PATCH /api/v1/notifications/bulk/read)
```javascript
db.user_notifications.updateMany(
  { userId: "USER_123", notificationId: { $in: ["NOT_001", "NOT_002", "NOT_003"] } },
  { 
    $set: { 
      isRead: true, 
      readAt: new Date() 
    } 
  }
)
```

### 5. Get Stats (GET /api/v1/notifications/stats)
```javascript
db.user_notifications.aggregate([
  { $match: { userId: "USER_123" } },
  { $lookup: {
      from: "notifications",
      localField: "notificationId",
      foreignField: "notificationId",
      as: "notification"
    }
  },
  { $unwind: "$notification" },
  { $facet: {
      totalCount: [ { $count: "count" } ],
      unreadCount: [ { $match: { isRead: false } }, { $count: "count" } ],
      byCategory: [
        { $group: { 
            _id: "$notification.category", 
            count: { $sum: 1 } 
          }
        }
      ]
    }
  }
])
```

### 6. Delete Notification (DELETE /api/v1/notifications/:id)
```javascript
// Soft delete (mark inactive)
db.notifications.updateOne(
  { notificationId: "NOT_001" },
  { $set: { isActive: false } }
)

// Also remove user associations
db.user_notifications.deleteMany({ notificationId: "NOT_001" })
```

### 7. Get Subscriptions (GET /api/v1/subscriptions)
```javascript
db.subscriptions.findOne({ userId: "USER_123" })
```

### 8. Update Subscriptions (PATCH /api/v1/subscriptions)
```javascript
db.subscriptions.updateOne(
  { userId: "USER_123" },
  { 
    $set: { 
      "categories.PLACEMENT": true,
      "categories.EVENT": false,
      emailNotifications: true,
      updatedAt: new Date()
    } 
  },
  { upsert: true }
)
```
