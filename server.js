// Load environment variables first
require('dotenv').config();

// Initialize Sentry BEFORE importing any other modules
const Sentry = require('@sentry/node');

// Check if valid Sentry DSN is configured
const SENTRY_ENABLED = process.env.SENTRY_DSN &&
                       !process.env.SENTRY_DSN.includes('your-dsn-here') &&
                       process.env.SENTRY_DSN.length > 0;

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    release: process.env.SENTRY_RELEASE || 'checkout-api@1.0.0',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
  console.log('✓ Sentry initialized successfully');
} else {
  console.warn('⚠️  Sentry DSN not configured - running without Sentry monitoring');
}

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// IN-MEMORY DATA STORES
// ============================================

const users = new Map();
const orders = new Map();
const products = new Map([
  ['prod_1', { id: 'prod_1', name: 'Premium Widget', price: 49.99, stock: 100 }],
  ['prod_2', { id: 'prod_2', name: 'Deluxe Gadget', price: 99.99, stock: 50 }],
  ['prod_3', { id: 'prod_3', name: 'Standard Tool', price: 29.99, stock: 200 }],
]);

let orderCounter = 1000;

// ============================================
// MIDDLEWARE
// ============================================

// Body parser
app.use(express.json());

// Sentry request handler (must be early)
if (SENTRY_ENABLED) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// User context middleware
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (userId) {
    req.userId = userId;

    if (SENTRY_ENABLED) {
      Sentry.setUser({
        id: userId,
        username: users.get(userId)?.username || userId,
        ip_address: req.ip,
      });

      Sentry.addBreadcrumb({
        category: 'auth',
        message: `User ${userId} making request to ${req.method} ${req.path}`,
        level: 'info',
      });
    }
  }

  if (SENTRY_ENABLED) {
    Sentry.setTag('endpoint', req.path);
    Sentry.setTag('method', req.method);
  }

  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function processPayment(amount, userId, forceError = false) {
  if (SENTRY_ENABLED) {
    Sentry.addBreadcrumb({
      category: 'payment',
      message: `Processing payment of $${amount} for user ${userId}`,
      level: 'info',
      data: { amount, userId },
    });
  }

  try {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

    if (forceError) {
      throw new Error('Payment provider returned error: INSUFFICIENT_FUNDS');
    }

    if (Math.random() < 0.1) {
      throw new Error('Payment provider timeout: GATEWAY_TIMEOUT');
    }

    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
    };
  } catch (error) {
    if (SENTRY_ENABLED) {
      Sentry.captureException(error, {
        tags: {
          payment_amount: amount,
          payment_user: userId,
        },
        contexts: {
          payment: {
            amount,
            userId,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }
    throw error;
  }
}

async function simulateSlowOperation(seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// ============================================
// API ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/login', (req, res) => {
  const { userId, username, email } = req.body;

  if (!userId) {
    if (SENTRY_ENABLED) {
      Sentry.captureException(new Error('Login failed: Missing userId'), {
        level: 'warning',
        tags: { error_type: 'validation' },
      });
    }
    return res.status(400).json({ error: 'userId is required' });
  }

  users.set(userId, { userId, username, email, createdAt: new Date() });

  if (SENTRY_ENABLED) {
    Sentry.setUser({ id: userId, username, email });
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `User ${userId} logged in`,
      level: 'info',
    });
  }

  res.json({
    success: true,
    message: 'User logged in. Use header "x-user-id: ' + userId + '" in subsequent requests.',
    user: { userId, username, email },
  });
});

