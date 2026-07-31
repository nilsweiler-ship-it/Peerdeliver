export const SOCKET_EVENTS = {
  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',

  // Chat
  CHAT_JOIN: 'chat:join',
  CHAT_LEAVE: 'chat:leave',
  CHAT_MESSAGE: 'chat:message',
  CHAT_MESSAGE_NEW: 'chat:message:new',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',

  // Tracking
  TRACKING_START: 'tracking:start',
  TRACKING_STOP: 'tracking:stop',
  TRACKING_LOCATION_UPDATE: 'tracking:location:update',
  TRACKING_LOCATION_NEW: 'tracking:location:new',

  // Delivery
  DELIVERY_STATUS_CHANGED: 'delivery:status:changed',
  DELIVERY_MATCH_FOUND: 'delivery:match:found',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',

  // Errors (e.g. a tracking subscription the user isn't a party to)
  ERROR: 'error:message',
} as const;
