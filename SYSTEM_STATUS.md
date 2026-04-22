# LocateFlow — System Status & Setup Report
**Generated:** 2026-04-22

---

## ✅ System Status

### Containers
| Service | Status | Port | Health |
|---------|--------|------|--------|
| **MySQL 8.0** | ✅ Up | 3306 | Healthy |
| **Web App (Next.js)** | ✅ Up | 3000 | ✅ Responding |
| **Admin App (Next.js)** | ✅ Up | 3001 | ⚠️ Requires Auth |

### Database
- ✅ Database initialized successfully
- ✅ Prisma schema applied
- ✅ Master seed complete (777 providers, 51 state rules, 12 email templates, 15 help articles, 20 FAQs)
- ✅ Admin user seeded

### Environment Configuration
- ✅ `.env` file present with development secrets
- ✅ Database credentials configured
- ✅ JWT secrets configured
- ✅ Field encryption key configured
- ✅ CRON_SECRET configured

---

## 📋 System Setup Complete

### What's Running

#### 1. **Web App** (http://localhost:3000)
- Next.js development server
- User-facing application
- Health check: `GET /api/health` ✅

#### 2. **Admin App** (http://localhost:3001)
- Next.js development server
- Admin dashboard (requires authentication)
- **Credentials:**
  - Email: `admin@locateflow.com`
  - Password: `LocateflowAdmin!2026`
- Health check: `GET /api/health` (requires CRON_SECRET header)

#### 3. **MySQL 8.0** (localhost:3306)
- Database engine
- Credentials from `.env` file
- Fully initialized and seeded

#### 4. **Mobile** (Not containerized — requires local setup)
- React Native / Expo
- Run with: `pnpm mobile:dev`

---

## 🔑 Test Credentials

### Admin User
```
Email: admin@locateflow.com
Password: LocateflowAdmin!2026
```

### Test User (Create via Web App)
- Use the web app signup at http://localhost:3000
- Create a test account for full user flows

---

## ⚠️ Missing Configuration (Optional Features)

The following features require external API keys (development will work without them):

| Feature | Variable | Status | Impact |
|---------|----------|--------|--------|
| **Redis (Rate Limiting)** | `UPSTASH_REDIS_REST_*` | ❌ Missing | Falls back to in-memory (ok for dev) |
| **Stripe (Payments)** | `STRIPE_SECRET_KEY`, etc. | ❌ Missing | Payment features disabled |
| **Email (Resend)** | `RESEND_API_KEY` | ❌ Missing | Emails logged only, not sent |
| **Sentry (Error Tracking)** | `NEXT_PUBLIC_SENTRY_DSN` | ❌ Missing | Errors not tracked |
| **Google Maps** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ❌ Missing | Maps disabled |
| **Cloudflare R2 (Storage)** | `R2_*` variables | ❌ Missing | File uploads disabled |
| **Slack Alerts** | `SLACK_WEBHOOK_URL` | ❌ Missing | Alerts not sent |

**Impact:** All core flows (auth, users, addresses, services, moving plans) work fine without these. You can:
- Test without payments
- See logged emails in console
- Use mock maps if needed
- Upload files locally or skip

---

## 🧪 Quick Testing Checklist

### Web App (http://localhost:3000)

- [ ] **Signup:** Create a new user account
- [ ] **Login:** Sign in with email/password
- [ ] **Dashboard:** View the main dashboard
- [ ] **Addresses:** Add a test address
- [ ] **Services:** Add a test service
- [ ] **Moving Plans:** Create a moving plan
- [ ] **Settings:** Update user profile
- [ ] **i18n:** Switch language to Spanish (should see updated translations)

### Admin App (http://localhost:3001)

- [ ] **Login:** Sign in with admin@locateflow.com / LocateflowAdmin!2026
- [ ] **Dashboard:** View admin dashboard
- [ ] **Users:** View and manage users
- [ ] **Providers:** View service providers
- [ ] **Feature Flags:** Check feature flag management (if implemented)
- [ ] **Health Check:** Verify system health

### Database

- [ ] **Connection:** Verify MySQL is accepting connections
  ```bash
  docker exec locateflow-mysql mysql -u locateflow -p -e "SELECT COUNT(*) FROM User;"
  # Password: change_me_db_password
  ```

