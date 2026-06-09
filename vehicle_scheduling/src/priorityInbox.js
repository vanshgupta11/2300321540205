const https = require('https');

/**
 * Priority Inbox Implementation
 * Fetches notifications and displays top 10 by priority score
 * Priority = (type_weight × 0.6) + (recency_factor × 0.4)
 */

class MinHeap {
  constructor() {
    this.heap = [];
  }

  parent(i) {
    return Math.floor((i - 1) / 2);
  }

  left(i) {
    return 2 * i + 1;
  }

  right(i) {
    return 2 * i + 2;
  }

  swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  insert(item) {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  bubbleUp(i) {
    while (i > 0 && this.heap[i].score < this.heap[this.parent(i)].score) {
      this.swap(i, this.parent(i));
      i = this.parent(i);
    }
  }

  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown(0);
    return min;
  }

  bubbleDown(i) {
    while (true) {
      let smallest = i;
      const l = this.left(i);
      const r = this.right(i);

      if (l < this.heap.length && this.heap[l].score < this.heap[smallest].score) {
        smallest = l;
      }
      if (r < this.heap.length && this.heap[r].score < this.heap[smallest].score) {
        smallest = r;
      }

      if (smallest !== i) {
        this.swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  getMin() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  size() {
    return this.heap.length;
  }

  toArray() {
    return [...this.heap].sort((a, b) => b.score - a.score);
  }
}

/**
 * Calculate priority score
 * Higher score = Higher priority
 */
function calculateScore(notification) {
  // Type weights
  const typeWeights = {
    'Placement': 10,
    'Result': 8,
    'Event': 5
  };

  const weight = typeWeights[notification.Type] || 5;

  // Calculate recency factor (0 to 1)
  const now = new Date();
  const notifTime = new Date(notification.Timestamp);
  const ageInHours = (now - notifTime) / (1000 * 60 * 60);
  
  // Decay: notifications lose score over time (exponential decay)
  const recencyFactor = Math.exp(-ageInHours / 24); // Half-life of 24 hours

  // Combined score
  const score = (weight * 0.6) + (recencyFactor * 0.4);
  
  return parseFloat(score.toFixed(2));
}

/**
 * Fetch notifications from API or use mock data
 */
function fetchNotifications() {
  return new Promise((resolve, reject) => {
    // Mock data for demonstration
    const mockNotifications = [
      { ID: "d146095a-0d86-4a34-9e69-3908a14576bc", Type: "Result", Message: "mid-sem", Timestamp: "2026-04-22 17:51:30" },
      { ID: "b283218f-ee5a-4b7c-93e9-1f2f240d64b0", Type: "Placement", Message: "CSX Corporation hiring", Timestamp: "2026-04-22 17:51:18" },
      { ID: "81589ada-0ad3-4f77-9554-f52fb558e09d", Type: "Event", Message: "farewell", Timestamp: "2026-04-22 17:51:06" },
      { ID: "0005513a-142b-4bbc-8678-eefec65e1ede", Type: "Result", Message: "mid-sem", Timestamp: "2026-04-22 17:50:54" },
      { ID: "ea836726-c25e-4f21-a72f-544a6af8a37f", Type: "Result", Message: "project-review", Timestamp: "2026-04-22 17:50:42" },
      { ID: "003cb427-8f6f-47f7-bb00-be228f6b0d2c", Type: "Result", Message: "external", Timestamp: "2026-04-22 17:50:30" },
      { ID: "e5c4ff20-31bf-4d40-8f02-72fda59e8918", Type: "Result", Message: "project-review", Timestamp: "2026-04-22 17:50:18" },
      { ID: "1cfce5ee-ad37-4894-8946-d70762717e6a5", Type: "Event", Message: "tech-fest", Timestamp: "2026-04-22 17:50:06" },
      { ID: "2a4c2b17-6b34-4be6-b2a1-8d4b7b1c9e2f", Type: "Placement", Message: "Google SDE role open", Timestamp: "2026-04-22 17:49:54" },
      { ID: "3f5d3c28-7c45-5cf7-c3b2-9e5c8c2d0f3a", Type: "Event", Message: "campus-drive", Timestamp: "2026-04-22 17:49:42" },
      { ID: "4g6e4d39-8d56-6dg8-d4c3-0f6d9d3e1g4b", Type: "Result", Message: "assignments", Timestamp: "2026-04-22 17:49:30" },
      { ID: "5h7f5e40-9e67-7eh9-e5d4-1g7e0e4f2h5c", Type: "Placement", Message: "TCS internship", Timestamp: "2026-04-22 17:49:18" },
      { ID: "6i8g6f41-0f78-8fi0-f6e5-2h8f1f5g3i6d", Type: "Event", Message: "alumni-meet", Timestamp: "2026-04-22 17:49:06" },
    ];

    // Try to fetch from API, fall back to mock data
    const url = 'https://4.224.186.213/evaluation-service/notifications';
    const options = {
      hostname: '4.224.186.213',
      path: '/evaluation-service/notifications',
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 2000,
      headers: {
        'User-Agent': 'Node.js Priority Inbox'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.notifications && parsed.notifications.length > 0) {
            resolve(parsed.notifications);
          } else {
            console.log('⚠️  API returned no notifications, using mock data...\n');
            resolve(mockNotifications);
          }
        } catch (e) {
          console.log('⚠️  Failed to parse API response, using mock data...\n');
          resolve(mockNotifications);
        }
      });
    }).on('error', (err) => {
      console.log('⚠️  API unreachable, using mock data...\n');
      resolve(mockNotifications);
    }).on('timeout', () => {
      req.destroy();
      console.log('⚠️  API timeout, using mock data...\n');
      resolve(mockNotifications);
    });

    req.end();
  });
}

