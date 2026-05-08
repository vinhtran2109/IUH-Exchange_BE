/**
 * Gateway route definitions.
 * Each route maps a path prefix to a downstream service with access control flags.
 *
 * Public routes skip JWT auth entirely.
 * Protected routes require a valid Bearer token.
 */

const SERVICES = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  product: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
  chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3005',
  lostfound: process.env.LOSTFOUND_SERVICE_URL || 'http://localhost:3006',
};

/**
 * Route table — order matters (first match wins via express.Router).
 *
 * @type {Array<{
 *   path: string,
 *   service: string,
 *   public: boolean,
 *   rateLimiter?: 'global' | 'auth' | 'sensitive',
 *   methods?: string[],
 *   stripPrefix?: boolean,
 * }>}
 */
const routes = [
  // ── Public: Auth ──────────────────────────────────────
  {
    path: '/api/v1/auth',
    service: 'user',
    public: true,
    rateLimiter: 'auth',
  },

  // ── Public: Product browsing (GET only) ───────────────
  {
    path: '/api/v1/products',
    service: 'product',
    public: true,
    methods: ['GET'],
    rateLimiter: 'global',
  },

  // ── Public: Lost & found browsing (GET only) ──────────
  {
    path: '/api/v1/lost-found',
    service: 'lostfound',
    public: true,
    methods: ['GET'],
    rateLimiter: 'global',
  },

  // ── Protected: User profile ───────────────────────────
  {
    path: '/api/v1/users',
    service: 'user',
    public: false,
    rateLimiter: 'global',
  },

  // ── Protected: Product mutations ──────────────────────
  // (POST/PUT/DELETE on products — GET already handled above)
  {
    path: '/api/v1/products',
    service: 'product',
    public: false,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    rateLimiter: 'sensitive',
  },

  // ── Protected: Orders ─────────────────────────────────
  {
    path: '/api/v1/orders',
    service: 'order',
    public: false,
    rateLimiter: 'sensitive',
  },

  // ── Protected: Notifications ──────────────────────────
  {
    path: '/api/v1/notifications',
    service: 'notification',
    public: false,
    rateLimiter: 'global',
  },

  // ── Protected: Chat ───────────────────────────────────
  {
    path: '/api/v1/chat',
    service: 'chat',
    public: false,
    rateLimiter: 'global',
  },

  // ── Protected: Lost & found mutations ─────────────────
  {
    path: '/api/v1/lost-found',
    service: 'lostfound',
    public: false,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    rateLimiter: 'sensitive',
  },

  // ── Protected: Reports ────────────────────────────────
  {
    path: '/api/v1/reports',
    service: 'lostfound',
    public: false,
    rateLimiter: 'sensitive',
  },
];

export { SERVICES, routes };
