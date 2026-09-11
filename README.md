# E-Commerce Backend Application

A basic e-commerce backend with business domain logic: catalog browsing with real-time stock levels, cart management, checkout with atomic inventory deduction, and order cancellation with automatic stock replenishment.

## Run the Server

```bash
npm start
```

Default server port: `http://localhost:3000`

## Run Tests

```bash
npm test
```

## API Endpoints

- `GET /api/products` — Browse catalog and live stock status (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`)
- `GET /api/products/:id` — Get product details
- `GET /api/cart?cartId=:id` — View cart subtotal and items
- `POST /api/cart/items` — Add item to cart (`{ productId, quantity }`)
- `DELETE /api/cart/items/:productId` — Remove item from cart
- `POST /api/checkout` — Checkout order with stock deduction, volume discounts, and tax/shipping calculation
- `GET /api/orders` — List orders
- `GET /api/orders/:id` — View order invoice
- `POST /api/orders/:id/cancel` — Cancel order and replenish product stock
- `PUT /api/orders/:id/status` — Advance an order through its lifecycle (`PAID`, `SHIPPED`, or `CANCELLED`)

## Order lifecycle

Orders follow an explicit state machine: `PENDING → PAID → SHIPPED`. A `PENDING` or `PAID` order can be cancelled, which returns its inventory to stock. Shipped and cancelled orders are terminal states.

Business policies include a 10% volume discount for subtotals of $150 or more and checkout quantities limited to whole numbers from 1 to 20 per product.
