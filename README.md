# Checkout API Demo - Sentry Observability Showcase

A minimal Express.js checkout API designed to demonstrate Sentry's full observability stack: error tracking, performance monitoring, user context, and Seer AI capabilities.

## 🎯 Features

- **Error Tracking**: Multiple error scenarios (validation, not found, payment failures)
- **Performance Monitoring**: Transaction tracing with custom spans
- **User Context**: Automatic user tracking via headers
- **Breadcrumbs**: Detailed event timeline for debugging
- **Tags & Context**: Rich metadata for filtering and analysis
- **Deterministic Errors**: Force errors for reproducible demos
- **Probabilistic Failures**: Realistic payment provider failures (10% rate)
- **Performance Issues**: Simulated slow endpoints for latency monitoring

---

## 🚀 Quick Start

### 1. Installation

```bash
# Navigate to project directory
cd checkout-api-demo

# Install dependencies
npm install
```

### 2. Configure Sentry

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your Sentry DSN
# Get your DSN from: https://sentry.io/settings/[org]/projects/[project]/keys/
```

**Required environment variables:**
```bash
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/7654321
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=checkout-api@1.0.0
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0
```

### 3. Start the Server

```bash
npm start
```

Server runs on `http://localhost:3000`

---

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

### Login (Set User Context)
```bash
POST /api/login
Body: { "userId": "user_123", "username": "john_doe", "email": "john@example.com" }
```

### List Products
```bash
GET /api/products
GET /api/products?slow=1  # Simulate 2-4s latency
```

### Checkout (Place Order)
```bash
POST /api/checkout
Headers: x-user-id: user_123
Body: { "productId": "prod_1", "quantity": 2 }

Query params:
  ?forceError=1  # Trigger deterministic payment error
  ?slow=1        # Add 2-4s processing delay
```

### Get Order
```bash
GET /api/orders/:orderId
Headers: x-user-id: user_123
```

---

## 🧪 Testing Scenarios

### 1. Successful Checkout
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: user_123' \
  -d '{
    "productId": "prod_1",
    "quantity": 2
  }'
```

**Expected:** 201 Created with order details

---

### 2. Deterministic Error (Force Payment Failure)
```bash
curl -X POST 'http://localhost:3000/api/checkout?forceError=1' \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: user_456' \
  -d '{
    "productId": "prod_2",
    "quantity": 1
  }'
```

**Expected:** 500 Error - "Payment provider returned error: INSUFFICIENT_FUNDS"
**Sentry:** Captured exception with payment context

---

### 3. Slow Checkout (Performance Monitoring)
```bash
curl -X POST 'http://localhost:3000/api/checkout?slow=1' \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: user_789' \
  -d '{
    "productId": "prod_3",
    "quantity": 1
  }'
```

**Expected:** 201 Created after 2-4 seconds
**Sentry:** Transaction shows increased latency spans

---

### 4. Validation Error (Missing Product ID)
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: user_111' \
  -d '{
    "quantity": 1
  }'
```

**Expected:** 400 Bad Request - "Validation failed: Missing productId"
**Sentry:** ValidationError issue group

---

### 5. Not Found Error (Invalid Product)
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: user_222' \
  -d '{
    "productId": "prod_999",
    "quantity": 1
  }'
```

**Expected:** 404 Not Found - "Product not found: prod_999"
**Sentry:** NotFoundError issue group

---

### 6. Authorization Error (Wrong User)
```bash
# First create an order
ORDER_ID=$(curl -s -X POST http://localhost:3000/api/checkout \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: user_alice' \
  -d '{"productId":"prod_1","quantity":1}' \
  | grep -o 'order_[0-9]*')

# Try to access with different user
curl -X GET "http://localhost:3000/api/orders/${ORDER_ID}" \
  -H 'x-user-id: user_bob'
```

**Expected:** 403 Forbidden - "Unauthorized: Order belongs to different user"
**Sentry:** AuthorizationError with context

---

### 7. Missing Authentication
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "prod_1",
    "quantity": 1
  }'
```

**Expected:** 500 Error - "Authentication required: Missing x-user-id header"
**Sentry:** Auth error captured

---

### 8. Load Test (Generate Volume for Alerts)
```bash
# Run built-in load test (50 concurrent requests)
npm run load-test

# Or manual loop
for i in {1..100}; do
  curl -s -X POST http://localhost:3000/api/checkout \
    -H 'Content-Type: application/json' \
    -H "x-user-id: user_$i" \
    -d '{"productId":"prod_1","quantity":1}' &
done
wait
```

**Expected:** Mix of successes and ~10% payment failures
**Sentry:** Multiple transactions, some errors, performance data

---

### 9. Probabilistic Payment Failure Test
```bash
# Run checkout 20 times - expect ~2 payment failures
for i in {1..20}; do
  echo "Request $i:"
  curl -s -X POST http://localhost:3000/api/checkout \
    -H 'Content-Type: application/json' \
    -H "x-user-id: user_test_$i" \
    -d '{"productId":"prod_2","quantity":1}' \
    | jq -r '.success, .error // "Success"'
  echo "---"
done
```

