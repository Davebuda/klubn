import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  price: number;
  imageUrl?: string;
  quantity: number;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (eventId: string) => void;
  updateQuantity: (eventId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          const existingItem = state.items.find((i) => i.eventId === item.eventId);
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.eventId === item.eventId ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: 1 }],
          };
        });
      },

      removeItem: (eventId) => {
        set((state) => ({
          items: state.items.filter((item) => item.eventId !== eventId),
        }));
      },

      updateQuantity: (eventId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(eventId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.eventId === eventId ? { ...item, quantity } : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'klubn-cart-storage',
    }
  )
);
