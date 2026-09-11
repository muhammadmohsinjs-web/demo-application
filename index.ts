import { format } from 'date-fns';
import { createEcommerceServer } from './src/server.ts';

export function formatCurrentDate(date: Date = new Date()): string {
  return format(date, 'PPpp');
}

const PORT = Number(process.env.PORT) || 3000;

export const server = createEcommerceServer();

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` E-Commerce Backend Server running!`);
    console.log(` Port: http://localhost:${PORT}`);
    console.log(` Started at: ${formatCurrentDate()}`);
    console.log(`=========================================`);
    console.log(`API endpoints:`);
    console.log(`  GET    /api/products`);
    console.log(`  GET    /api/products/:id`);
    console.log(`  GET    /api/cart`);
    console.log(`  POST   /api/cart/items`);
    console.log(`  DELETE /api/cart/items/:id`);
    console.log(`  POST   /api/checkout`);
    console.log(`  GET    /api/orders`);
    console.log(`  GET    /api/orders/:id`);
    console.log(`  POST   /api/orders/:id/cancel`);
    console.log(`  PUT    /api/orders/:id/status`);
    console.log(`=========================================`);
  });
}
