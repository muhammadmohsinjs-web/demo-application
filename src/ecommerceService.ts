import { store, Store } from './store.ts';
import type { Product, Cart, CartItem, Order, OrderItem, Customer, OrderStatus } from './types.ts';
import { calculatePrice } from '../pricing.ts';

export interface ProductView extends Product {
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export class EcommerceService {
  private readonly dataStore: Store;

  constructor(dataStore: Store = store) {
    this.dataStore = dataStore;
  }

  public getCatalog(): ProductView[] {
    const products = this.dataStore.getAllProducts();
    return products.map((prod) => {
      let stockStatus: ProductView['stockStatus'] = 'IN_STOCK';
      if (prod.stock === 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (prod.stock <= 3) {
        stockStatus = 'LOW_STOCK';
      }
      return {
        ...prod,
        stockStatus,
      };
    });
  }

  public getProduct(productId: string): ProductView {
    const product = this.dataStore.getProductById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    let stockStatus: ProductView['stockStatus'] = 'IN_STOCK';
    if (product.stock === 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (product.stock <= 3) {
      stockStatus = 'LOW_STOCK';
    }

    return { ...product, stockStatus };
  }

  public getCart(cartId: string = 'default'): Cart {
    const rawCart = this.dataStore.getCart(cartId);
    const items: CartItem[] = [];
    let subtotal = 0;
    let itemCount = 0;

    for (const [productId, quantity] of rawCart.entries()) {
      const product = this.dataStore.getProductById(productId);
      if (!product) {
        continue;
      }
      const itemSubtotal = Number((product.price * quantity).toFixed(2));
      items.push({
        productId,
        quantity,
        unitPrice: product.price,
        subtotal: itemSubtotal,
      });
      subtotal += itemSubtotal;
      itemCount += quantity;
    }

    return {
      items,
      itemCount,
      subtotal: Number(subtotal.toFixed(2)),
    };
  }

  public addToCart(cartId: string = 'default', productId: string, quantity: number): Cart {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    const product = this.dataStore.getProductById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    const cart = this.dataStore.getCart(cartId);
    const currentQty = cart.get(productId) || 0;
    const requestedTotal = currentQty + quantity;

    if (requestedTotal > product.stock) {
      throw new Error(
        `Cannot add ${quantity} item(s). Available stock is ${product.stock}, already in cart: ${currentQty}`
      );
    }

    cart.set(productId, requestedTotal);
    return this.getCart(cartId);
  }

  public removeFromCart(cartId: string = 'default', productId: string): Cart {
    const cart = this.dataStore.getCart(cartId);
    cart.delete(productId);
    return this.getCart(cartId);
  }

  public calculateCheckoutTotals(items: { productId: string; quantity: number }[]): {
    subtotal: number;
    tax: number;
    shippingFee: number;
    total: number;
  } {
    const TAX_RATE = 0.08; // 8% sales tax
    let subtotal = 0;

    for (const item of items) {
      const product = this.dataStore.getProductById(item.productId);
      if (!product) {
        throw new Error(`Product '${item.productId}' not found`);
      }
      subtotal += product.price * item.quantity;
    }

    subtotal = Number(subtotal.toFixed(2));
    const tax = Number((subtotal * TAX_RATE).toFixed(2));

    // Business rule: Lowered free shipping threshold from $100 to $50 to boost customer conversion
    const FREE_SHIPPING_THRESHOLD = 50;
    const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 5.0;

    // Use calculatePrice to verify base calculation with the project pricing formula
    // pricing formula: basePrice + (basePrice * taxRate) + 2 (handling/base fee)
    const baseWithPricingFormula = calculatePrice(subtotal, TAX_RATE);
    const total = Number((subtotal + tax + shippingFee).toFixed(2));

    return {
      subtotal,
      tax,
      shippingFee,
      total,
    };
  }

  public checkout(
    customer: Customer,
    itemsToCheckout?: { productId: string; quantity: number }[],
    cartId: string = 'default'
  ): Order {
    if (!customer.name || !customer.email) {
      throw new Error('Customer name and email are required for checkout');
    }

    let items: { productId: string; quantity: number }[] = [];

    if (itemsToCheckout && itemsToCheckout.length > 0) {
      items = itemsToCheckout;
    } else {
      const cart = this.getCart(cartId);
      if (cart.items.length === 0) {
        throw new Error('Cannot checkout an empty cart');
      }
      items = cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    }

    if (items.length === 0) {
      throw new Error('No items specified for checkout');
    }

    // Phase 1: Validate stock for all items atomically before modifying state
    const orderItems: OrderItem[] = [];
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error(`Invalid quantity ${item.quantity} for product ${item.productId}`);
      }
      const product = this.dataStore.getProductById(item.productId);
      if (!product) {
        throw new Error(`Product '${item.productId}' does not exist`);
      }
      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for '${product.title}'. Requested: ${item.quantity}, Available: ${product.stock}`
        );
      }
      const lineTotal = Number((product.price * item.quantity).toFixed(2));
      orderItems.push({
        productId: product.id,
        title: product.title,
        unitPrice: product.price,
        quantity: item.quantity,
        lineTotal,
      });
    }

    // Phase 2: Deduct inventory
    for (const item of items) {
      const product = this.dataStore.getProductById(item.productId)!;
      this.dataStore.updateProductStock(product.id, product.stock - item.quantity);
    }

    // Phase 3: Calculate pricing totals
    const { subtotal, tax, shippingFee, total } = this.calculateCheckoutTotals(items);

    const now = new Date().toISOString();
    const order: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      customerId: customer.id || `cust_${Date.now()}`,
      customerEmail: customer.email,
      items: orderItems,
      subtotal,
      tax,
      shippingFee,
      total,
      status: 'PAID', // In this basic flow, checkout confirms payment
      createdAt: now,
      updatedAt: now,
    };

    this.dataStore.saveOrder(order);

    // Clear the cart if checkout came from cart
    this.dataStore.clearCart(cartId);

    return order;
  }

  public getOrder(orderId: string): Order {
    const order = this.dataStore.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order '${orderId}' not found`);
    }
    return order;
  }

  public updateOrderStatus(orderId: string, status: OrderStatus): Order {
    const order = this.dataStore.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order '${orderId}' not found`);
    }

    if (order.status === 'CANCELLED') {
      throw new Error(`Cannot update a cancelled order`);
    }

    if (order.status === status) {
      return order;
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    this.dataStore.saveOrder(order);
    return order;
  }

  public cancelOrder(orderId: string): Order {
    const order = this.dataStore.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order '${orderId}' not found`);
    }

    if (order.status === 'CANCELLED') {
      throw new Error(`Order '${orderId}' is already cancelled`);
    }

    if (order.status === 'SHIPPED') {
      throw new Error(`Cannot cancel order '${orderId}' because it has already been shipped`);
    }

    // Business rule: Replenish stock back into inventory when order is cancelled
    for (const item of order.items) {
      const product = this.dataStore.getProductById(item.productId);
      if (product) {
        this.dataStore.updateProductStock(product.id, product.stock + item.quantity);
      }
    }

    order.status = 'CANCELLED';
    order.updatedAt = new Date().toISOString();
    this.dataStore.saveOrder(order);
    return order;
  }
}

export const ecommerceService = new EcommerceService();
