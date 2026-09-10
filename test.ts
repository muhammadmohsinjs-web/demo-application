import assert from 'assert';
import http from 'http';
import { EcommerceService } from './src/ecommerceService.ts';
import { Store } from './src/store.ts';
import { createEcommerceServer } from './src/server.ts';

async function runTests() {
  console.log('--- Starting Business Logic Tests ---');

  const testStore = new Store();
  const service = new EcommerceService(testStore);

  // Test 1: Catalog browsing
  const catalog = service.getCatalog();
  assert.strictEqual(catalog.length, 4, 'Catalog should contain 4 sample products');
  const keyboard = catalog.find((p) => p.id === 'prod_1')!;
  assert.strictEqual(keyboard.stockStatus, 'IN_STOCK');
  console.log('✓ Catalog browsing test passed');

  // Test 2: Add to cart and calculations
  const cart1 = service.addToCart('test_cart', 'prod_1', 2);
  assert.strictEqual(cart1.itemCount, 2);
  assert.strictEqual(cart1.subtotal, 179.98);
  console.log('✓ Cart addition and subtotal calculation passed');

  // Test 3: Insufficient stock prevention
  let stockErrorCaught = false;
  try {
    // Docking station only has 2 in stock
    service.addToCart('test_cart_2', 'prod_4', 10);
  } catch (err: any) {
    stockErrorCaught = true;
    assert.match(err.message, /Available stock is 2/);
  }
  assert.strictEqual(stockErrorCaught, true, 'Should reject adding items beyond stock limit');
  console.log('✓ Stock limit guard test passed');

  // Test 4: Checkout & inventory deduction
  const initialStock = testStore.getProductById('prod_1')!.stock;
  const order = service.checkout(
    {
      id: 'cust_101',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      address: '123 Tech Blvd',
    },
    undefined,
    'test_cart'
  );

  assert.strictEqual(order.status, 'PAID');
  assert.strictEqual(order.items.length, 1);
  assert.strictEqual(order.items[0].quantity, 2);
  assert.strictEqual(testStore.getProductById('prod_1')!.stock, initialStock - 2);
  console.log('✓ Checkout and atomic inventory deduction passed');

  // Test 5: Order cancellation & inventory replenishment
  const cancelledOrder = service.cancelOrder(order.id);
  assert.strictEqual(cancelledOrder.status, 'CANCELLED');
  assert.strictEqual(testStore.getProductById('prod_1')!.stock, initialStock);
  console.log('✓ Order cancellation and stock replenishment passed');

  // Test 6: Free shipping threshold policy (order < $50 vs >= $50)
  const totalsUnder50 = service.calculateCheckoutTotals([{ productId: 'prod_2', quantity: 1 }]); // mouse: $49.99
  assert.strictEqual(totalsUnder50.shippingFee, 5.0, 'Subtotal under $50 should incur $5.00 shipping');
  const totalsOver50 = service.calculateCheckoutTotals([{ productId: 'prod_1', quantity: 1 }]); // keyboard: $89.99
  assert.strictEqual(totalsOver50.shippingFee, 0, 'Subtotal $50 or more should qualify for free shipping');
  console.log('✓ Free shipping threshold business rule verified');

  console.log('\n--- Starting HTTP REST API Integration Tests ---');
  const server = createEcommerceServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  function request(path: string, options: http.RequestOptions = {}, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = http.request(`${baseUrl}${path}`, options, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      if (payload) {
        req.write(JSON.stringify(payload));
      }
      req.end();
    });
  }

  // HTTP Test 1: GET /api/products
  const productsRes = await request('/api/products');
  assert.strictEqual(productsRes.statusCode, 200);
  assert.strictEqual(productsRes.body.success, true);
  assert.strictEqual(Array.isArray(productsRes.body.products), true);
  console.log('✓ HTTP GET /api/products passed');

  // HTTP Test 2: POST /api/cart/items
  const addToCartRes = await request(
    '/api/cart/items?cartId=api_test',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { productId: 'prod_2', quantity: 1 }
  );
  assert.strictEqual(addToCartRes.statusCode, 200);
  assert.strictEqual(addToCartRes.body.cart.itemCount, 1);
  console.log('✓ HTTP POST /api/cart/items passed');

  // HTTP Test 3: POST /api/checkout
  const checkoutRes = await request(
    '/api/checkout',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      cartId: 'api_test',
      customer: {
        id: 'cust_api_1',
        name: 'Bob Smith',
        email: 'bob@example.com',
        address: '456 Main St',
      },
    }
  );
  assert.strictEqual(checkoutRes.statusCode, 201);
  assert.strictEqual(checkoutRes.body.success, true);
  const createdOrderId = checkoutRes.body.order.id;
  console.log('✓ HTTP POST /api/checkout passed');

  // HTTP Test 4: GET /api/orders/:id
  const getOrderRes = await request(`/api/orders/${createdOrderId}`);
  assert.strictEqual(getOrderRes.statusCode, 200);
  assert.strictEqual(getOrderRes.body.order.id, createdOrderId);
  console.log('✓ HTTP GET /api/orders/:id passed');

  // HTTP Test 5: POST /api/orders/:id/cancel
  const cancelOrderRes = await request(`/api/orders/${createdOrderId}/cancel`, {
    method: 'POST',
  });
  assert.strictEqual(cancelOrderRes.statusCode, 200);
  assert.strictEqual(cancelOrderRes.body.order.status, 'CANCELLED');
  console.log('✓ HTTP POST /api/orders/:id/cancel passed');

  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log('\nAll business and HTTP integration tests passed successfully! 🎉');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