**Expected:** ~10% failure rate with "Payment provider timeout: GATEWAY_TIMEOUT"
**Sentry:** Payment failure issues with varying frequency

---

## 📊 Sentry Dashboard Recommendations

Create a custom dashboard in Sentry with these widgets:

### Dashboard: "Checkout API Health"

#### Panel 1: Error Rate (Line Chart)
- **Metric:** `count_unique(issue)`
- **Query:** `transaction:"/api/checkout" AND !event.type:transaction`
- **Interval:** 1 hour
- **Purpose:** Track overall error frequency

#### Panel 2: Checkout Success Rate (Big Number)
- **Formula:** `(successful_checkouts / total_checkouts) * 100`
- **Query:** `transaction:"/api/checkout" AND event.type:transaction`
- **Threshold:** Alert if < 90%

#### Panel 3: Payment Failures by Type (Table)
- **Group By:** `error.type`
- **Filter:** `transaction:"/api/checkout" AND message:*payment*`
- **Columns:** Count, Affected Users, First/Last Seen

#### Panel 4: Checkout P95 Latency (Line Chart)
- **Metric:** `p95(transaction.duration)`
- **Query:** `transaction:"/api/checkout"`
- **Y-axis:** Milliseconds
- **Alert:** If P95 > 3000ms

#### Panel 5: Users Affected by Errors (Big Number)
- **Metric:** `count_unique(user)`
- **Query:** `!event.type:transaction`
- **Time Range:** Last 24 hours

#### Panel 6: Top Error Types (Bar Chart)
- **Metric:** `count()`
- **Group By:** `error.type`
- **Top:** 10
- **Purpose:** Identify most common failure modes

#### Panel 7: Slow Transactions (Table)
- **Query:** `transaction.duration:>2000 AND event.type:transaction`
- **Columns:** Transaction, Duration, User, Timestamp
- **Sort:** Duration descending

#### Panel 8: Geographic Error Distribution (World Map)
- **Metric:** `count()`
- **Group By:** `geo.country_code`
- **Filter:** `!event.type:transaction`

---

## 🚨 Alert Recommendations

### Alert 1: High Checkout Failure Rate
```yaml
Name: "Checkout Failure Rate Exceeded"
Metric: count(transaction) where transaction:"/api/checkout" AND status:"internal_error"
Threshold: > 10% of total checkouts
Window: 10 minutes
Action: Page on-call engineer
Severity: Critical
```

**Rationale:** Payment failures directly impact revenue. 10% is above normal (~10% probabilistic rate) and indicates a potential issue.

---

### Alert 2: Checkout Latency Spike
```yaml
Name: "Slow Checkout Performance"
Metric: p95(transaction.duration) where transaction:"/api/checkout"
Threshold: > 3000ms
Window: 15 minutes
Action: Notify performance team
Severity: Warning
```

**Rationale:** Slow checkouts increase cart abandonment. 3s is significantly above normal processing time.

---

### Alert 3: Payment Provider Errors
```yaml
Name: "Payment Provider Unavailable"
Metric: count(error) where message contains "Payment provider timeout"
Threshold: > 5 events
Window: 5 minutes
Action: Page on-call + notify payments team
Severity: Critical
```

**Rationale:** Clustered payment timeouts suggest provider downtime, not random failures.

---

### Alert 4: Validation Error Spike
```yaml
Name: "Increased Validation Errors"
Metric: count(error) where error.type:"ValidationError"
Threshold: > 20 events
Window: 10 minutes
Action: Notify engineering team
Severity: Warning
```

**Rationale:** Sudden validation error spikes may indicate client-side issues or API contract changes.

---

### Alert 5: Zero Successful Checkouts
```yaml
Name: "Checkout Completely Down"
Metric: count(transaction) where transaction:"/api/checkout" AND status:"ok"
Threshold: = 0
Window: 5 minutes
Action: Page on-call immediately
Severity: Critical
```

**Rationale:** No successful checkouts means the service is completely broken.

---

## 🤖 Seer AI Demo Guide

Sentry's **Seer** (AI-powered root cause analysis) works best with rich error context. This demo app is Seer-optimized.

### Demo Scenario 1: Payment Failure Root Cause

**Setup:**
1. Generate payment failures:
   ```bash
   for i in {1..30}; do
     curl -s -X POST http://localhost:3000/api/checkout \
       -H 'Content-Type: application/json' \
       -H "x-user-id: user_$i" \
       -d '{"productId":"prod_2","quantity":1}' > /dev/null
   done
   ```

2. Navigate to Sentry Issues → Find "Payment provider timeout: GATEWAY_TIMEOUT"

3. Click **"Ask Seer"** or use the **Seer Issue Scan** feature

**Expected Seer Analysis:**
- **Root Cause:** "Payment provider experiencing timeouts (10% failure rate)"
- **Evidence:** Stack traces, breadcrumbs showing payment span failures
- **Related Issues:** May identify correlation with slow checkouts
- **Suggested Fix:** Add retry logic, circuit breaker, or fallback payment method
- **Code Context:** Points to `processPayment()` function in server.js

---

