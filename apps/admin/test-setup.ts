process.env.ADMIN_JWT_SECRET ||= "test-admin-jwt-secret-must-be-at-least-32-chars";
process.env.USER_JWT_SECRET ||= "test-user-jwt-secret-must-be-at-least-32-chars";
process.env.FIELD_ENCRYPTION_KEY ||=
  "0000000000000000000000000000000000000000000000000000000000000000";
(process.env as Record<string, string | undefined>).NODE_ENV ||= "test";