/**
 * Main function: Get top 10 priority notifications
 */
async function getPriorityInbox(topN = 10) {
  try {
    console.log('🔄 Fetching notifications from API...\n');
    const startTime = Date.now();
    
    const notifications = await fetchNotifications();
    console.log(`✅ Fetched ${notifications.length} notifications\n`);

    if (notifications.length === 0) {
      console.log('No notifications available.');
      return;
    }

    // Calculate scores for all notifications
    const scoredNotifications = notifications.map(notif => ({
      ...notif,
      score: calculateScore(notif)
    }));

    // Build min-heap with top N
    const heap = new MinHeap();
    let heapOperations = 0;

    for (const notif of scoredNotifications) {
      if (heap.size() < topN) {
        heap.insert(notif);
        heapOperations++;
      } else {
        const minItem = heap.getMin();
        if (notif.score > minItem.score) {
          heap.extractMin();
          heapOperations++;
          heap.insert(notif);
          heapOperations++;
        }
      }
    }

    // Get results sorted by score (highest first)
    const topNotifications = heap.toArray();
    const processingTime = Date.now() - startTime;

    // Display results
    console.log('📌 PRIORITY INBOX (Top 10)\n');
    console.log('─'.repeat(80));
    
    topNotifications.forEach((notif, index) => {
      const typeColor = {
        'Placement': '🎯',
        'Result': '📊',
        'Event': '📅'
      }[notif.Type] || '📬';

      console.log(`${index + 1}. ${typeColor} [${notif.Type}] ${notif.Message}`);
      console.log(`   Score: ${notif.score.toFixed(2)} | Time: ${notif.Timestamp}`);
      console.log('');
    });

    console.log('─'.repeat(80));
    console.log('\n📈 Performance Metrics:');
    console.log(`   • Total notifications scanned: ${notifications.length}`);
    console.log(`   • Top N maintained: ${topN}`);
    console.log(`   • Heap operations: ${heapOperations}`);
    console.log(`   • Processing time: ${processingTime}ms`);
    console.log(`   • Avg time per notification: ${(processingTime / notifications.length).toFixed(3)}ms`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run if executed directly
if (require.main === module) {
  getPriorityInbox(10);
}

module.exports = { getPriorityInbox, calculateScore, MinHeap };