### Demo Scenario 2: Validation Error Pattern Analysis

**Setup:**
1. Generate validation errors:
   ```bash
   for i in {1..15}; do
     curl -s -X POST http://localhost:3000/api/checkout \
       -H 'Content-Type: application/json' \
       -H "x-user-id: user_$i" \
       -d '{"quantity":1}' > /dev/null
   done
   ```

2. Find "ValidationError: Missing productId" issue

3. Ask Seer: "Why are users hitting this validation error?"

**Expected Seer Analysis:**
- **Pattern:** Missing required field in checkout requests
- **User Impact:** X affected users
- **Recommendation:** Improve client-side validation or API documentation
- **Related Code:** Points to validation logic in checkout endpoint

---

### Demo Scenario 3: Performance Regression Detection

**Setup:**
1. Generate slow checkouts:
   ```bash
   for i in {1..25}; do
     curl -s -X POST 'http://localhost:3000/api/checkout?slow=1' \
       -H 'Content-Type: application/json' \
       -H "x-user-id: user_slow_$i" \
       -d '{"productId":"prod_3","quantity":1}' > /dev/null &
   done
   wait
   ```

2. Navigate to Performance → Transactions → "/api/checkout"

3. Use Seer to analyze slow transactions

**Expected Seer Analysis:**
- **Issue:** Transactions consistently taking 2-4 seconds
- **Bottleneck:** Identifies the "slow.operation" span
- **Impact:** Affects P95/P99 latency metrics
- **Suggestion:** Investigate the slow operation, consider async processing

---

### Best Practices for Seer Demos

1. **Rich Context is Key:**
   - This demo includes breadcrumbs, tags, user context, and custom spans
   - Seer uses all this data to provide accurate analysis

2. **Multiple Event Samples:**
   - Generate 10-20+ events of the same error for best Seer results
   - Seer learns patterns from multiple occurrences

3. **Use Specific Questions:**
   - Instead of: "What's wrong?"
   - Ask: "Why is the payment provider timing out?"
   - Ask: "What's causing the latency spike in checkout?"

4. **Leverage Issue Grouping:**
   - Different error types (ValidationError, PaymentError) create distinct issues
   - Seer analyzes each issue group separately for focused insights

5. **Combine with Trace Explorer:**
   - Use distributed tracing to show Seer the full request flow
   - Payment processing span failures are clearly visible

---

## 🏗️ Architecture Notes

### Error Scenarios

1. **Deterministic Errors** (`?forceError=1`):
   - Always throws payment insufficient funds error
   - Use for reproducible demos and E2E tests

2. **Probabilistic Errors** (10% chance):
   - Realistic payment provider timeout simulation
   - Demonstrates error rate monitoring and alerting

3. **Validation Errors**:
   - Missing fields, invalid formats
   - Creates distinct Sentry issue groups

4. **Authorization Errors**:
   - Wrong user accessing orders
   - Shows security-related error tracking

### Performance Monitoring

1. **Automatic Tracing**:
   - Sentry auto-instruments Express routes
   - Each API call creates a transaction

2. **Custom Spans**:
   - `payment.provider` - Payment processing time
   - `slow.operation` - Simulated slow operations
   - Visible in Sentry Performance Waterfall

3. **Slow Path** (`?slow=1`):
   - Adds 2-4 seconds of latency
   - Demonstrates P95/P99 monitoring

### User Context

- `x-user-id` header propagates through all requests
- Sentry automatically tracks:
  - User ID
  - Username (if set via /login)
  - IP address
- Filter errors/transactions by user in Sentry

---

## 🐛 Troubleshooting

### Sentry DSN Not Set
```
Error: Missing SENTRY_DSN environment variable
```
**Fix:** Copy `.env.example` to `.env` and add your Sentry DSN

### Events Not Appearing in Sentry
1. Check DSN is correct
2. Verify `SENTRY_TRACES_SAMPLE_RATE=1.0` (100% sampling)
3. Wait 10-30 seconds for events to appear
4. Check Sentry project settings → Inbound Filters

### Payment Failures Not Occurring
- Probabilistic failures are 10% - run more requests
- Use `?forceError=1` for guaranteed failures

### Performance Traces Missing
- Ensure `SENTRY_TRACES_SAMPLE_RATE=1.0` in `.env`
- Check Sentry Performance → Transactions

---

## 📚 Additional Resources

- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [Performance Monitoring Guide](https://docs.sentry.io/product/performance/)
- [Alert Configuration](https://docs.sentry.io/product/alerts/)
- [Seer AI Documentation](https://docs.sentry.io/product/issues/seer/)
- [Custom Instrumentation](https://docs.sentry.io/platforms/node/performance/instrumentation/custom-instrumentation/)

---

## 📝 License

MIT

---

## 🙏 Acknowledgments

Built for demonstrating Sentry's observability capabilities:
- Error tracking and grouping
- Performance monitoring and tracing
- User context and breadcrumbs
- AI-powered root cause analysis (Seer)
- Alerting and dashboards

**Perfect for:** Sales demos, proof-of-concepts, hackathons, and learning Sentry's features.
