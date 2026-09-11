import { defaultStore, getAllProducts, getProductById, updateProductStock, saveOrder, getOrderById, getCart as getStoreCart, clearCart as clearStoreCart } from './store.ts';
import type { StoreState } from './store.ts';
import type { Product, Cart, CartItem, Order, OrderItem, Customer, OrderStatus } from './types.ts';

export interface ProductView extends Product {
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export function getCatalog(state: StoreState = defaultStore): ProductView[] {
  const products = getAllProducts(state);
  return products.map(prod => {
    let stockStatus: ProductView['stockStatus'] = 'IN_STOCK';
    if (prod.stock === 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (prod.stock <= 5) {
      stockStatus = 'LOW_STOCK';
    }
    return {
      ...prod,
      stockStatus,
    };
  });
}

export function getProduct(productId: string, state: StoreState = defaultStore): ProductView {
  const product = getProductById(productId, state);
  if (!product) {
    throw new Error(`Product with ID '${productId}' not found`);
  }

  let stockStatus: ProductView['stockStatus'] = 'IN_STOCK';
  if (product.stock === 0) {
    stockStatus = 'OUT_OF_STOCK';
  } else if (product.stock <= 5) {
    stockStatus = 'LOW_STOCK';
  }

  return { ...product, stockStatus };
}

export function getCart(cartId: string = 'default', state: StoreState = defaultStore): Cart {
  const rawCart = getStoreCart(cartId, state);
  const items: CartItem[] = [];
  let subtotal = 0;
  let itemCount = 0;

  for (const [productId, quantity] of rawCart.entries()) {
    const product = getProductById(productId, state);
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

export function addToCart(cartId: string = 'default', productId: string, quantity: number, state: StoreState = defaultStore): Cart {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 20) {
    throw new Error('Quantity must be a whole number between 1 and 20');
  }

  const product = getProductById(productId, state);
  if (!product) {
    throw new Error(`Product with ID '${productId}' not found`);
  }

  const cart = getStoreCart(cartId, state);
  const currentQty = cart.get(productId) || 0;
  const requestedTotal = currentQty + quantity;

  if (requestedTotal > product.stock) {
    throw new Error(`Cannot add ${quantity} item(s). Available stock is ${product.stock}, already in cart: ${currentQty}`);
  }

  cart.set(productId, requestedTotal);
  return getCart(cartId, state);
}

export function removeFromCart(cartId: string = 'default', productId: string, state: StoreState = defaultStore): Cart {
  const cart = getStoreCart(cartId, state);
  cart.delete(productId);
  return getCart(cartId, state);
}

export function calculateCheckoutTotals(
  items: { productId: string; quantity: number }[],
  state: StoreState = defaultStore,
): {
  subtotal: number;
  tax: number;
  shippingFee: number;
  total: number;
} {
  const TAX_RATE = 0.03; // 3% sales tax
  let subtotal = 0;

  for (const item of items) {
    const product = getProductById(item.productId, state);
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

  const total = Number((subtotal + tax + shippingFee).toFixed(2));

  return {
    subtotal,
    tax,
    shippingFee,
    total,
  };
}

export function checkout(customer: Customer, itemsToCheckout?: { productId: string; quantity: number }[], cartId: string = 'default', state: StoreState = defaultStore): Order {
  if (!customer.name || !customer.email) {
    throw new Error('Customer name and email are required for checkout');
  }

  let items: { productId: string; quantity: number }[] = [];

  if (itemsToCheckout && itemsToCheckout.length > 0) {
    items = itemsToCheckout;
  } else {
    const cart = getCart(cartId, state);
    if (cart.items.length === 0) {
      throw new Error('Cannot checkout an empty cart');
    }
    items = cart.items.map(i => ({ productId: i.productId, quantity: i.quantity }));
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
    const product = getProductById(item.productId, state);
    if (!product) {
      throw new Error(`Product '${item.productId}' does not exist`);
    }
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for '${product.title}'. Requested: ${item.quantity}, Available: ${product.stock}`);
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
    const product = getProductById(item.productId, state)!;
    updateProductStock(product.id, product.stock - item.quantity, state);
  }

  // Phase 3: Calculate pricing totals
  const { subtotal, tax, shippingFee, total } = calculateCheckoutTotals(items, state);

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

  saveOrder(order, state);

  // Clear the cart if checkout came from cart
  clearStoreCart(cartId, state);

  return order;
}

export function getOrder(orderId: string, state: StoreState = defaultStore): Order {
  const order = getOrderById(orderId, state);
  if (!order) {
    throw new Error(`Order '${orderId}' not found`);
  }
  return order;
}

export function updateOrderStatus(orderId: string, status: OrderStatus, state: StoreState = defaultStore): Order {
  const order = getOrderById(orderId, state);
  if (!order) {
    throw new Error(`Order '${orderId}' not found`);
  }

  if (order.status === 'CANCELLED') {
    throw new Error(`Cannot update a cancelled order`);
  }

  if (order.status === status) {
    return order;
  }

  const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['PAID', 'CANCELLED'],
    PAID: ['SHIPPED', 'CANCELLED'],
    SHIPPED: [],
    CANCELLED: [],
  };
  if (!allowedTransitions[order.status].includes(status)) {
    throw new Error(`Cannot move order '${orderId}' from ${order.status} to ${status}`);
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  saveOrder(order, state);
  return order;
}

export function cancelOrder(orderId: string, state: StoreState = defaultStore): Order {
  const order = getOrderById(orderId, state);
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
    const product = getProductById(item.productId, state);
    if (product) {
      updateProductStock(product.id, product.stock + item.quantity, state);
    }
  }

  order.status = 'CANCELLED';
  order.updatedAt = new Date().toISOString();
  saveOrder(order, state);
  return order;
}
