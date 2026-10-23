"use client";

import React from "react";
import { SimulatedBanner } from "../simulator/state";
import { ShoppingBag, Search, ShieldCheck, Truck, Star } from "lucide-react";

interface StorefrontPreviewProps {
  banner: SimulatedBanner | null;
}

export function StorefrontPreview({ banner }: StorefrontPreviewProps) {
  const products = [
    {
      id: "prod_01",
      name: "Cashmere Ribbed Knit",
      price: "£145.00",
      image: "🧥",
      tag: "Best Seller",
      rating: 4.8,
    },
    {
      id: "prod_02",
      name: "Merino Wool Overcoat",
      price: "£280.00",
      image: "🧥",
      tag: "Limited Stock",
      rating: 4.9,
    },
    {
      id: "prod_03",
      name: "Italian Leather Weekender",
      price: "£320.00",
      image: "🧳",
      tag: "New Season",
      rating: 4.7,
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Browser / Store Header Bar */}
      <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-slate-300 ml-2">https://store.novalondon.com</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Shopify Storefront Live</span>
        </div>
      </div>

      {/* Dynamic Storefront Announcement Banner (Controlled by Storefront Agent) */}
      {banner ? (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-inner transition-all duration-300">
          <Truck className="w-4 h-4 text-slate-950" />
          <span>{banner.message}</span>
          <span className="text-[10px] font-mono bg-black/10 px-1.5 py-0.5 rounded">
            Agent Controlled
          </span>
        </div>
      ) : (
        <div className="bg-slate-800/60 text-slate-400 px-4 py-1.5 text-[11px] text-center font-medium">
          Free UK next-day delivery on all orders over £100
        </div>
      )}

      {/* Store Navigation */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center gap-8">
          <span className="font-serif text-lg tracking-widest text-white font-bold">
            NOVA LONDON
          </span>
          <nav className="hidden sm:flex gap-5 text-xs text-slate-300 font-medium">
            <span className="hover:text-white cursor-pointer">New Arrivals</span>
            <span className="hover:text-white cursor-pointer">Apparel</span>
            <span className="hover:text-white cursor-pointer">Accessories</span>
            <span className="hover:text-white cursor-pointer text-amber-400">Sale</span>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <Search className="w-4 h-4 cursor-pointer hover:text-white" />
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200 bg-slate-800 px-2.5 py-1 rounded-full cursor-pointer hover:bg-slate-700">
            <ShoppingBag className="w-3.5 h-3.5 text-sky-400" />
            <span>Bag (2)</span>
          </div>
        </div>
      </div>

      {/* Product Grid Mockup */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Featured Autumn Collection
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {banner ? "Delivery SLA Notice Active" : "Standard 24h Dispatch"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3 hover:border-slate-700 transition"
            >
              <div className="h-28 bg-slate-900 rounded-md flex items-center justify-center text-4xl shadow-inner">
                {p.image}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-200">{p.name}</span>
                  <span className="text-xs font-mono font-bold text-white">{p.price}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="text-amber-400/90 flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400" /> {p.rating}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                    {p.tag}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
