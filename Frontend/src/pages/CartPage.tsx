import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../stores/cartStore';
import { Trash2, ShoppingCart, ArrowRight, Plus, Minus } from 'lucide-react';

const CartPage = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice, getTotalItems } = useCartStore();

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const serviceFee = totalPrice * 0.05; // 5% service fee
  const grandTotal = totalPrice + serviceFee;

  const handleCheckout = () => {
    if (items.length > 0) {
      // Checkout handles one event at a time; pre-select the first item
      navigate(`/checkout?eventId=${items[0].eventId}`);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen text-white">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-gradient-to-br from-orange-500/20 to-[#FF6B35]/20 p-8">
                <ShoppingCart className="w-16 h-16 text-orange-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-bold">Your Cart is Empty</h1>
              <p className="text-gray-400 text-lg">Discover amazing events and add tickets to your cart</p>
            </div>
            <Link
              to="/events"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-semibold hover:from-orange-400 hover:to-pink-400 transition-all"
            >
              <span>Browse Events</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">Shopping Cart</h1>
            <p className="text-gray-400">
              {totalItems} {totalItems === 1 ? 'ticket' : 'tickets'} in your cart
            </p>
          </div>
          <button
            onClick={clearCart}
            className="px-4 py-2 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
          >
            Clear Cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={item.eventId}
                className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.02] backdrop-blur-xl overflow-hidden hover:border-orange-500/30 transition-all"
              >
                <div className="flex flex-col md:flex-row gap-4 p-4">
                  {/* Event Image */}
                  <div className="relative w-full md:w-40 h-40 flex-shrink-0 rounded-xl overflow-hidden">
                    <img
                      src={item.imageUrl || '/media/defaults/event.jpg'}
                      alt={item.eventTitle}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>

                  {/* Event Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white hover:text-orange-400 transition-colors">
                        <Link to={`/events/${item.eventId}`}>{item.eventTitle}</Link>
                      </h3>
                      <div className="flex flex-col text-sm text-gray-400 space-y-1">
                        <p className="flex items-center gap-2">
                          <span className="text-orange-400">📅</span>
                          {new Date(item.eventDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="text-orange-400">📍</span>
                          {item.venueName}
                        </p>
                      </div>
                    </div>

                    {/* Quantity and Price Controls */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">Quantity:</span>
                        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 p-1">
                          <button
                            onClick={() => updateQuantity(item.eventId, item.quantity - 1)}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.eventId, item.quantity + 1)}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">kr {item.price} each</p>
                          <p className="text-2xl font-bold text-orange-400">
                            kr {(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.eventId)}
                          className="p-2 hover:bg-red-500/10 rounded-full text-red-400 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="liquid-glass rounded-3xl border border-white/[0.10] bg-gradient-to-b from-white/[0.10] to-white/[0.02] backdrop-blur-xl p-6 space-y-6 sticky top-24 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_8px_32px_rgba(0,0,0,0.4)]">
              <h2 className="text-2xl font-bold">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Subtotal ({totalItems} tickets)</span>
                  <span className="font-semibold">kr {totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Service Fee (5%)</span>
                  <span className="font-semibold">kr {serviceFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between text-lg">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-orange-400">kr {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full px-6 py-4 rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B35] text-black font-bold uppercase tracking-wider hover:from-orange-400 hover:to-pink-400 transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="space-y-2 text-xs text-gray-400">
                <p className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Secure checkout with Stripe
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Instant ticket delivery
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 24/7 customer support
                </p>
              </div>

              <Link
                to="/events"
                className="block text-center text-sm text-orange-400 hover:text-orange-300 transition-colors"
              >
                ← Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
