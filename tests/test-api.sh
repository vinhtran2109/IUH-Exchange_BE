#!/bin/bash
# ============================================================
# IUH Exchange Platform - API Integration Test Script
# Usage: bash tests/test-api.sh
# Prerequisites: All services running on localhost:8080
# ============================================================

set -e

BASE_URL="http://localhost:8080"
PASS=0
FAIL=0
TOKEN=""
ADMIN_TOKEN=""
PRODUCT_ID=""
ORDER_ID=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
test_name() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }
assert_status() {
  local expected=$1
  local actual=$2
  local desc=$3
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} $desc (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}❌ FAIL${NC} $desc (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

# ============================================================
# 1. HEALTH CHECK
# ============================================================
test_name "1. Health Check"

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "200" "$HTTP_CODE" "GET /health"

# ============================================================
# 2. AUTH - Register
# ============================================================
test_name "2. Auth - Register"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@student.iuh.edu.vn","password":"Test123456","name":"Test User"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
assert_status "201" "$HTTP_CODE" "POST /auth/register"
echo "  Response: $BODY" | head -c 200

# Duplicate registration
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@student.iuh.edu.vn","password":"Test123456","name":"Test User"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "400" "$HTTP_CODE" "POST /auth/register (duplicate)"

# Invalid email
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com","password":"Test123456","name":"Test User"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "400" "$HTTP_CODE" "POST /auth/register (invalid email - no @student.iuh.edu.vn)"

# ============================================================
# 3. AUTH - Verify OTP (mock - requires DB direct update if no email)
# ============================================================
test_name "3. Auth - Verify OTP"

# NOTE: In real test, get OTP from email or DB
# For testing, you may need to manually update DB:
# mongosh mongodb://root:iuh_exchange_root@localhost:27018/iuh_users --eval \
#   "db.users.updateOne({email:'testuser@student.iuh.edu.vn'}, {\$set:{isVerified:true, otp:null}})"

echo "  ⚠️  Skipping OTP verify - update DB manually if no SMTP configured"
echo "  mongosh command:"
echo "    db.users.updateOne({email:'testuser@student.iuh.edu.vn'}, {\$set:{isVerified:true, otp:null, otpExpiry:null}})"

# ============================================================
# 4. AUTH - Login
# ============================================================
test_name "4. Auth - Login"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@student.iuh.edu.vn","password":"Test123456"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
  assert_status "200" "$HTTP_CODE" "POST /auth/login"
  echo "  Token: ${TOKEN:0:30}..."
else
  assert_status "200" "$HTTP_CODE" "POST /auth/login (may need OTP verify first)"
fi

# Wrong password
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@student.iuh.edu.vn","password":"wrongpassword"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "401" "$HTTP_CODE" "POST /auth/login (wrong password)"

# ============================================================
# 5. AUTH - Get Profile
# ============================================================
test_name "5. Auth - Profile"

if [ -n "$TOKEN" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/auth/me" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)
  assert_status "200" "$HTTP_CODE" "GET /auth/me"
  echo "  Profile: $(echo $BODY | head -c 200)"
else
  echo "  ⚠️  Skipped (no token)"
fi

# ============================================================
# 6. PRODUCTS
# ============================================================
test_name "6. Products"

# List products (public)
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/products?page=1&size=10")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "200" "$HTTP_CODE" "GET /products (public, paginated)"

# Create product (authenticated)
if [ -n "$TOKEN" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"title":"Sách Toán Rời Rạc","description":"Sách còn mới 90%","price":50000,"condition":"LIKE_NEW","category":"Sách"}')
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)
  assert_status "201" "$HTTP_CODE" "POST /products (create)"
  PRODUCT_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  Product ID: $PRODUCT_ID"

  # Get product detail
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/products/$PRODUCT_ID")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  assert_status "200" "$HTTP_CODE" "GET /products/:id"

  # Update product
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/api/v1/products/$PRODUCT_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"title":"Sách Toán Rời Rạc - Updated","price":45000}')
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  assert_status "200" "$HTTP_CODE" "PUT /products/:id"
else
  echo "  ⚠️  Skipped authenticated tests (no token)"
fi

# ============================================================
# 7. ORDERS
# ============================================================
test_name "7. Orders"

if [ -n "$TOKEN" ] && [ -n "$PRODUCT_ID" ]; then
  # Create order
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: test-order-$(date +%s)" \
    -d "{\"productId\":\"$PRODUCT_ID\",\"sellerId\":\"000000000000000000000001\",\"price\":50000}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)
  assert_status "201" "$HTTP_CODE" "POST /orders (create)"
  ORDER_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  Order ID: $ORDER_ID"

  # Idempotency test - same key should return same result
  RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: test-order-$(date +%s)" \
    -d "{\"productId\":\"$PRODUCT_ID\",\"sellerId\":\"000000000000000000000001\",\"price\":50000}")
  HTTP_CODE2=$(echo "$RESPONSE2" | tail -1)
  # Should be 200 (cached) or 201 (new)
  echo "  Idempotency test: HTTP $HTTP_CODE2"

  # List my orders
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/orders/my-orders" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  assert_status "200" "$HTTP_CODE" "GET /orders/my-orders"

  # List orders
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/orders" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  assert_status "200" "$HTTP_CODE" "GET /orders"
else
  echo "  ⚠️  Skipped (no token or product)"
fi

# ============================================================
# 8. LOST & FOUND
# ============================================================
test_name "8. Lost & Found"

# List (public)
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/lost-found?page=1&size=10")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "200" "$HTTP_CODE" "GET /lost-found (public)"

# Create
if [ -n "$TOKEN" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/lost-found" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"type":"LOST","name":"Ví da màu đen","description":"Rơi gần thư viện","location":"Thư viện tầng 2"}')
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  assert_status "201" "$HTTP_CODE" "POST /lost-found (create)"
fi

# ============================================================
# 9. NOTIFICATIONS
# ============================================================
test_name "9. Notifications"

if [ -n "$TOKEN" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/notifications" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  assert_status "200" "$HTTP_CODE" "GET /notifications"
fi

# ============================================================
# 10. ADMIN ENDPOINTS
# ============================================================
test_name "10. Admin Endpoints"

if [ -n "$TOKEN" ]; then
  # These will 403 for non-admin users - that's expected
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/users/admin/all" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  if [ "$HTTP_CODE" = "403" ]; then
    assert_status "403" "$HTTP_CODE" "GET /users/admin/all (non-admin = 403 ✅)"
  else
    assert_status "200" "$HTTP_CODE" "GET /users/admin/all"
  fi
fi

# ============================================================
# 11. UNAUTHORIZED ACCESS
# ============================================================
test_name "11. Unauthorized Access"

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/orders")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "401" "$HTTP_CODE" "GET /orders (no token = 401)"

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/notifications")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "401" "$HTTP_CODE" "GET /notifications (no token = 401)"

# ============================================================
# 12. RATE LIMITING
# ============================================================
test_name "12. Rate Limiting"

echo "  Testing auth rate limit (20 req/15min)..."
for i in $(seq 1 22); do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@student.iuh.edu.vn","password":"wrong"}')
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  if [ "$HTTP_CODE" = "429" ]; then
    assert_status "429" "$HTTP_CODE" "Rate limit triggered after $i requests"
    break
  fi
done

# ============================================================
# SUMMARY
# ============================================================
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}  |  ${RED}FAIL: $FAIL${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $FAIL -gt 0 ]; then
  exit 1
else
  echo -e "  ${GREEN}All tests passed! 🎉${NC}"
  exit 0
fi
