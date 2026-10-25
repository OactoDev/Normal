"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Heart,
  ShoppingBag,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Trash2,
  Plus,
  Minus
} from "lucide-react";

type Banner = {
  bannerId: string;
  message: string;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  publishedAt: string;
};

type Publication = {
  occurredAt: string;
  planId: string;
  actionId: string;
  bannerId: string;
};

interface ShoeColorway {
  name: string;
  img: string;
}

interface ShoeProduct {
  id: string;
  title: string;
  subtitle: string;
  category: "running" | "lifestyle" | "jordan" | "football" | "training";
  price: number;
  badge?: "Just In" | "Bestseller" | "Sustainable Materials" | "Member Product";
  colorways: ShoeColorway[];
  isAnomalyRelated?: boolean;
  stockLevel?: number;
}

interface CartItem {
  cartId: string;
  productId: string;
  title: string;
  subtitle: string;
  img: string;
  price: number;
  size: string;
  quantity: number;
}

const NIKE_PRODUCTS: ShoeProduct[] = [
  {
    id: "nike_air_max_95",
    title: "Nike Air Max 95 Big Bubble Premium",
    subtitle: "Men's Shoes",
    category: "lifestyle",
    price: 174.99,
    badge: "Just In",
    colorways: [
      {
        name: "Black / Neon / Grey",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/13119edc-09b3-4e56-bdfb-54d8c096f55a/NIKE+AIR+MAX+95+BB+PRM.png"
      },
      {
        name: "Triple Black",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/825edf59-e3c6-4014-86c2-b0b086d67f11/AIR+FORCE+1+LUXE.png"
      }
    ],
    isAnomalyRelated: true,
    stockLevel: 3
  },
  {
    id: "nike_tiempo_maestro",
    title: "Nike Tiempo Maestro Elite",
    subtitle: "Firm-Ground Low-Top Football Boot",
    category: "football",
    price: 229.99,
    badge: "Just In",
    colorways: [
      {
        name: "White / Teal",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/c9113529-6aa5-494a-a267-6ea8469fc939/TIEMPO+MAESTRO+ELITE+FG.png"
      },
      {
        name: "White / Crimson",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/007d54db-bd1c-41c1-84aa-79994b54af82/VAPOR+17+ELITE+FG.png"
      },
      {
        name: "Black / Volt",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/80e400bc-f455-4325-a3f5-36ee4258e3fd/ZM+SUPERFLY+11+ELITE+FG.png"
      }
    ]
  },
  {
    id: "nike_phantom_6",
    title: "Nike Phantom 6 Low Elite",
    subtitle: "Firm-Ground Football Boot",
    category: "football",
    price: 244.99,
    badge: "Just In",
    colorways: [
      {
        name: "White / Glacier Blue",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/b253c634-7d65-42cc-85f1-a803c48f18f1/PHANTOM+6+LOW+ELITE+FG.png"
      },
      {
        name: "Pink Blast",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/c9113529-6aa5-494a-a267-6ea8469fc939/TIEMPO+MAESTRO+ELITE+FG.png"
      },
      {
        name: "Black / Hyper Crimson",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/80e400bc-f455-4325-a3f5-36ee4258e3fd/ZM+SUPERFLY+11+ELITE+FG.png"
      },
      {
        name: "Black / Green Glow",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/007d54db-bd1c-41c1-84aa-79994b54af82/VAPOR+17+ELITE+FG.png"
      }
    ]
  },
  {
    id: "nike_lahar_low",
    title: "Nike Lahar Low",
    subtitle: "Women's Shoe",
    category: "lifestyle",
    price: 129.99,
    badge: "Bestseller",
    colorways: [
      {
        name: "Wheat / Light British Tan",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/68e30f32-6d2f-4ec0-8c00-ff2fe72f6f7f/W+NIKE+LAHAR+LOW.png"
      },
      {
        name: "Black / Dark Smoke Grey",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/825edf59-e3c6-4014-86c2-b0b086d67f11/AIR+FORCE+1+LUXE.png"
      }
    ]
  },
  {
    id: "nike_air_force_1_luxe",
    title: "Nike Air Force 1 Luxe",
    subtitle: "Men's Shoes",
    category: "lifestyle",
    price: 119.99,
    badge: "Member Product",
    colorways: [
      {
        name: "Black / Gum Light Brown",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/825edf59-e3c6-4014-86c2-b0b086d67f11/AIR+FORCE+1+LUXE.png"
      },
      {
        name: "Pearl White / Pale Ivory",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/d94790d6-08e2-41a4-b1e6-e26e73d0e4c0/NIKE+COURT+VISION+LO+P+NB.png"
      }
    ]
  },
  {
    id: "nike_mercurial_vapor",
    title: "Nike Mercurial Vapor 17 Elite",
    subtitle: "Firm-Ground Low-Top Football Boot",
    category: "football",
    price: 239.99,
    badge: "Just In",
    colorways: [
      {
        name: "White / Blue Hero",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/007d54db-bd1c-41c1-84aa-79994b54af82/VAPOR+17+ELITE+FG.png"
      },
      {
        name: "Metallic Gold Coin",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/80e400bc-f455-4325-a3f5-36ee4258e3fd/ZM+SUPERFLY+11+ELITE+FG.png"
      }
    ]
  },
  {
    id: "nike_court_vision_low",
    title: "Nike Court Vision Low",
    subtitle: "Men's Shoes",
    category: "lifestyle",
    price: 69.99,
    badge: "Sustainable Materials",
    colorways: [
      {
        name: "White / White",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/d94790d6-08e2-41a4-b1e6-e26e73d0e4c0/NIKE+COURT+VISION+LO+P+NB.png"
      },
      {
        name: "Black / Black",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/825edf59-e3c6-4014-86c2-b0b086d67f11/AIR+FORCE+1+LUXE.png"
      }
    ]
  },
  {
    id: "nike_air_max_270",
    title: "Nike Air Max 270",
    subtitle: "Men's Shoes",
    category: "running",
    price: 144.99,
    badge: "Bestseller",
    colorways: [
      {
        name: "Black / White",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/c2a79e74-63e0-4c41-b91c-76f9d02b5ce8/AIR+MAX+270.png"
      },
      {
        name: "Triple Red",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/13119edc-09b3-4e56-bdfb-54d8c096f55a/NIKE+AIR+MAX+95+BB+PRM.png"
      }
    ]
  },
  {
    id: "jordan_spizike_low",
    title: "Jordan Spizike Low",
    subtitle: "Men's Shoes",
    category: "jordan",
    price: 154.99,
    badge: "Just In",
    colorways: [
      {
        name: "White / Gym Red / Obsidian",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_126ab356-44d8-4a06-89b4-fcdcc8df0245,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/a5cb8cc0-adff-444e-a945-8ab9107b690b/JORDAN+SPIZIKE+LOW.png"
      },
      {
        name: "Black / Anthracite",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/825edf59-e3c6-4014-86c2-b0b086d67f11/AIR+FORCE+1+LUXE.png"
      }
    ]
  },
  {
    id: "nike_air_max_plus",
    title: "Nike Air Max Plus",
    subtitle: "Men's Shoes",
    category: "lifestyle",
    price: 169.99,
    badge: "Bestseller",
    colorways: [
      {
        name: "Black / University Blue",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/e0e2e8d6-a7f7-4293-b711-3d79b2104aca/NIKE+AIR+MAX+PLUS.png"
      },
      {
        name: "Sunset Orange / Black",
        img: "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/13119edc-09b3-4e56-bdfb-54d8c096f55a/NIKE+AIR+MAX+95+BB+PRM.png"
      }
    ]
  }
];

