export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  unitPric: number;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  address: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED';

export interface OrderItem {
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutRequest {
  customer: Customer;
  items: {
    productId: string;
    quantity: number;
  }[];
}
