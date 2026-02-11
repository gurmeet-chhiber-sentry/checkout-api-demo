# 🚀 Quick Start Guide - Checkout API Demo

## ⚡ 3-Minute Setup

### Step 1: Configure Sentry DSN

Edit `.env` and replace the placeholder DSN:

```bash
# Open in your editor
open .env

# Or use sed
sed -i '' 's|https://your-dsn-here@.*|YOUR_ACTUAL_SENTRY_DSN|g' .env
```

Get your DSN from: **Sentry.io → Settings → Projects → [Your Project] → Client Keys (DSN)**

### Step 2: Start the Server

```bash
npm start
```

You should see:
```
🚀 Checkout API Demo Server Started
📍 Server running on: http://localhost:3000
🔍 Sentry DSN: ✓ Configured
```

### Step 3: Run Test Commands

```bash
# Terminal 1: Keep server running

# Terminal 2: Run tests
npm run test-success  # ✅ Successful checkout
npm run test-error    # ❌ Force payment error
npm run test-slow     # 🐌 Slow checkout (2-4s)
npm run load-test     # 🔥 50 concurrent requests
```

### Step 4: View in Sentry

1. Go to your Sentry dashboard
2. Navigate to **Issues** → See errors grouped by type
3. Navigate to **Performance** → See transaction traces
4. Click any issue → See breadcrumbs, user context, stack traces

---

## 📋 Essential Test Commands

### Generate Payment Failures (for Seer Demo)
```bash
for i in {1..30}; do
  curl -s -X POST http://localhost:3000/api/checkout \
    -H 'Content-Type: application/json' \
    -H "x-user-id: user_$i" \
    -d '{"productId":"prod_2","quantity":1}'
done
```

### Generate Slow Transactions
```bash
for i in {1..20}; do
  curl -s -X POST 'http://localhost:3000/api/checkout?slow=1' \
    -H 'Content-Type: application/json' \
    -H "x-user-id: user_slow_$i" \
    -d '{"productId":"prod_1","quantity":1}' &
done
wait
```

### Generate Validation Errors
```bash
for i in {1..15}; do
  curl -s -X POST http://localhost:3000/api/checkout \
    -H 'Content-Type: application/json' \
    -H "x-user-id: user_$i" \
    -d '{"quantity":1}'
done
```

---

## 🎯 Sentry Demo Checklist

- [ ] **Error Tracking**: Generate errors, check Issues tab
- [ ] **Issue Grouping**: See different error types grouped separately
- [ ] **User Context**: Filter issues by user_id
- [ ] **Breadcrumbs**: Open any issue, view event timeline
- [ ] **Performance**: Check transaction waterfall with spans
- [ ] **Slow Queries**: Identify slow checkouts in Performance tab
- [ ] **Alerts**: Set up "Checkout failure rate > 10%" alert
- [ ] **Dashboard**: Create custom dashboard with panels from README
- [ ] **Seer AI**: Run Issue Scan on payment failures

---

## 🤖 Seer Demo (30 seconds)

1. Generate 30+ payment failures (command above)
2. Go to Sentry → Issues → "Payment provider timeout"
3. Click **"Ask Seer"** button
4. Ask: "What's causing these payment failures?"
5. Seer shows: Root cause, affected code, suggested fixes

---

## 🐛 Troubleshooting

**Events not appearing?**
- Wait 10-30 seconds
- Check `.env` has correct DSN
- Verify `SENTRY_TRACES_SAMPLE_RATE=1.0`

**Server won't start?**
- Check port 3000 is available: `lsof -ti:3000`
- Kill existing process: `kill -9 $(lsof -ti:3000)`

**No payment failures?**
- They're probabilistic (10%) - run more requests
- Use `?forceError=1` for guaranteed failures

---

## 📚 Full Documentation

See **README.md** for:
- Complete API documentation
- All error scenarios
- Dashboard & alert setup
- Seer demo scenarios
- Architecture notes

---

**Ready to demo! 🎉**
