create table if not exists public.users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  student_id text,
  student_verification jsonb not null default '{}'::jsonb,
  avatar_url text not null default '',
  bank_info jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  karma_point integer not null default 100,
  role text not null default 'STUDENT',
  permissions text[] not null default array['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'],
  otp text,
  otp_expiry timestamptz,
  otp_attempt_count integer not null default 0,
  refresh_token text,
  password_reset_otp text,
  password_reset_otp_expiry timestamptz,
  admin_two_factor_enabled boolean not null default true,
  admin_login_otp text,
  admin_login_otp_expiry timestamptz,
  failed_login_attempts integer not null default 0,
  lock_until timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);

create unique index if not exists users_student_id_unique
  on public.users (student_id)
  where student_id is not null and student_id <> '';

create index if not exists users_is_deleted_idx on public.users (is_deleted);
create index if not exists users_role_idx on public.users (role);
create index if not exists users_student_verification_status_idx
  on public.users ((student_verification->>'status'));

create table if not exists public.karma_histories (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  type text,
  points integer,
  reason text,
  related_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists karma_histories_user_created_idx
  on public.karma_histories (user_id, created_at desc);

create table if not exists public.orders (
  id text primary key,
  buyer_id text not null,
  seller_id text not null,
  product_id text not null,
  offer_id text,
  price numeric(14,2) not null default 0,
  listing_type text not null default 'SELL',
  trade_item_title text not null default '',
  trade_item_description text not null default '',
  status text not null default 'PENDING',
  buyer_note text not null default '',
  handover_location text not null default '',
  handover_time timestamptz,
  handover_status text not null default 'NOT_SCHEDULED',
  meeting_proposals jsonb not null default '[]'::jsonb,
  handover_code text,
  handover_code_expires_at timestamptz,
  handover_proofs jsonb not null default '[]'::jsonb,
  buyer_handover_confirmed_at timestamptz,
  seller_handover_confirmed_at timestamptz,
  no_show_reports jsonb not null default '[]'::jsonb,
  cancellation_reason text not null default '',
  cancellation_category text,
  cancelled_by text,
  cancelled_at timestamptz,
  dispute_status text not null default 'NONE',
  dispute_reason text not null default '',
  dispute_opened_by text,
  dispute_opened_at timestamptz,
  dispute_resolved_by text,
  dispute_resolved_at timestamptz,
  dispute_resolution text not null default '',
  dispute_evidence jsonb not null default '[]'::jsonb,
  dispute_timeline jsonb not null default '[]'::jsonb,
  idempotency_key text,
  payment_status text not null default 'UNPAID',
  payment_method text not null default 'NONE',
  payment_transaction_id text,
  transfer_proof_url text not null default '',
  transfer_reported_at timestamptz,
  transfer_confirmed_at timestamptz,
  transfer_confirmed_by text,
  payment_provider_status text not null default 'MOCK_PENDING',
  payment_webhook_verified boolean not null default false,
  payment_issue_status text not null default 'NONE',
  payment_issue_reason text not null default '',
  payment_issue_opened_by text,
  payment_issue_opened_at timestamptz,
  payment_issue_resolved_by text,
  payment_issue_resolved_at timestamptz,
  payment_issue_resolution text not null default '',
  payment_issue_timeline jsonb not null default '[]'::jsonb,
  reconciliation_status text not null default 'NOT_REQUIRED',
  paid_at timestamptz,
  refunded_at timestamptz,
  completed_at timestamptz,
  receipt_number text,
  status_history jsonb not null default '[]'::jsonb,
  transactions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);

create unique index if not exists orders_idempotency_key_unique
  on public.orders (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists orders_receipt_number_unique
  on public.orders (receipt_number)
  where receipt_number is not null;

create unique index if not exists orders_pending_buyer_product_unique
  on public.orders (buyer_id, product_id, status)
  where status = 'PENDING';

create index if not exists orders_buyer_idx on public.orders (buyer_id);
create index if not exists orders_seller_idx on public.orders (seller_id);
create index if not exists orders_product_idx on public.orders (product_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
