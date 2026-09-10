import type { Product, Order, Customer } from './types.ts';

export interface StoreState {
  products: Map<string, Product>;
  orders: Map<string, Order>;
  customers: Map<string, Customer>;
  carts: Map<string, Map<string, number>>; // cartId -> (productId -> quantity)
}

export function seedStore(state: StoreState): void {
  state.products.clear();
  state.orders.clear();
  state.customers.clear();
  state.carts.clear();

  const sampleProducts: Product[] = [
    {
      id: 'prod_1',
      title: 'Mechanical Keyboard',
      description: 'RGB mechanical keyboard with tactile switches',
      price: 89.99,
      stock: 15,
    },
    {
      id: 'prod_2',
      title: 'Wireless Ergonomic Mouse',
      description: 'Precision wireless mouse with adjustable DPI',
      price: 49.99,
      stock: 25,
    },
    {
      id: 'prod_3',
      title: 'Noise-Cancelling Headphones',
      description: 'Over-ear headphones with active noise cancellation',
      price: 199.99,
      stock: 8,
    },
    {
      id: 'prod_4',
      title: 'USB-C Docking Station',
      description: '10-in-1 multi-port adapter with dual HDMI',
      price: 65.5,
      stock: 2,
    },
  ];

  sampleProducts.forEach((product) => {
    state.products.set(product.id, { ...product });
  });
}

export function createStore(): StoreState {
  const state: StoreState = {
    products: new Map(),
    orders: new Map(),
    customers: new Map(),
    carts: new Map(),
  };
  seedStore(state);
  return state;
}

export const defaultStore: StoreState = createStore();

export function getAllProducts(state: StoreState = defaultStore): Product[] {
  return Array.from(state.products.values());
}

export function getProductById(id: string, state: StoreState = defaultStore): Product | undefined {
  const prod = state.products.get(id);
  return prod ? { ...prod } : undefined;
}

export function updateProductStock(id: string, newStock: number, state: StoreState = defaultStore): void {
  const prod = state.products.get(id);
  if (prod) {
    prod.stock = newStock;
  }
}

export function saveOrder(order: Order, state: StoreState = defaultStore): void {
  state.orders.set(order.id, { ...order });
}

export function getOrderById(id: string, state: StoreState = defaultStore): Order | undefined {
  const order = state.orders.get(id);
  return order ? { ...order } : undefined;
}

export function getAllOrders(state: StoreState = defaultStore): Order[] {
  return Array.from(state.orders.values());
}

export function getCart(cartId: string, state: StoreState = defaultStore): Map<string, number> {
  if (!state.carts.has(cartId)) {
    state.carts.set(cartId, new Map());
  }
  return state.carts.get(cartId)!;
}

export function clearCart(cartId: string, state: StoreState = defaultStore): void {
  state.carts.delete(cartId);
}

export function resetStore(state: StoreState = defaultStore): void {
  seedStore(state);
}