### Mobile (if available)

- [ ] **Dev Server:** Run `pnpm mobile:dev`
- [ ] **Expo Client:** Open in Expo Go or emulator
- [ ] **Auth:** Test mobile login flows
- [ ] **Sync:** Verify data sync with web backend

---

## 📁 Important Files & Directories

| Path | Purpose |
|------|---------|
| `.env` | Development environment variables (git-ignored) |
| `.env.example` | Template for environment setup |
| `docker-compose.yml` | Development Docker setup |
| `docker-compose.prod.yml` | Production Docker setup (reference) |
| `apps/web/` | Web app (Next.js) |
| `apps/admin/` | Admin app (Next.js) |
| `apps/mobile/` | Mobile app (React Native/Expo) |
| `packages/db/` | Database schema & migrations (Prisma) |
| `packages/shared/` | Shared utilities & validators |

---

## 🚀 Common Commands

```bash
# Start/Stop System
pnpm docker:up          # Bring up all containers
pnpm docker:down        # Stop containers (keeps data)
pnpm docker:reset       # Full reset (delete all data)
pnpm docker:logs        # View logs

# Development
pnpm dev                # Start all apps in dev mode (if running locally)
pnpm dev:web            # Web app only
pnpm dev:admin          # Admin app only
pnpm mobile:dev         # Mobile dev server

# Database
pnpm db:push            # Apply schema changes
pnpm db:seed            # Seed test data
pnpm db:studio          # Open Prisma Studio (visual DB editor)
pnpm db:migrate         # Run migrations

# Testing & Quality
pnpm verify:typecheck   # TypeScript check all apps
pnpm verify:tests       # Run test suite
pnpm lint               # Lint all apps

# Stripe Integration (optional)
pnpm stripe:sync-prices # Sync Stripe prices to DB
```

---

## 🔍 Health Endpoints

### Web App
```bash
curl http://localhost:3000/api/health
# Returns: { status, timestamp, version, uptimeSec, memory, checks: { database, redis, stripe, email, encryption } }
```

### Admin App (requires CRON_SECRET header)
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/health
```

### Database
```bash
docker exec locateflow-mysql mysqladmin ping -h localhost
```

---

## ⚙️ Configuration Reference

### Core Secrets (.env)
```
DATABASE_URL              MySQL connection string
USER_JWT_SECRET          JWT for user auth
ADMIN_JWT_SECRET         JWT for admin auth
FIELD_ENCRYPTION_KEY     Field-level encryption (64-char hex)
CRON_SECRET              Cron job authorization
NEXT_PUBLIC_APP_URL      Web app URL (http://localhost:3000)
```

### Optional 3rd Party
```
STRIPE_SECRET_KEY        Stripe payments
RESEND_API_KEY           Email service
SENTRY_DSN               Error tracking
GOOGLE_MAPS_API_KEY      Google Maps
UPSTASH_REDIS_*          Rate limiting
R2_* (Cloudflare)        File storage
```

---

## 📝 Next Steps

1. **Test Web App:** Open http://localhost:3000 in a browser
2. **Create Test User:** Sign up for a new account
3. **Test Admin:** Log in to http://localhost:3001 with admin credentials
4. **Run Tests:** `pnpm verify:tests`
5. **Type Check:** `pnpm verify:typecheck`
6. **Verify Provider Data:** `pnpm audit:providers`

---

## 📞 Support

**For setup issues:**
- Check `.env` file is complete
- Verify Docker is running: `docker --version`
- Check logs: `docker compose logs -f`

**For test data:**
- Web test user: Create via signup at http://localhost:3000
- Admin user: admin@locateflow.com / LocateflowAdmin!2026
- Provider data: 777+ providers pre-seeded

**For feature completeness:**
- Spanish i18n: ✅ Implemented (en.json + es.json parity, hardcoded strings fixed)
- Mobile parity: 📊 In progress
- Admin RBAC: ✅ Implemented (VIEWER, MODERATOR, ADMIN, SUPER_ADMIN)
- Rate limiting: ✅ Redis + in-memory fallback