app.get('/api/products', async (req, res) => {
  if (SENTRY_ENABLED) {
    Sentry.setTag('slow_mode', req.query.slow || 'false');
  }

  try {
    if (req.query.slow === '1') {
      await simulateSlowOperation(2 + Math.random() * 2);
    }

    const productList = Array.from(products.values());
    res.json({
      success: true,
      count: productList.length,
      products: productList,
    });
  } catch (error) {
    if (SENTRY_ENABLED) Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.userId;
  const forceError = req.query.forceError === '1';
  const slowMode = req.query.slow === '1';

  if (SENTRY_ENABLED) {
    Sentry.setTag('force_error', forceError);
    Sentry.setTag('slow_mode', slowMode);
    Sentry.setTag('product_id', productId);

    Sentry.addBreadcrumb({
      category: 'checkout',
      message: 'Checkout initiated',
      level: 'info',
      data: { productId, quantity, userId },
    });
  }

  try {
    if (!userId) {
      throw new Error('Authentication required: Missing x-user-id header');
    }

    if (!productId) {
      const error = new Error('Validation failed: Missing productId');
      error.name = 'ValidationError';
      throw error;
    }

    if (!quantity || quantity < 1) {
      const error = new Error('Validation failed: Invalid quantity');
      error.name = 'ValidationError';
      throw error;
    }

    const product = products.get(productId);
    if (!product) {
      const error = new Error(`Product not found: ${productId}`);
      error.name = 'NotFoundError';
      throw error;
    }

    if (product.stock < quantity) {
      const error = new Error(`Insufficient stock for product ${productId}`);
      error.name = 'StockError';
      if (SENTRY_ENABLED) {
        Sentry.setContext('inventory', {
          productId,
          requested: quantity,
          available: product.stock,
        });
      }
      throw error;
    }

    if (slowMode) {
      await simulateSlowOperation(2 + Math.random() * 2);
    }

    const totalAmount = product.price * quantity;
    const paymentResult = await processPayment(totalAmount, userId, forceError);

    const orderId = `order_${orderCounter++}`;
    const order = {
      id: orderId,
      userId,
      productId,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      totalAmount,
      paymentTransactionId: paymentResult.transactionId,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    orders.set(orderId, order);
    product.stock -= quantity;

    if (SENTRY_ENABLED) {
      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Checkout completed successfully',
        level: 'info',
        data: { orderId, totalAmount },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order,
    });
  } catch (error) {
    if (SENTRY_ENABLED) {
      Sentry.captureException(error, {
        tags: {
          checkout_failed: 'true',
          error_name: error.name,
        },
        contexts: {
          checkout: {
            productId,
            quantity,
            userId,
            forceError,
            slowMode,
          },
        },
      });
    }

    const statusCode = error.name === 'ValidationError' ? 400 :
                      error.name === 'NotFoundError' ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message,
      errorType: error.name,
    });
  }
});

app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    if (!userId) {
      throw new Error('Authentication required: Missing x-user-id header');
    }

    if (!id || !id.startsWith('order_')) {
      const error = new Error(`Invalid order ID format: ${id}`);
      error.name = 'ValidationError';
      throw error;
    }

    const order = orders.get(id);

    if (!order) {
      const error = new Error(`Order not found: ${id}`);
      error.name = 'NotFoundError';
      if (SENTRY_ENABLED) {
        Sentry.setContext('order_lookup', { orderId: id, userId });
      }
      throw error;
    }

    if (order.userId !== userId) {
      const error = new Error('Unauthorized: Order belongs to different user');
      error.name = 'AuthorizationError';
      if (SENTRY_ENABLED) {
        Sentry.setContext('authorization', {
          orderId: id,
          orderUserId: order.userId,
          requestUserId: userId,
        });
      }
      throw error;
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    if (SENTRY_ENABLED) {
      Sentry.captureException(error, {
        tags: {
          order_id: id,
          error_name: error.name,
        },
      });
    }

    const statusCode = error.name === 'ValidationError' ? 400 :
                      error.name === 'NotFoundError' ? 404 :
                      error.name === 'AuthorizationError' ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message,
      errorType: error.name,
    });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

if (SENTRY_ENABLED) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Checkout API Demo Server Started');
  console.log('='.repeat(50));
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🔍 Sentry DSN: ${process.env.SENTRY_DSN ? '✓ Configured' : '✗ Missing'}`);
  console.log(`🌍 Environment: ${process.env.SENTRY_ENVIRONMENT || 'development'}`);
  console.log(`📦 Release: ${process.env.SENTRY_RELEASE || 'checkout-api@1.0.0'}`);
  console.log('='.repeat(50));
  console.log('\n💡 Quick Start:');
  console.log('  1. Set x-user-id header in requests');
  console.log('  2. Try: npm run test-success');
  console.log('  3. Try: npm run test-error');
  console.log('  4. Try: npm run test-slow');
  console.log('\n📚 API Endpoints:');
  console.log('  POST /api/login - Set user session');
  console.log('  GET  /api/products - List products');
  console.log('  POST /api/checkout - Process order');
  console.log('  GET  /api/orders/:id - Get order details');
  console.log('  GET  /health - Health check');
  console.log('='.repeat(50));
});
