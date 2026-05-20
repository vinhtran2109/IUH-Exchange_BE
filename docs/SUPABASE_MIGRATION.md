# Supabase migration for Users and Orders

This migration keeps MongoDB ObjectIds as text IDs so existing cross-service references continue to work.

## 1. Create tables

Open Supabase SQL Editor and run:

```text
supabase/schema-users-orders.sql
```

## 2. Configure environment

Set these variables in `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Use the `service_role` key from Supabase Project Settings > API. The publishable key is not enough for backend data import.

## 3. Import data

```bash
npm run migrate:supabase:users-orders
```

The script migrates:

- `iuh_users.users` to `public.users`
- `iuh_users.karmahistories` to `public.karma_histories`
- `iuh_orders.orders` to `public.orders`