const PROMO_MESSAGES = [
  "Free delivery on orders £50+ (Nike Members) and £99+ (Guests). Otherwise £4.50 delivery. Learn more.",
  "Easy 30-day returns for all Nike Members. Wear it, test it, keep what you love.",
  "Student & Key Worker Discount: Get 10% off with valid ID. Verify status now."
];

export default function NikeStorePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [error, setError] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("featured");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addedItemName, setAddedItemName] = useState<string | null>(null);
  const [activeColorwayIndex, setActiveColorwayIndex] = useState<Record<string, number>>({});
  
  // Modals & Drawers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [sizeModalProduct, setSizeModalProduct] = useState<ShoeProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("UK 9");
  const [promoIndex, setPromoIndex] = useState(0);

  // Internal backend operator inspection mode (?ops=1)
  const [isOpsMode, setIsOpsMode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("ops") === "1" || p.get("admin") === "1" || p.get("preview") === "backend") {
        setIsOpsMode(true);
      }
    }
  }, []);

  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/sim/storefront");
        if (!r.ok) throw new Error("Storefront service unavailable");
        const b = await r.json();
        if (live) {
          setBanners(b.banners || []);
          setPublications(b.publications || []);
          setError("");
        }
      } catch (e) {
        if (live) setError(String(e));
      }
    };
    void poll();
    const t = setInterval(poll, 1500);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cartItems]);

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleQuickAdd = (product: ShoeProduct, size = "UK 9") => {
    const activeColorIdx = activeColorwayIndex[product.id] ?? 0;
    const activeImg = product.colorways[activeColorIdx]?.img || product.colorways[0].img;
    const cartId = `${product.id}_${size}_${activeColorIdx}`;

    setCartItems((prev) => {
      const existing = prev.find((i) => i.cartId === cartId);
      if (existing) {
        return prev.map((i) =>
          i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          cartId,
          productId: product.id,
          title: product.title,
          subtitle: product.subtitle,
          img: activeImg,
          price: product.price,
          size,
          quantity: 1
        }
      ];
    });

    setAddedItemName(`${product.title} (${size})`);
    setTimeout(() => setAddedItemName(null), 3000);
    setSizeModalProduct(null);
  };

  const updateCartQuantity = (cartId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.cartId === cartId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (cartId: string) => {
    setCartItems((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const activeBanners = useMemo(() => {
    const now = Date.now();
    return banners.filter(
      (b) => b.active && Date.parse(b.startsAt) <= now && Date.parse(b.expiresAt) > now
    );
  }, [banners]);

  const filteredProducts = useMemo(() => {
    let list = [...NIKE_PRODUCTS];

    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q));
    }

    if (priceFilter === "under100") {
      list = list.filter((p) => p.price < 100);
    } else if (priceFilter === "100to150") {
      list = list.filter((p) => p.price >= 100 && p.price <= 150);
    } else if (priceFilter === "over150") {
      list = list.filter((p) => p.price > 150);
    }

    if (sortBy === "priceAsc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "priceDesc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === "newest") {
      list.sort((a, b) => (b.badge === "Just In" ? 1 : 0) - (a.badge === "Just In" ? 1 : 0));
    }

    return list;
  }, [selectedCategory, searchQuery, priceFilter, sortBy]);

  const favoritedProducts = useMemo(() => {
    return NIKE_PRODUCTS.filter((p) => favoriteIds.has(p.id));
  }, [favoriteIds]);

  return (
    <div className="min-h-screen bg-white text-[#111111] font-sans antialiased flex flex-col selection:bg-[#111111] selection:text-white">
      {/* 1. Global Utility Sub-Brand Bar */}
      <div className="bg-[#f5f5f5] px-12 h-9 flex justify-between items-center text-[12px] text-[#111111] font-medium border-b border-[#e5e5e5]">
        <div className="flex items-center gap-7">
          {/* Jordan Jumpman Icon */}
          <a href="#" className="hover:opacity-70 transition-opacity" title="Jordan">
            <svg
              className="w-4 h-4 fill-current"
              width="16"
              height="16"
              style={{ width: "16px", height: "16px", maxWidth: "16px", maxHeight: "16px", display: "block" }}
              viewBox="0 0 24 24"
            >
              <path d="M18.8 2.2c-.3 0-.6.1-.8.3l-2.4 2.5-2-1.9c-.3-.3-.7-.4-1.1-.3-.4.1-.7.4-.8.8l-.8 3.2-3.1 1.7c-.4.2-.6.6-.6 1 0 .2.1.5.2.7l3.8 4.7-1.4 5.3c-.1.5.1 1 .6 1.2.2.1.4.1.6.1.3 0 .6-.1.8-.3l6.5-6.5c.3-.3.4-.7.3-1.1-.1-.4-.4-.7-.8-.8l-3.3-.8 1.4-4.8 2.6 1.6c.2.1.5.2.7.2.5 0 1-.3 1.2-.8.2-.5 0-1.1-.4-1.4l-3.2-2.3 2.1-2.2c.5-.5.5-1.3 0-1.8-.3-.2-.6-.4-.9-.4z"/>
            </svg>
          </a>
          {/* Converse Star Chevron */}
          <a href="#" className="hover:opacity-70 transition-opacity" title="Converse">
            <svg
              className="w-4 h-4 fill-current"
              width="16"
              height="16"
              style={{ width: "16px", height: "16px", maxWidth: "16px", maxHeight: "16px", display: "block" }}
              viewBox="0 0 24 24"
            >
              <path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/>
            </svg>
          </a>
        </div>

        {/* Consumer Utility Links */}
        <div className="flex items-center gap-3 text-[12px] text-[#111111]">
          {isOpsMode && (
            <>
              <a href="/shopify" className="text-emerald-700 font-bold hover:underline flex items-center gap-1">
                <span>Shopify Admin ↗</span>
              </a>
              <span className="text-[#ccc]">|</span>
              <a href="/" className="text-sky-600 font-bold hover:underline flex items-center gap-1">
                <span>← Back to Operations Cockpit</span>
              </a>
              <span className="text-[#ccc]">|</span>
            </>
          )}
          <a href="#" className="hover:text-black">Find a Store</a>
          <span className="text-[#ccc]">|</span>
          <a href="#" className="hover:text-black">Help</a>
          <span className="text-[#ccc]">|</span>
          <a href="#" className="hover:text-black">Join Us</a>
          <span className="text-[#ccc]">|</span>
          <a href="#" className="hover:text-black">Sign In</a>
        </div>
      </div>

      {/* 2. Main Nike Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#e5e5e5] px-12 h-16 flex items-center justify-between">
        {/* Nike Official Swoosh SVG */}
        <a href="/store" className="flex-shrink-0" title="Nike Home">
          <svg
            className="w-16 h-8 text-black fill-current"
            width="60"
            height="30"
            style={{ width: "60px", height: "30px", maxWidth: "60px", maxHeight: "30px", display: "block" }}
            viewBox="0 0 24 24"
          >
            <path fillRule="evenodd" d="M21 8.719L7.836 14.303C6.74 14.768 5.818 15 5.075 15c-.836 0-1.445-.295-1.819-.884-.485-.76-.273-1.982.559-3.272.494-.754 1.122-1.446 1.734-2.108-.144.234-1.415 2.349-.025 3.345.275.2.666.298 1.147.298.386 0 .829-.063 1.316-.19L21 8.719z" clipRule="evenodd" />
          </svg>
        </a>

        {/* Primary Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-[16px] font-medium text-[#111111]">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`hover:opacity-70 transition-opacity cursor-pointer ${selectedCategory === "all" ? "font-bold border-b-2 border-black" : ""}`}
          >
            New
          </button>
          <button
            onClick={() => setSelectedCategory("lifestyle")}
            className={`hover:opacity-70 transition-opacity cursor-pointer ${selectedCategory === "lifestyle" ? "font-bold border-b-2 border-black" : ""}`}
          >
            Men
          </button>
          <button
            onClick={() => setSelectedCategory("running")}
            className={`hover:opacity-70 transition-opacity cursor-pointer ${selectedCategory === "running" ? "font-bold border-b-2 border-black" : ""}`}
          >
            Women
          </button>
          <button
            onClick={() => setSelectedCategory("training")}
            className={`hover:opacity-70 transition-opacity cursor-pointer ${selectedCategory === "training" ? "font-bold border-b-2 border-black" : ""}`}
          >
            Kids
          </button>
          <button
            onClick={() => setSelectedCategory("football")}
            className={`hover:opacity-70 transition-opacity cursor-pointer ${selectedCategory === "football" ? "font-bold border-b-2 border-black" : ""}`}
          >
            Sport
          </button>
          <a href="#" className="hover:opacity-70 transition-opacity font-semibold">
            NikeSKIMS
          </a>
        </nav>

        {/* Right Utility: Search & Icons */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 bg-[#f5f5f5] hover:bg-[#e5e5e5] focus:bg-white text-[14px] text-[#111111] rounded-full pl-10 pr-4 py-2 outline-none border border-transparent focus:border-zinc-300 transition-all placeholder:text-[#707072]"
            />
            <Search className="w-4 h-4 text-[#111111] absolute left-3.5 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Favorites Button */}
          <button
            onClick={() => setIsWishlistOpen(true)}
            className="p-1.5 hover:opacity-70 transition-opacity relative cursor-pointer"
            title="Favorites"
          >
            <Heart className={`w-6 h-6 ${favoriteIds.size > 0 ? "fill-red-500 text-red-500" : "text-[#111111]"}`} />
            {favoriteIds.size > 0 && (
              <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {favoriteIds.size}
              </span>
            )}
          </button>

          {/* Bag Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="p-1.5 hover:opacity-70 transition-opacity relative cursor-pointer"
            title="Bag"
          >
            <ShoppingBag className="w-6 h-6 text-[#111111]" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 3. Free Delivery Promo Strip (Interactive Carousel) */}
      <div className="bg-[#f5f5f5] py-2 px-12 text-center text-[12px] text-[#111111] font-medium border-b border-[#e5e5e5] flex items-center justify-center gap-4">
        <button
          onClick={() =>
            setPromoIndex((prev) => (prev === 0 ? PROMO_MESSAGES.length - 1 : prev - 1))
          }
          className="text-[#111111] hover:opacity-70 cursor-pointer p-1"
          title="Previous notice"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="min-h-[18px] transition-all">
          {PROMO_MESSAGES[promoIndex]}
        </p>
        <button
          onClick={() =>
            setPromoIndex((prev) => (prev === PROMO_MESSAGES.length - 1 ? 0 : prev + 1))
          }
          className="text-[#111111] hover:opacity-70 cursor-pointer p-1"
          title="Next notice"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Official Customer Announcement Banner */}
      {activeBanners.map((b) => {
        const pub = publications
          .filter((p) => p.bannerId === b.bannerId)
          .sort((x, y) => y.occurredAt.localeCompare(x.occurredAt))[0];

        return (
          <aside
            key={b.bannerId}
            role="status"
            className="bg-[#111111] text-white py-2.5 px-12 text-center text-[13px] font-medium transition-all"
          >
            <div className="max-w-[1920px] mx-auto flex items-center justify-center relative">
              <p className="tracking-tight">
                <strong>Notice:</strong> {b.message}
              </p>

              {isOpsMode && pub && (
                <div className="absolute right-0 hidden lg:flex items-center gap-2 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-[11px] text-zinc-300 font-mono">
                  <span>Backend Action: {pub.planId}</span>
                </div>
              )}
            </div>
          </aside>
        );
      })}

      {/* Added to Bag Toast Notification */}
      {addedItemName && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#111111] text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium">Added &ldquo;{addedItemName}&rdquo; to your bag</span>
          <button
            onClick={() => setIsCartOpen(true)}
            className="ml-3 underline text-xs font-bold hover:text-zinc-300"
          >
            View Bag
          </button>
        </div>
      )}

      {/* 5. Main PLP View */}
      <main className="px-12 py-7 w-full flex-1 max-w-[1920px] mx-auto">
        {/* Category Header Row with Interactive Sort By Dropdown */}
        <div className="flex items-center justify-between pb-4 mb-4 relative">
          <h1 className="text-[24px] font-medium text-[#111111]">
            Men&apos;s Trainers &amp; Shoes ({filteredProducts.length})
          </h1>

          <div className="flex items-center gap-6 text-[15px] font-medium text-[#111111]">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer"
            >
              <span>{showFilters ? "Hide Filters" : "Show Filters"}</span>
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Sort By Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center gap-1 cursor-pointer hover:opacity-70 py-1"
              >
                <span>
                  Sort By:{" "}
                  <strong>
                    {sortBy === "featured"
                      ? "Featured"
                      : sortBy === "newest"
                      ? "Newest"
                      : sortBy === "priceAsc"
                      ? "Price: Low-High"
                      : "Price: High-Low"}
                  </strong>
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {isSortOpen && (
                <div className="absolute right-0 top-8 w-48 bg-white border border-[#e5e5e5] rounded shadow-xl z-30 py-2 text-sm">
                  {[
                    { id: "featured", label: "Featured" },
                    { id: "newest", label: "Newest" },
                    { id: "priceAsc", label: "Price: Low to High" },
                    { id: "priceDesc", label: "Price: High to Low" }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortBy(opt.id);
                        setIsSortOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#f5f5f5] flex items-center justify-between"
                    >
                      <span className={sortBy === opt.id ? "font-bold text-black" : "text-[#707072]"}>
                        {opt.label}
                      </span>
                      {sortBy === opt.id && <Check className="w-4 h-4 text-black" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="flex gap-12 items-start">
          {/* Left Category & Filter Sidebar (Collapsible) */}
          {showFilters && (
            <aside className="w-[240px] flex-shrink-0 hidden md:block space-y-6 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4">
              {/* Vertical Category Links */}
              <div className="space-y-3 text-[15px] font-medium text-[#111111] border-b border-[#e5e5e5] pb-6">
                {[
                  { id: "all", label: "All Shoes" },
                  { id: "lifestyle", label: "Lifestyle" },
                  { id: "jordan", label: "Jordan" },
                  { id: "running", label: "Running" },
                  { id: "football", label: "Football" },
                  { id: "training", label: "Training & Gym" }
                ].map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`block w-full text-left hover:text-[#707072] transition-colors cursor-pointer ${
                      selectedCategory === cat.id ? "font-bold text-black" : "text-[#111111]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Accordion Filter: Shop By Price */}
              <div className="border-b border-[#e5e5e5] pb-5">
                <div className="flex justify-between items-center font-medium text-[15px] mb-3">
                  <span>Shop By Price</span>
                </div>
                <div className="space-y-2 text-[14px] text-[#111111]">
                  {[
                    { id: "all", label: "All Prices" },
                    { id: "under100", label: "Under £100" },
                    { id: "100to150", label: "£100 - £150" },
                    { id: "over150", label: "Over £150" }
                  ].map((tier) => (
                    <label key={tier.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="priceRadio"
                        checked={priceFilter === tier.id}
                        onChange={() => setPriceFilter(tier.id)}
                        className="w-4 h-4 accent-black"
                      />
                      <span>{tier.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Shoe Size Selection Chips */}
              <div className="border-b border-[#e5e5e5] pb-5">
                <div className="flex justify-between items-center font-medium text-[15px] mb-3">
                  <span>Size</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {["UK 6", "UK 7", "UK 8", "UK 8.5", "UK 9", "UK 9.5", "UK 10", "UK 11", "UK 12"].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`border rounded py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
                        selectedSize === size ? "border-black bg-black text-white" : "border-[#e5e5e5] hover:border-black"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          {/* Product Cards Grid: Smooth 3 or 4 Column Dynamic Layout */}
          <div className="flex-1">
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-12 ${
                showFilters ? "lg:grid-cols-3" : "lg:grid-cols-4"
              }`}
            >
              {filteredProducts.map((product) => {
                const isFav = favoriteIds.has(product.id);
                const activeColorIdx = activeColorwayIndex[product.id] ?? 0;
                const activeColorway = product.colorways[activeColorIdx] || product.colorways[0];

                return (
                  <article key={product.id} className="group flex flex-col">
                    {/* Square Image Box */}
                    <div className="relative bg-[#f6f6f6] aspect-square overflow-hidden flex items-center justify-center p-4">
                      {/* Favorite Button */}
                      <button
                        onClick={() => toggleFavorite(product.id)}
                        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-zinc-800 transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow"
                        title="Save to Wishlist"
                      >
                        <Heart className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
                      </button>

                      {/* Main Shoe Image */}
                      <img
                        src={activeColorway.img}
                        alt={product.title}
                        className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />

                      {/* Hover Quick Add Button */}
                      <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSizeModalProduct(product)}
                          className="w-full bg-black/90 hover:bg-black text-white py-2.5 rounded-full text-[12px] font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Quick Add · £{product.price.toFixed(2)}</span>
                        </button>
                      </div>
                    </div>

                    {/* Colorway Miniature Thumbnails */}
                    <div className="flex items-center gap-1.5 mt-3 mb-2 min-h-[36px]">
                      {product.colorways.map((cw, idx) => (
                        <button
                          key={idx}
                          onClick={() =>
                            setActiveColorwayIndex((prev) => ({ ...prev, [product.id]: idx }))
                          }
                          onMouseEnter={() =>
                            setActiveColorwayIndex((prev) => ({ ...prev, [product.id]: idx }))
                          }
                          className={`w-8 h-8 rounded border overflow-hidden p-0.5 bg-[#f6f6f6] transition-all cursor-pointer ${
                            idx === activeColorIdx ? "border-black scale-105" : "border-[#e5e5e5] opacity-75 hover:opacity-100"
                          }`}
                          title={cw.name}
                        >
                          <img src={cw.img} alt={cw.name} className="w-full h-full object-contain mix-blend-multiply" />
                        </button>
                      ))}
                    </div>

                    {/* Badge & Urgency Indicator */}
                    <div className="flex items-center justify-between mb-0.5">
                      {product.badge && (
                        <span className="text-[15px] font-medium text-[#fa5400]">
                          {product.badge}
                        </span>
                      )}

                      {product.isAnomalyRelated && (
                        <span className="text-[12px] font-semibold text-[#b91c1c] bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          Only {product.stockLevel ?? 3} pairs left
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2
                      onClick={() => setSizeModalProduct(product)}
                      className="text-[15px] font-medium text-[#111111] leading-snug cursor-pointer hover:underline"
                    >
                      {product.title}
                    </h2>

                    {/* Subtitle */}
                    <p className="text-[15px] text-[#707072] mt-0.5">
                      {product.subtitle}
                    </p>

                    {/* Price */}
                    <p className="text-[15px] font-medium text-[#111111] mt-2">
                      £{product.price.toFixed(2)}
                    </p>
                  </article>
                );
              })}
            </div>

            {/* In-feed Editorial Banner */}
            <div className="mt-16 bg-[#111111] text-white rounded-none overflow-hidden relative flex flex-col justify-end min-h-[380px] p-12">
              <div className="absolute inset-0 z-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-700 via-zinc-900 to-black" />
              <div className="relative z-10 max-w-xl space-y-4">
                <h3 className="text-5xl font-black uppercase tracking-tighter leading-none">
                  TRAIN EVERYTHING
                </h3>
                <p className="text-[15px] text-zinc-300 max-w-md">
                  High-performance footwear engineered for relentless workouts, turf drills, and speed intervals.
                </p>
                <div>
                  <button
                    onClick={() => setSelectedCategory("training")}
                    className="bg-white text-black font-bold text-[14px] px-6 py-2.5 rounded-full hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    Shop Hybrid
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 6. Nike Global Footer */}
      <footer className="bg-[#111111] text-white mt-24 pt-16 pb-12 border-t border-zinc-800">
        <div className="max-w-[1920px] mx-auto px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-zinc-800 text-sm">
            <div>
              <h4 className="font-extrabold uppercase tracking-wider text-[12px] mb-4 text-white">Resources</h4>
              <ul className="space-y-3 text-[12px] text-zinc-400 font-medium">
                <li><a href="#" className="hover:text-white">Find A Store</a></li>
                <li><a href="#" className="hover:text-white">Become A Member</a></li>
                <li><a href="#" className="hover:text-white">Send Us Feedback</a></li>
                <li><a href="#" className="hover:text-white">Student Discounts</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold uppercase tracking-wider text-[12px] mb-4 text-white">Help</h4>
              <ul className="space-y-3 text-[12px] text-zinc-400 font-medium">
                <li><a href="#" className="hover:text-white">Get Help</a></li>
                <li><a href="#" className="hover:text-white">Order Status</a></li>
                <li><a href="#" className="hover:text-white">Delivery</a></li>
                <li><a href="#" className="hover:text-white">Returns &amp; Refunds</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold uppercase tracking-wider text-[12px] mb-4 text-white">Company</h4>
              <ul className="space-y-3 text-[12px] text-zinc-400 font-medium">
                <li><a href="#" className="hover:text-white">About Nike</a></li>
                <li><a href="#" className="hover:text-white">News</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Sustainability</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold uppercase tracking-wider text-[12px] mb-4 text-white">Promotions &amp; Discounts</h4>
              <ul className="space-y-3 text-[12px] text-zinc-400 font-medium">
                <li><a href="#" className="hover:text-white">Student Discount</a></li>
                <li><a href="#" className="hover:text-white">Military Discount</a></li>
                <li><a href="#" className="hover:text-white">Teacher Discount</a></li>
                <li><a href="#" className="hover:text-white">First Responder Discount</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-zinc-500">
            <div className="flex items-center gap-4">
              <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                <span>🇬🇧</span>
                <span>United Kingdom</span>
              </span>
              <span>© 2026 Nike, Inc. All Rights Reserved.</span>
            </div>

            <div className="flex flex-wrap gap-6">
              <a href="#" className="hover:text-zinc-300">Guides</a>
              <a href="#" className="hover:text-zinc-300">Terms of Sale</a>
              <a href="#" className="hover:text-zinc-300">Terms of Use</a>
              <a href="#" className="hover:text-zinc-300">Nike Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* SIZE SELECTION MODAL */}
      {sizeModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-black">{sizeModalProduct.title}</h3>
                <p className="text-sm text-zinc-500">{sizeModalProduct.subtitle} · £{sizeModalProduct.price.toFixed(2)}</p>
              </div>
              <button onClick={() => setSizeModalProduct(null)} className="text-zinc-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold uppercase text-zinc-700 mb-2">Select UK Size</label>
              <div className="grid grid-cols-4 gap-2">
                {["UK 6", "UK 6.5", "UK 7", "UK 7.5", "UK 8", "UK 8.5", "UK 9", "UK 9.5", "UK 10", "UK 10.5", "UK 11", "UK 12"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`py-2 text-xs font-bold rounded border transition-colors ${
                      selectedSize === s
                        ? "bg-black text-white border-black"
                        : "border-zinc-300 hover:border-black text-zinc-800"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSizeModalProduct(null)}
                className="w-1/3 py-3 border border-zinc-300 rounded-full font-bold text-sm hover:border-black"
              >
                Cancel
              </button>
              <button
                onClick={() => handleQuickAdd(sizeModalProduct, selectedSize)}
                className="w-2/3 py-3 bg-black hover:bg-zinc-800 text-white rounded-full font-bold text-sm shadow flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Bag</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHOPPING BAG SLIDE-OVER DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-[#e5e5e5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <h3 className="font-bold text-lg text-black">Bag ({totalCartCount})</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 hover:bg-zinc-100 rounded-full"
              >
                <X className="w-5 h-5 text-black" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cartItems.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto" />
                  <p className="text-zinc-600 font-medium">There are no items in your bag.</p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="bg-black text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-full hover:bg-zinc-800"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.cartId} className="flex gap-4 pb-6 border-b border-[#e5e5e5]">
                    <div className="w-20 h-20 bg-[#f6f6f6] rounded p-2 flex-shrink-0 flex items-center justify-center">
                      <img src={item.img} alt={item.title} className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-sm text-black leading-snug">{item.title}</h4>
                          <span className="font-bold text-sm">£{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{item.subtitle}</p>
                        <p className="text-xs font-medium text-zinc-700 mt-1">Size: {item.size}</p>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-zinc-300 rounded">
                          <button
                            onClick={() => updateCartQuantity(item.cartId, -1)}
                            className="p-1 hover:bg-zinc-100 text-zinc-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.cartId, 1)}
                            className="p-1 hover:bg-zinc-100 text-zinc-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeCartItem(item.cartId)}
                          className="text-zinc-400 hover:text-red-600 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer Summary */}
            {cartItems.length > 0 && (
              <div className="p-6 border-t border-[#e5e5e5] bg-[#fafafa] space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>£{cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Estimated Delivery</span>
                    <span className="text-emerald-600 font-medium">Free</span>
                  </div>
                  <div className="flex justify-between font-bold text-base text-black pt-2 border-t border-zinc-200">
                    <span>Total</span>
                    <span>£{cartSubtotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => alert(`Simulated Nike Checkout initiated for £${cartSubtotal.toFixed(2)}`)}
                  className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-3.5 rounded-full text-sm shadow-md transition-all cursor-pointer"
                >
                  Member Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WISHLIST SLIDE-OVER DRAWER */}
      {isWishlistOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="px-6 py-5 border-b border-[#e5e5e5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                <h3 className="font-bold text-lg text-black">Favourites ({favoriteIds.size})</h3>
              </div>
              <button
                onClick={() => setIsWishlistOpen(false)}
                className="p-1 hover:bg-zinc-100 rounded-full"
              >
                <X className="w-5 h-5 text-black" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {favoritedProducts.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <Heart className="w-12 h-12 text-zinc-300 mx-auto" />
                  <p className="text-zinc-600 font-medium">No items saved to your favourites yet.</p>
                </div>
              ) : (
                favoritedProducts.map((product) => (
                  <div key={product.id} className="flex gap-4 pb-6 border-b border-[#e5e5e5]">
                    <div className="w-20 h-20 bg-[#f6f6f6] rounded p-2 flex-shrink-0 flex items-center justify-center">
                      <img src={product.colorways[0].img} alt={product.title} className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-sm text-black">{product.title}</h4>
                          <span className="font-bold text-sm">£{product.price.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-zinc-500">{product.subtitle}</p>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => {
                            handleQuickAdd(product, "UK 9");
                            setIsWishlistOpen(false);
                            setIsCartOpen(true);
                          }}
                          className="bg-black hover:bg-zinc-800 text-white text-xs font-bold px-3 py-1.5 rounded-full"
                        >
                          Move to Bag
                        </button>
                        <button
                          onClick={() => toggleFavorite(product.id)}
                          className="text-xs text-zinc-500 hover:text-red-600 underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Operator Inspection Badge */}
      {isOpsMode && (
        <aside
          role="status"
          aria-label="Backend Operator Mode Active"
          className="fixed bottom-4 left-4 z-50 bg-slate-900/95 border border-slate-700 text-white px-3 py-2 rounded-lg shadow-xl text-xs flex items-center gap-3 backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">Backend Operator View</span>
          </div>
          <span className="text-slate-600">|</span>
          <a
            href="/"
            className="text-sky-400 hover:text-sky-300 font-medium underline flex items-center gap-1"
          >
            <span>Return to Cockpit ↗</span>
          </a>
        </aside>
      )}
    </div>
  );
}
