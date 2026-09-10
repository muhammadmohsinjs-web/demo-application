import http, { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { format } from 'date-fns';
import {
  getCatalog,
  getProduct,
  getCart,
  addToCart,
  removeFromCart,
  checkout,
  getOrder,
  cancelOrder,
} from './ecommerceService.ts';
import { getAllOrders, defaultStore } from './store.ts';
import type { StoreState } from './store.ts';

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

export function createEcommerceServer(storeState: StoreState = defaultStore) {
  return http.createServer(async (req, res) => {
    // Enable CORS for frontend integration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;
      const method = req.method;

      // 1. Health check & Root discovery
      if (pathname === '/' || pathname === '/api/health') {
        sendJson(res, 200, {
          service: 'Basic E-Commerce Backend API',
          serverTime: format(new Date(), 'PPpp'),
          endpoints: [
            { method: 'GET', path: '/api/products', desc: 'Browse catalog with real-time stock levels' },
            { method: 'GET', path: '/api/products/:id', desc: 'Get specific product details' },
            { method: 'GET', path: '/api/cart?cartId=default', desc: 'Inspect current cart' },
            { method: 'POST', path: '/api/cart/items', desc: 'Add product to cart { productId, quantity }' },
            { method: 'DELETE', path: '/api/cart/items/:productId', desc: 'Remove product from cart' },
            { method: 'POST', path: '/api/checkout', desc: 'Checkout customer order' },
            { method: 'GET', path: '/api/orders', desc: 'List all processed orders' },
            { method: 'GET', path: '/api/orders/:id', desc: 'Inspect specific order receipt' },
            { method: 'POST', path: '/api/orders/:id/cancel', desc: 'Cancel order and replenish stock' },
          ],
        });
        return;
      }

      // 2. Product Catalog
      if (pathname === '/api/products' && method === 'GET') {
        const catalog = getCatalog(storeState);
        sendJson(res, 200, { success: true, count: catalog.length, products: catalog });
        return;
      }

      if (pathname.startsWith('/api/products/') && method === 'GET') {
        const productId = pathname.replace('/api/products/', '');
        const product = getProduct(productId, storeState);
        sendJson(res, 200, { success: true, product });
        return;
      }

      // 3. Shopping Cart
      const cartId = parsedUrl.searchParams.get('cartId') || 'default';

      if (pathname === '/api/cart' && method === 'GET') {
        const cart = getCart(cartId, storeState);
        sendJson(res, 200, { success: true, cartId, cart });
        return;
      }

      if (pathname === '/api/cart/items' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { productId, quantity = 1 } = body;
        if (!productId) {
          sendJson(res, 400, { success: false, error: 'productId is required' });
          return;
        }
        const cart = addToCart(cartId, productId, Number(quantity), storeState);
        sendJson(res, 200, { success: true, message: 'Item added to cart', cart });
        return;
      }

      if (pathname.startsWith('/api/cart/items/') && method === 'DELETE') {
        const productId = pathname.replace('/api/cart/items/', '');
        const cart = removeFromCart(cartId, productId, storeState);
        sendJson(res, 200, { success: true, message: 'Item removed from cart', cart });
        return;
      }

      // 4. Checkout
      if (pathname === '/api/checkout' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { customer, items, cartId: checkoutCartId } = body;
        if (!customer) {
          sendJson(res, 400, { success: false, error: 'Customer details are required' });
          return;
        }

        const order = checkout(customer, items, checkoutCartId || cartId, storeState);
        sendJson(res, 201, {
          success: true,
          message: 'Order placed successfully',
          order,
          formattedOrderDate: format(new Date(order.createdAt), 'PPpp'),
        });
        return;
      }

      // 5. Orders
      if (pathname === '/api/orders' && method === 'GET') {
        const orders = getAllOrders(storeState);
        sendJson(res, 200, { success: true, count: orders.length, orders });
        return;
      }

      if (pathname.startsWith('/api/orders/') && pathname.endsWith('/cancel') && method === 'POST') {
        const orderId = pathname.replace('/api/orders/', '').replace('/cancel', '');
        const order = cancelOrder(orderId, storeState);
        sendJson(res, 200, {
          success: true,
          message: `Order ${orderId} cancelled and stock replenished`,
          order,
        });
        return;
      }

      if (pathname.startsWith('/api/orders/') && method === 'GET') {
        const orderId = pathname.replace('/api/orders/', '');
        const order = getOrder(orderId, storeState);
        sendJson(res, 200, {
          success: true,
          order,
          formattedOrderDate: format(new Date(order.createdAt), 'PPpp'),
        });
        return;
      }

      // 404 for unknown endpoints
      sendJson(res, 404, { success: false, error: `Endpoint not found: ${method} ${pathname}` });
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message || 'An unexpected error occurred' });
    }
  });
}
