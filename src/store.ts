import type { Product, Order, Customer, CartItem } from './types.ts';

export class Store {
  public products: Map<string, Product> = new Map();
  public orders: Map<string, Order> = new Map();
  public customers: Map<string, Customer> = new Map();
  public carts: Map<string, Map<string, number>> = new Map(); // cartId -> (productId -> quantity)

  constructor() {
    this.seed();
  }

  public seed(): void {
    this.products.clear();
    this.orders.clear();
    this.customers.clear();
    this.carts.clear();

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
      this.products.set(product.id, { ...product });
    });
  }

  public getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  public getProductById(id: string): Product | undefined {
    const prod = this.products.get(id);
    return prod ? { ...prod } : undefined;
  }

  public updateProductStock(id: string, newStock: number): void {
    const prod = this.products.get(id);
    if (prod) {
      prod.stock = newStock;
    }
  }

  public saveOrder(order: Order): void {
    this.orders.set(order.id, { ...order });
  }

  public getOrderById(id: string): Order | undefined {
    const order = this.orders.get(id);
    return order ? { ...order } : undefined;
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  public getCart(cartId: string): Map<string, number> {
    if (!this.carts.has(cartId)) {
      this.carts.set(cartId, new Map());
    }
    return this.carts.get(cartId)!;
  }

  public clearCart(cartId: string): void {
    this.carts.delete(cartId);
  }
}

export const store = new Store();
