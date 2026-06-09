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

**GET /api/v1/subscriptions** - Get user subscription preferences

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
