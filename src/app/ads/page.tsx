"use client";

import { useState, useEffect, useMemo } from "react";
import { agentDisplayName } from "../../agents/roles";
import { money } from "../../lib/format";
import {
  Search,
  Plus,
  Copy,
  Edit2,
  Sparkles,
  RefreshCw,
  MoreHorizontal,
  ChevronDown,
  Layers,
  Folder,
  FileText,
  SlidersHorizontal,
  Download,
  Calendar,
  Zap,
  HelpCircle,
  Settings,
  CreditCard,
  BarChart2,
  Users,
  Grid,
  Info,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Check,
  Trash2,
  X,
  Pencil,
  Clock,
  Send,
  CornerUpRight,
  Inbox,
  FlaskConical,
  Columns,
  Maximize2,
  User,
  Bell,
  SendHorizonal,
  Mailbox,
  Upload,
  Gauge,
  Table2,
  Files,
  Megaphone,
  Workflow,
  Menu,
  Bug,
  CircleArrowUp,
  Navigation,
  MailOpen,
  Settings2,
  Columns3,
  AlignLeft,
  LayoutGrid,
  PanelTop,
  ScrollText,
  SquareActivity,
  ChartNoAxesColumn
} from "lucide-react";

// Small solid caret used on Meta's dropdown buttons
function Caret({ className = "w-[9px] h-[9px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M1 3h8L5 7.5z" />
    </svg>
  );
}

// Campaign tab icon: blue folder with a white triangle
function CampaignFolderIcon({ className = "w-[19px] h-[19px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h4.2l1.6 1.8H17a1.5 1.5 0 0 1 1.5 1.5v9.2A1.5 1.5 0 0 1 17 17H3a1.5 1.5 0 0 1-1.5-1.5z" fill="#0a66c2" />
      <path d="M10 8.6l2.6 4.6H7.4z" fill="#fff" />
    </svg>
  );
}

// Meta AI search glyph: open ring with a small spark
function AISearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12.6 9.6A5.2 5.2 0 1 1 9.8 3" />
      <path d="M12.5 1.8v3M11 3.3h3" strokeWidth="1.3" />
      <path d="M11.9 11.9l2.3 2.3" />
    </svg>
  );
}

// Analyse button's multicolour petal mark
function AnalysePetals({ className = "w-[15px] h-[15px]" }: { className?: string }) {
  const colors = ["#8b5cf6", "#d946ef", "#ec4899", "#6366f1", "#a855f7", "#3b82f6", "#c026d3", "#7c3aed"];
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      {colors.map((color, i) => {
        const angle = (i * Math.PI) / 4;
        return <circle key={color} cx={8 + Math.cos(angle) * 4.6} cy={8 + Math.sin(angle) * 4.6} r="1.75" fill={color} />;
      })}
    </svg>
  );
}

// Opportunity score ring with the score inside
function OpportunityGauge({ score = 100 }: { score?: number }) {
  return (
    <svg className="w-[26px] h-[26px]" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="11" fill="#fff" stroke="#dce3eb" strokeWidth="2.4" />
      <path d="M5.2 20.8A11 11 0 1 1 20.8 20.8" fill="none" stroke="#0a66c2" strokeWidth="2.4" strokeLinecap="round" />
      <text x="13" y="16.2" textAnchor="middle" fontSize="8.6" fontWeight="700" fill="#1c2b33">{score}</text>
    </svg>
  );
}

// Blue rosette shown after accepting the policy
function PolicyBadge() {
  return (
    <svg className="w-[47px] h-[47px]" viewBox="0 0 47 47" aria-hidden="true">
      <circle cx="23.5" cy="23.5" r="23.5" fill="#4675dd" />
      <path d="M20.4 25.4l-1.6 6.1 2.6-1.3 2.1 1.6 2.1-1.6 2.6 1.3-1.6-6.1z" fill="#fff" />
      <circle cx="23.5" cy="20.6" r="6.6" fill="#fff" />
      <path d="M20.6 20.8l2 2 3.9-4" fill="none" stroke="#4675dd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Official Nike Swoosh Vector for Nike Official Profile Photo
function NikeSwoosh({ className = "w-3.5 h-3.5 fill-white" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M21 8.719L7.836 14.303C6.74 14.768 5.818 15 5.075 15c-.836 0-1.445-.295-1.819-.884-.485-.76-.273-1.982.559-3.272.494-.754 1.122-1.446 1.734-2.108-.144.234-1.415 2.349-.025 3.345.275.2.666.298 1.147.298.386 0 .829-.063 1.316-.19L21 8.719z"
        clipRule="evenodd"
      />
    </svg>
  );
}

type Metric = {
  metricId: string;
  campaignId: string;
  occurredAt: string;
  dailyBudgetMinor: number;
  spendMinor: number;
  clicks: number;
  estimatedConversions: number;
  currency: string;
};

type CampaignRecord = {
  campaignId: string;
  name: string;
  currency: string;
  dailyBudgetMinor: number;
  updatedAt: string;
  status?: string;
};

type AdsData = {
  campaigns: CampaignRecord[];
  metrics: Metric[];
  events: {
    eventId: string;
    occurredAt: string;
    type?: string;
    payload: Record<string, unknown>;
  }[];
};

type TabType = "campaigns" | "ad_sets" | "ads";
type FilterPreset = "all" | "delivery" | "actions" | "active";

interface CampaignItem {
  id: string;
  name: string;
  subtitle: string;
  budgetMinor: number;
  currency: string;
  amountSpent: number;
  reach: number;
  tickets: number;
  costPerTicket: number;
  coursePurchases: number;
  costPerCoursePurchase: number;
  conversionValue: number;
  roas: number;
  isNormalAgentTarget?: boolean;
}

interface AdSetItem {
  id: string;
  campaignId: string;
  name: string;
  subtitle: string;
  amountSpent: number;
  reach: number;
  tickets: number;
  costPerTicket: number;
  purchases: number;
  costPerPurchase: number;
  conversionValue: number;
  roas: number;
}

interface AdItem {
  id: string;
  adSetId: string;
  name: string;
  format: "video" | "image" | "carousel";
  status: "active" | "off";
  amountSpent: number;
  landingPageViews: number;
  tickets: number;
  costPerTicket: number;
}

const INITIAL_CAMPAIGNS: CampaignItem[] = [
  {
    id: "campaign_A",
    name: "Masterclass ₹99",
    subtitle: "New people · sales",
    budgetMinor: 5000,
    currency: "GBP",
    amountSpent: 42000,
    reach: 93300,
    tickets: 300,
    costPerTicket: 140,
    coursePurchases: 9,
    costPerCoursePurchase: 4667,
    conversionValue: 74691,
    roas: 1.78,
    isNormalAgentTarget: true
  },
  {
    id: "campaign_B",
    name: "Course offer",
    subtitle: "Retarget · registrants",
    budgetMinor: 6000,
    currency: "GBP",
    amountSpent: 6000,
    reach: 940,
    tickets: 0,
    costPerTicket: 0,
    coursePurchases: 7,
    costPerCoursePurchase: 857,
    conversionValue: 34993,
    roas: 5.83,
    isNormalAgentTarget: false
  },
  {
    id: "campaign_C",
    name: "Deadline",
    subtitle: "Retarget · checkouts",
    budgetMinor: 3200,
    currency: "GBP",
    amountSpent: 3200,
    reach: 310,
    tickets: 0,
    costPerTicket: 0,
    coursePurchases: 4,
    costPerCoursePurchase: 800,
    conversionValue: 19996,
    roas: 6.25,
    isNormalAgentTarget: false
  }
];

const INITIAL_AD_SETS: AdSetItem[] = [
  {
    id: "adset_01",
    campaignId: "campaign_A",
    name: "Meditation interest | IN 25-45",
    subtitle: "New people · sales",
    amountSpent: 24700,
    reach: 57600,
    tickets: 183,
    costPerTicket: 135,
    purchases: 6,
    costPerPurchase: 4117,
    conversionValue: 49794,
    roas: 2.02
  },
  {
    id: "adset_02",
    campaignId: "campaign_A",
    name: "Broad (Advantage+) | IN 25-45",
    subtitle: "New people · sales",
    amountSpent: 17300,
    reach: 35700,
    tickets: 117,
    costPerTicket: 148,
    purchases: 3,
    costPerPurchase: 5767,
    conversionValue: 24897,
    roas: 1.44
  },
  {
    id: "adset_03",
    campaignId: "campaign_B",
    name: "Masterclass registrants | 7 days",
    subtitle: "Retarget · registrants",
    amountSpent: 4000,
    reach: 590,
    tickets: 0,
    costPerTicket: 0,
    purchases: 5,
    costPerPurchase: 800,
    conversionValue: 24995,
    roas: 6.25
  },
  {
    id: "adset_04",
    campaignId: "campaign_B",
    name: "Masterclass attendees | 14 days",
    subtitle: "Retarget · registrants",
    amountSpent: 2000,
    reach: 350,
    tickets: 0,
    costPerTicket: 0,
    purchases: 2,
    costPerPurchase: 1000,
    conversionValue: 9998,
    roas: 5.00
  },
  {
    id: "adset_05",
    campaignId: "campaign_C",
    name: "Checkout abandoners | 7 days",
    subtitle: "Retarget · checkouts",
    amountSpent: 3200,
    reach: 310,
    tickets: 0,
    costPerTicket: 0,
    purchases: 4,
    costPerPurchase: 800,
    conversionValue: 19996,
    roas: 6.25
  }
];

const INITIAL_ADS: AdItem[] = [
  {
    id: "ad_01",
    adSetId: "adset_01",
    name: "Reel · breathing demo",
    format: "video",
    status: "active",
    amountSpent: 19800,
    landingPageViews: 1320,
    tickets: 162,
    costPerTicket: 122
  },
  {
    id: "ad_02",
    adSetId: "adset_01",
    name: "Reel · student story",
    format: "video",
    status: "active",
    amountSpent: 14600,
    landingPageViews: 880,
    tickets: 106,
    costPerTicket: 138
  },
  {
    id: "ad_03",
    adSetId: "adset_02",
    name: "Static · poster",
    format: "image",
    status: "off",
    amountSpent: 4900,
    landingPageViews: 230,
    tickets: 21,
    costPerTicket: 233
  },
  {
    id: "ad_04",
    adSetId: "adset_02",
    name: "Carousel · 5 signs",
    format: "carousel",
    status: "off",
    amountSpent: 2700,
    landingPageViews: 170,
    tickets: 11,
    costPerTicket: 245
  },
  {
    id: "ad_05",
    adSetId: "adset_03",
    name: "Reel · replay + bonus",
    format: "video",
    status: "active",
    amountSpent: 2500,
    landingPageViews: 410,
    tickets: 0,
    costPerTicket: 0
  },
  {
    id: "ad_06",
    adSetId: "adset_03",
    name: "Carousel · student results",
    format: "carousel",
    status: "active",
    amountSpent: 1500,
    landingPageViews: 260,
    tickets: 0,
    costPerTicket: 0
  },
  {
    id: "ad_07",
    adSetId: "adset_04",
    name: "Reel · Q&A clip",
    format: "video",
    status: "active",
    amountSpent: 2000,
    landingPageViews: 300,
    tickets: 0,
    costPerTicket: 0
  },
  {
    id: "ad_08",
    adSetId: "adset_05",
    name: "Static · last 48 hours",
    format: "image",
    status: "active",
    amountSpent: 3200,
    landingPageViews: 240,
    tickets: 0,
    costPerTicket: 0
  }
];

export default function MetaAdsManagerPage() {
  const [data, setData] = useState<AdsData>({ campaigns: [], events: [], metrics: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("campaigns");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("all");
  const [sortField, setSortField] = useState<string>("amountSpent");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [showResultsBar, setShowResultsBar] = useState<boolean>(true);

  // Non-discrimination policy modal states (1:1 with Screenshots 1 & 2)
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(true);
  const [policyStep, setPolicyStep] = useState<"review" | "confirmed">("review");

  // Zero-state view mode (defaults to empty zero-state to match Screenshot 3)
  const [viewEmptyState, setViewEmptyState] = useState<boolean>(true);

  // Drill-down filtering states
  const [selectedCampaignDrill, setSelectedCampaignDrill] = useState<string | null>(null);
  const [selectedAdSetDrill, setSelectedAdSetDrill] = useState<string | null>(null);

  // Toggles for on/off states
  const [campaignToggles, setCampaignToggles] = useState<Record<string, boolean>>({
    campaign_A: true,
    campaign_B: true,
    campaign_C: true
  });
  const [adSetToggles, setAdSetToggles] = useState<Record<string, boolean>>({
    adset_01: true,
    adset_02: true,
    adset_03: true,
    adset_04: true,
    adset_05: true
  });
  const [adToggles, setAdToggles] = useState<Record<string, boolean>>({
    ad_01: true,
    ad_02: true,
    ad_03: false,
    ad_04: false,
    ad_05: true,
    ad_06: true,
    ad_07: true,
    ad_08: true
  });

  // Table selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);

  // Modals & Popovers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showScoreDropdown, setShowScoreDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("1713375799903103 (1713...)");
  const [selectedDateRange, setSelectedDateRange] = useState("Last 30 days: 24 Sep 2026 - 23 Oct 2026");

  // Form states for Create/Edit
  const [formCampaignName, setFormCampaignName] = useState("");
  const [formDailyBudget, setFormDailyBudget] = useState("35.00");
  const [formObjective, setFormObjective] = useState("Sales");

  // Editable lists
  const [campaignsList, setCampaignsList] = useState<CampaignItem[]>(INITIAL_CAMPAIGNS);
  const [adSetsList, setAdSetsList] = useState<AdSetItem[]>(INITIAL_AD_SETS);
  const [adsList, setAdsList] = useState<AdItem[]>(INITIAL_ADS);

  // Inline budget editing
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineBudgetValue, setInlineBudgetValue] = useState("");

  const fetchCampaigns = async () => {
    setIsRefreshing(true);
    try {
      const r = await fetch("/api/sim/ads/campaigns", { cache: "no-store" });
      if (!r.ok) throw new Error("Ads backend unavailable");
      const b = await r.json();
      setData(b);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/sim/ads/campaigns", { cache: "no-store" });
        if (!r.ok) throw new Error("Ads backend unavailable");
        const b = await r.json();
        if (live) {
          setData(b);
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

  // Sync backend live budget with campaign_A
  useEffect(() => {
    if (data.campaigns.length > 0) {
      const backendPrimary = data.campaigns[0];
      setCampaignsList((prev) =>
        prev.map((c) =>
          c.id === "campaign_A"
            ? {
                ...c,
                budgetMinor: backendPrimary.dailyBudgetMinor,
                currency: backendPrimary.currency
              }
            : c
        )
      );
    }
  }, [data.campaigns]);

  async function tick() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/sim/tick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-normal-principal": "merchant_owner_01"
        },
        body: JSON.stringify({ ticks: 1 })
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error?.message || "Simulation tick failed");
      await fetchCampaigns();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Find latest agent budget change event
  const latestChangeEvent = useMemo(() => {
    return data.events
      .filter((e) => e.type === "campaign.budget_updated" || e.payload?.campaignId)
      .sort((x, y) => y.occurredAt.localeCompare(x.occurredAt))[0];
  }, [data.events]);

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filtered & Sorted Campaigns
  const filteredCampaigns = useMemo(() => {
    let list = [...campaignsList];

    // Filter preset
    if (filterPreset === "delivery") {
      list = list.filter((c) => c.amountSpent > 0 || c.reach > 0);
    } else if (filterPreset === "actions") {
      list = list.filter((c) => c.tickets > 0 || c.coursePurchases > 0);
    } else if (filterPreset === "active") {
      list = list.filter((c) => campaignToggles[c.id] !== false);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      let vA = (a as unknown as Record<string, unknown>)[sortField] ?? 0;
      let vB = (b as unknown as Record<string, unknown>)[sortField] ?? 0;
      if (typeof vA === "string") {
        return sortAsc
          ? (vA as string).localeCompare(vB as string)
          : (vB as string).localeCompare(vA as string);
      }
      return sortAsc ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
    });

    return list;
  }, [campaignsList, filterPreset, searchQuery, sortField, sortAsc, campaignToggles]);

  // Filtered & Sorted Ad Sets
  const filteredAdSets = useMemo(() => {
    let list = [...adSetsList];

    if (selectedCampaignDrill) {
      list = list.filter((s) => s.campaignId === selectedCampaignDrill);
    }

    if (filterPreset === "delivery") {
      list = list.filter((s) => s.amountSpent > 0 || s.reach > 0);
    } else if (filterPreset === "actions") {
      list = list.filter((s) => s.tickets > 0 || s.purchases > 0);
    } else if (filterPreset === "active") {
      list = list.filter((s) => adSetToggles[s.id] !== false);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let vA = (a as unknown as Record<string, unknown>)[sortField] ?? 0;
      let vB = (b as unknown as Record<string, unknown>)[sortField] ?? 0;
      if (typeof vA === "string") {
        return sortAsc
          ? (vA as string).localeCompare(vB as string)
          : (vB as string).localeCompare(vA as string);
      }
      return sortAsc ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
    });

    return list;
  }, [adSetsList, selectedCampaignDrill, filterPreset, searchQuery, sortField, sortAsc, adSetToggles]);

  // Filtered & Sorted Ads
  const filteredAds = useMemo(() => {
    let list = [...adsList];

    if (selectedAdSetDrill) {
      list = list.filter((a) => a.adSetId === selectedAdSetDrill);
    }

    if (filterPreset === "delivery") {
      list = list.filter((a) => a.amountSpent > 0 || a.landingPageViews > 0);
    } else if (filterPreset === "actions") {
      list = list.filter((a) => a.tickets > 0);
    } else if (filterPreset === "active") {
      list = list.filter((a) => adToggles[a.id] !== false);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let vA = (a as unknown as Record<string, unknown>)[sortField] ?? 0;
      let vB = (b as unknown as Record<string, unknown>)[sortField] ?? 0;
      if (typeof vA === "string") {
        return sortAsc
          ? (vA as string).localeCompare(vB as string)
          : (vB as string).localeCompare(vA as string);
      }
      return sortAsc ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
    });

    return list;
  }, [adsList, selectedAdSetDrill, filterPreset, searchQuery, sortField, sortAsc, adToggles]);

  // Dynamic Totals Calculation for Campaigns
  const campaignTotals = useMemo(() => {
    const totalSpent = filteredCampaigns.reduce((acc, c) => acc + c.amountSpent, 0);
    const totalReach = filteredCampaigns.reduce((acc, c) => acc + c.reach, 0);
    const totalTickets = filteredCampaigns.reduce((acc, c) => acc + c.tickets, 0);
    const totalPurchases = filteredCampaigns.reduce((acc, c) => acc + c.coursePurchases, 0);
    const totalConversionVal = filteredCampaigns.reduce((acc, c) => acc + c.conversionValue, 0);
    const costPerTicket = totalTickets > 0 ? Math.round(totalSpent / totalTickets) : 0;
    const costPerPurchase = totalPurchases > 0 ? Math.round(totalSpent / totalPurchases) : 0;
    const avgRoas = totalSpent > 0 ? +(totalConversionVal / totalSpent).toFixed(2) : 0;

    return {
      totalSpent,
      totalReach,
      totalTickets,
      totalPurchases,
      totalConversionVal,
      costPerTicket,
      costPerPurchase,
      avgRoas
    };
  }, [filteredCampaigns]);

  // Dynamic Totals Calculation for Ad Sets
  const adSetTotals = useMemo(() => {
    const totalSpent = filteredAdSets.reduce((acc, s) => acc + s.amountSpent, 0);
    const totalReach = filteredAdSets.reduce((acc, s) => acc + s.reach, 0);
    const totalTickets = filteredAdSets.reduce((acc, s) => acc + s.tickets, 0);
    const totalPurchases = filteredAdSets.reduce((acc, s) => acc + s.purchases, 0);
    const totalConversionVal = filteredAdSets.reduce((acc, s) => acc + s.conversionValue, 0);
    const costPerTicket = totalTickets > 0 ? Math.round(totalSpent / totalTickets) : 0;
    const costPerPurchase = totalPurchases > 0 ? Math.round(totalSpent / totalPurchases) : 0;
    const avgRoas = totalSpent > 0 ? +(totalConversionVal / totalSpent).toFixed(2) : 0;

    return {
      totalSpent,
      totalReach,
      totalTickets,
      totalPurchases,
      totalConversionVal,
      costPerTicket,
      costPerPurchase,
      avgRoas
    };
  }, [filteredAdSets]);

  // Toolbar Handlers: Create, Duplicate, Edit, Delete
  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    const budgetNum = parseFloat(formDailyBudget) || 30;
    const newId = `campaign_${Date.now()}`;
    const newCamp: CampaignItem = {
      id: newId,
      name: formCampaignName || "New Campaign",
      subtitle: `${formObjective} · UK`,
      budgetMinor: Math.round(budgetNum * 100),
      currency: "GBP",
      amountSpent: 0,
      reach: 0,
      tickets: 0,
      costPerTicket: 0,
      coursePurchases: 0,
      costPerCoursePurchase: 0,
      conversionValue: 0,
      roas: 0
    };

    setCampaignsList((prev) => [newCamp, ...prev]);
    setCampaignToggles((prev) => ({ ...prev, [newId]: true }));
    setSelectedIds(new Set([newId]));
    setShowCreateModal(false);
    setFormCampaignName("");
  };

  const handleDuplicateSelected = () => {
    if (selectedIds.size === 0) return;

    if (activeTab === "campaigns") {
      const duplicated: CampaignItem[] = [];
      campaignsList.forEach((c) => {
        if (selectedIds.has(c.id)) {
          const dupId = `${c.id}_copy_${Date.now()}`;
          duplicated.push({
            ...c,
            id: dupId,
            name: `${c.name} (Copy)`,
            amountSpent: 0,
            reach: 0,
            tickets: 0,
            coursePurchases: 0,
            conversionValue: 0,
            roas: 0
          });
          setCampaignToggles((prev) => ({ ...prev, [dupId]: true }));
        }
      });
      setCampaignsList((prev) => [...duplicated, ...prev]);
    } else if (activeTab === "ad_sets") {
      const duplicated: AdSetItem[] = [];
      adSetsList.forEach((s) => {
        if (selectedIds.has(s.id)) {
          const dupId = `${s.id}_copy_${Date.now()}`;
          duplicated.push({
            ...s,
            id: dupId,
            name: `${s.name} (Copy)`,
            amountSpent: 0,
            reach: 0,
            tickets: 0,
            purchases: 0,
            conversionValue: 0,
            roas: 0
          });
          setAdSetToggles((prev) => ({ ...prev, [dupId]: true }));
        }
      });
      setAdSetsList((prev) => [...duplicated, ...prev]);
    } else if (activeTab === "ads") {
      const duplicated: AdItem[] = [];
      adsList.forEach((a) => {
        if (selectedIds.has(a.id)) {
          const dupId = `${a.id}_copy_${Date.now()}`;
          duplicated.push({
            ...a,
            id: dupId,
            name: `${a.name} (Copy)`,
            amountSpent: 0,
            landingPageViews: 0,
            tickets: 0,
            costPerTicket: 0
          });
          setAdToggles((prev) => ({ ...prev, [dupId]: true }));
        }
      });
      setAdsList((prev) => [...duplicated, ...prev]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (activeTab === "campaigns") {
      setCampaignsList((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    } else if (activeTab === "ad_sets") {
      setAdSetsList((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    } else if (activeTab === "ads") {
      setAdsList((prev) => prev.filter((a) => !selectedIds.has(a.id)));
    }
    setSelectedIds(new Set());
  };

  const handleSaveInlineBudget = (campaignId: string) => {
    const num = parseFloat(inlineBudgetValue);
    if (!isNaN(num) && num > 0) {
      setCampaignsList((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, budgetMinor: Math.round(num * 100) } : c))
      );
    }
    setInlineEditingId(null);
  };

  const handleExportCSV = () => {
    let rows: string[][] = [];
    if (activeTab === "campaigns") {
      rows = [
        ["ID", "Name", "Budget", "Amount Spent", "Reach", "Tickets", "Purchases", "ROAS"],
        ...filteredCampaigns.map((c) => [
          c.id,
          c.name,
          (c.budgetMinor / 100).toFixed(2),
          c.amountSpent.toString(),
          c.reach.toString(),
          c.tickets.toString(),
          c.coursePurchases.toString(),
          c.roas.toString()
        ])
      ];
    } else if (activeTab === "ad_sets") {
      rows = [
        ["ID", "Name", "Amount Spent", "Reach", "Tickets", "Purchases", "ROAS"],
        ...filteredAdSets.map((s) => [
          s.id,
          s.name,
          s.amountSpent.toString(),
          s.reach.toString(),
          s.tickets.toString(),
          s.purchases.toString(),
          s.roas.toString()
        ])
      ];
    } else {
      rows = [
        ["ID", "Name", "Format", "Amount Spent", "Landing Page Views", "Tickets"],
        ...filteredAds.map((a) => [
          a.id,
          a.name,
          a.format,
          a.amountSpent.toString(),
          a.landingPageViews.toString(),
          a.tickets.toString()
        ])
      ];
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `meta_ads_${activeTab}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIndicator = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-400 inline ml-1 opacity-0 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-[#0064e0] inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#0064e0] inline ml-1" />
    );
  };

  return (
    <div
      className="flex h-screen text-[#1c2b33] antialiased overflow-hidden select-none"
      style={{
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        background: "linear-gradient(100deg, #f6f2fb 0%, #efedf8 40%, #e9eef8 72%, #e6f2ee 100%)",
      }}
    >
      {/* Left rail: Meta logo on top, then the Ads Manager tools (full height, white) */}
      <aside className="w-[48px] bg-white border-r border-[#dde4ee] flex flex-col items-center flex-shrink-0 z-20 tracking-[-0.2px]">
        <div className="h-[46px] flex items-center justify-center" title="Meta">
          <svg className="w-[24px] h-[24px] fill-[#0064e0]" viewBox="0 0 24 24">
            <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
          </svg>
        </div>

        <button
          onClick={() => {
            setShowPolicyModal(true);
            setPolicyStep("review");
          }}
          className="relative mt-[14px] w-[34px] h-[34px] flex items-center justify-center text-[#1c2b33] rounded-[6px] hover:bg-[#f2f4f7] cursor-pointer"
          title="1 Unread Notice: Non-discrimination Policy Review"
        >
          <Bell className="w-[20px] h-[20px] stroke-[1.75]" />
          <span className="absolute top-[-1px] right-[1px] bg-[#c8102e] text-white text-[9px] font-bold w-[15px] h-[15px] rounded-full flex items-center justify-center leading-none">
            1
          </span>
        </button>

        <div className="w-[24px] h-px bg-[#dadde1] mt-[15px] mb-[11px]" />

        {[
          { icon: Gauge, title: "Account overview" },
          { icon: Table2, title: "Campaigns", active: true },
          { icon: Files, title: "Reports" },
          { icon: Users, title: "Audiences" },
          { icon: Megaphone, title: "Advertising settings" },
          { icon: CreditCard, title: "Billing & Payments" },
          { icon: Workflow, title: "Events Manager" },
          { icon: Menu, title: "All tools" },
        ].map(({ icon: Icon, title, active }) => (
          <button
            key={title}
            title={title}
            className={`w-[34px] h-[34px] my-px flex items-center justify-center rounded-[6px] cursor-pointer transition-colors ${
              active ? "bg-[#dfeefc] text-[#0a66c2]" : "text-[#1c2b33] hover:bg-[#f2f4f7]"
            }`}
          >
            <Icon className="w-[20px] h-[20px] stroke-[1.75]" />
          </button>
        ))}

        <div className="mt-auto flex flex-col items-center pb-[7px]">
          <div className="w-[24px] h-px bg-[#dadde1] mb-[8px]" />
          {[
            { icon: HelpCircle, title: "Help" },
            { icon: Settings, title: "Settings" },
            { icon: Search, title: "Search" },
            { icon: Bug, title: "Report a problem" },
          ].map(({ icon: Icon, title }) => (
            <button key={title} title={title} className="w-[34px] h-[30px] flex items-center justify-center text-[#1c2b33] rounded-[6px] hover:bg-[#f2f4f7] cursor-pointer">
              <Icon className="w-[18px] h-[18px] stroke-[1.75]" />
            </button>
          ))}
        </div>
      </aside>

      {/* Middle column: header on the page gradient, then the content panel */}
      <div className="flex-1 flex flex-col min-w-0 tracking-[-0.2px]">
      <header className="h-[48px] pl-[10px] pr-[7px] flex items-center justify-between gap-3 flex-shrink-0 relative z-30">
        <div className="flex items-center min-w-0">
          <h1 className="text-[15px] font-bold text-[#1c2b33] flex-shrink-0">Campaigns</h1>

          {/* Account selector */}
          <div className="relative ml-[12px] min-w-0">
            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="w-[253px] max-w-full h-[32px] flex items-center bg-white border border-[#cbd2d9] rounded-[6px] pl-[8px] pr-[10px] hover:bg-[#f7f8fa] cursor-pointer text-[12px] text-[#1c2b33]"
            >
              <span className="w-[26px] h-[26px] rounded-[4px] bg-[#e4e6eb] flex items-center justify-center flex-shrink-0">
                <User className="w-[15px] h-[15px] text-[#8a8d91] fill-[#8a8d91]" />
              </span>
              <span className="w-px h-[18px] bg-[#dadde1] mx-[9px] flex-shrink-0" />
              <svg className="w-[13px] h-[13px] flex-shrink-0 mr-[8px]" viewBox="0 0 14 14" aria-hidden="true">
                <rect x="1" y="2" width="12" height="10" rx="2" fill="#1c2b33" />
                <rect x="3.5" y="5" width="3" height="4" rx="0.6" fill="#fff" />
                <rect x="7.5" y="5.6" width="3" height="1" rx="0.5" fill="#fff" />
                <rect x="7.5" y="7.4" width="2" height="1" rx="0.5" fill="#fff" />
              </svg>
              <span className="flex-1 min-w-0 truncate text-left">{selectedAccount}</span>
              <Caret className="w-[10px] h-[10px] ml-[6px] flex-shrink-0" />
            </button>

            {showAccountDropdown && (
              <div className="absolute top-[36px] left-0 w-64 bg-white border border-[#ccd0d5] rounded-[6px] shadow-lg z-50 py-1 text-xs">
                <div className="px-3 py-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                  Switch Ad Account
                </div>
                {[
                  "1713375799903103 (1713...)",
                  "Nike UK Performance (9876543210987...)",
                  "Qynto (1234567890123...)",
                  "Normal Demo Test Account"
                ].map((acc) => (
                  <button
                    key={acc}
                    onClick={() => {
                      setSelectedAccount(acc);
                      setShowAccountDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between font-medium text-[#1c1e21]"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-2.5 h-2.5 text-zinc-600" />
                      <span>{acc}</span>
                    </div>
                    {selectedAccount === acc && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Opportunity score */}
          <div className="relative ml-[17px] flex-shrink-0 hidden lg:block">
            <button
              onClick={() => setShowScoreDropdown(!showScoreDropdown)}
              className="flex items-center h-[32px] rounded-[6px] cursor-pointer text-[12px] font-medium text-[#1c2b33] hover:bg-white/60 pr-1"
            >
              <OpportunityGauge score={100} />
              <span className="ml-[8px]">Opportunity score</span>
              <Caret className="w-[10px] h-[10px] ml-[9px]" />
            </button>

            {showScoreDropdown && (
              <div className="absolute top-[36px] left-0 w-80 bg-white border border-[#ccd0d5] rounded-lg shadow-xl z-50 p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#1c1e21]">Opportunity Score: 100/100</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Optimal</span>
                </div>
                <p className="text-[#65676b]">
                  Your account performance is well-optimized. Policy compliance verified.
                </p>
                <button
                  onClick={() => {
                    setShowScoreDropdown(false);
                    setShowPolicyModal(true);
                    setPolicyStep("review");
                  }}
                  className="w-full bg-[#f0f2f5] hover:bg-[#e4e6eb] font-semibold py-1.5 rounded text-center text-zinc-700 cursor-pointer"
                >
                  Review Non-discrimination Policy
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center text-[12px] flex-shrink-0">
          <span className="text-[#1c2b33] hidden xl:inline">Updated just now</span>
          <button
            onClick={fetchCampaigns}
            disabled={isRefreshing}
            className="ml-[14px] w-[34px] h-[30px] flex items-center justify-center bg-white border border-[#cbd2d9] rounded-[6px] text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer"
            title="Refresh campaigns"
          >
            <RefreshCw className={`w-[16px] h-[16px] stroke-[1.75] ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            disabled
            className="ml-[7px] h-[30px] px-[13px] bg-[#f5f6f8] text-[#bcc0c4] border border-[#e1e4e8] font-semibold text-[12px] rounded-[6px] cursor-not-allowed"
          >
            Review and publish
          </button>

          <button
            onClick={() => setShowAuditDrawer(!showAuditDrawer)}
            className="ml-[8px] w-[34px] h-[30px] flex items-center justify-center bg-white border border-[#cbd2d9] rounded-[6px] text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer"
            title="More Options / Audit Log"
          >
            <MoreHorizontal className="w-[16px] h-[16px]" />
          </button>

          {/* Profile: generic person avatar with the Facebook badge */}
          <div className="relative ml-[7px]">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="relative w-[30px] h-[30px] rounded-full bg-[#e4e6eb] flex items-center justify-center cursor-pointer"
              title="Account profile"
              aria-label="Account profile"
            >
              <User className="w-[18px] h-[18px] text-[#8a8d91] fill-[#8a8d91]" />
              <span className="absolute -bottom-[1px] -right-[2px] w-[12px] h-[12px] rounded-full bg-[#0866ff] border border-white flex items-center justify-center text-white text-[8px] font-bold leading-none">
                f
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Content panel */}
      <div className="flex-1 flex flex-col min-h-0 ml-[6px] mr-[6px] mb-[6px] bg-[#f3f4f8] rounded-[8px] overflow-hidden">
        {/* Filter presets */}
        <div className="h-[43px] pt-[8px] px-[7px] flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-[7px]">
            {[
              { label: "All ads", icon: null, active: true },
              { label: "Actions", icon: CircleArrowUp },
              { label: "Active ads", icon: Navigation },
              { label: "Had delivery", icon: MailOpen },
            ].map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                className={`h-[35px] px-[11px] flex items-center gap-[8px] rounded-[6px] border text-[12px] font-semibold cursor-pointer ${
                  active ? "bg-white border-[#7ea8dd] text-[#0a66c2]" : "bg-white border-[#cbd2d9] text-[#1c2b33] hover:bg-[#f7f8fa]"
                }`}
              >
                {Icon ? <Icon className="w-[16px] h-[16px] stroke-[1.75]" /> : <Folder className="w-[16px] h-[16px] fill-[#0a66c2] text-[#0a66c2]" />}
                <span>{label}</span>
              </button>
            ))}
            <button className="h-[35px] ml-[11px] flex items-center gap-[7px] text-[12px] font-semibold text-[#1c2b33] cursor-pointer hover:underline">
              <Plus className="w-[16px] h-[16px] stroke-[1.75]" />
              <span>See more</span>
            </button>
          </div>

          <div className="flex items-center gap-[4px]">
            <button
              onClick={() => setViewEmptyState(!viewEmptyState)}
              className="h-[35px] px-[12px] bg-white border border-[#cbd2d9] rounded-[6px] text-[12px] font-semibold text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer"
              title="Toggle view mode"
            >
              Create a view
            </button>
            <button
              onClick={() => setViewEmptyState(!viewEmptyState)}
              className="w-[34px] h-[35px] flex items-center justify-center bg-white border border-[#cbd2d9] rounded-[6px] text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer"
              title="Toggle view"
            >
              <Settings2 className="w-[16px] h-[16px] stroke-[1.75]" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-[7px] mt-[7px] flex-shrink-0">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Describe what you're looking for"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[31px] bg-white text-[12px] text-[#1c2b33] rounded-[6px] pl-[35px] pr-8 border border-transparent focus:border-[#0a66c2] outline-none placeholder:text-[#65676b]"
            />
            <AISearchIcon className="w-[15px] h-[15px] text-[#1c2b33] absolute left-[11px] top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs + date range */}
        <div className="h-[36px] mt-[8px] px-[7px] flex items-start justify-between flex-shrink-0">
          <div className="flex items-end h-full gap-[7px]">
            {([
              { id: "campaigns", label: "Campaigns" },
              { id: "ad_sets", label: "Ad sets" },
              { id: "ads", label: "Ads" },
            ] as const).map(({ id, label }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setActiveTab(id);
                    setSelectedIds(new Set());
                  }}
                  className={`w-[169px] h-[36px] pl-[11px] flex items-center gap-[7px] rounded-t-[8px] text-[13.5px] font-bold cursor-pointer transition-colors ${
                    active ? "bg-white text-[#0a66c2]" : "bg-[#eceef2] text-[#1c2b33] hover:bg-[#e6e9ee]"
                  }`}
                >
                  {id === "campaigns" ? (
                    <CampaignFolderIcon />
                  ) : id === "ad_sets" ? (
                    <LayoutGrid className="w-[18px] h-[18px] stroke-[1.75]" />
                  ) : (
                    <PanelTop className="w-[18px] h-[18px] stroke-[1.75]" />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="h-[29px] min-w-[284px] px-[10px] flex items-center gap-[7px] whitespace-nowrap text-[12px] font-medium text-[#1c2b33] border border-[#cbd2d9] rounded-[6px] hover:bg-white cursor-pointer"
            >
              <Calendar className="w-[15px] h-[15px] stroke-[1.75]" />
              <span className="flex-1 text-left truncate">{selectedDateRange}</span>
              <Caret className="w-[10px] h-[10px]" />
            </button>

            {showDateDropdown && (
              <div className="absolute right-0 top-8 w-64 bg-white border border-[#ccd0d5] rounded shadow-lg z-50 py-1 text-xs">
                {[
                  "Last 30 days: 24 Sep 2026 - 23 Oct 2026",
                  "Today",
                  "Yesterday",
                  "Last 7 days",
                  "Last 14 days",
                  "Maximum: 14 Sep 2023 - 14 Oct 2026"
                ].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDateRange(d);
                      setShowDateDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between font-medium text-[#1c1e21]"
                  >
                    <span>{d}</span>
                    {selectedDateRange === d && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action toolbar (white strip joined to the active tab) */}
        <div className="h-[44px] px-[7px] bg-white flex items-center justify-between gap-[7px] text-[12px] whitespace-nowrap flex-shrink-0">
          <div className="flex items-center gap-[7px] flex-shrink-0">
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-[30px] w-[80px] bg-[#00704d] hover:bg-[#005f41] text-white font-semibold rounded-[6px] flex items-center justify-center gap-[7px] transition-colors cursor-pointer"
            >
              <Plus className="w-[16px] h-[16px] stroke-[2]" />
              <span>Create</span>
            </button>

            <button
              onClick={handleDuplicateSelected}
              disabled={selectedIds.size === 0}
              className="h-[30px] px-[10px] flex items-center gap-[7px] rounded-[6px] border border-[#e1e4e8] bg-white font-semibold text-[#1c2b33] disabled:text-[#bcc0c4] enabled:hover:bg-[#f7f8fa] enabled:border-[#cbd2d9] cursor-pointer disabled:cursor-default"
              title="Duplicate selected rows"
            >
              <Copy className="w-[15px] h-[15px] stroke-[1.75]" />
              <span>Duplicate{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}</span>
            </button>

            <button
              onClick={() => {
                if (selectedIds.size > 0 && activeTab === "campaigns") {
                  const targetId = Array.from(selectedIds)[0];
                  const target = campaignsList.find((c) => c.id === targetId);
                  if (target) {
                    setInlineEditingId(target.id);
                    setInlineBudgetValue((target.budgetMinor / 100).toFixed(2));
                  }
                } else {
                  setShowEditModal(true);
                }
              }}
              disabled={selectedIds.size === 0}
              className={`h-[30px] px-[10px] flex items-center gap-[7px] rounded-[6px] border bg-white font-semibold ${
                selectedIds.size > 0 ? "border-[#cbd2d9] text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer" : "border-[#e1e4e8] text-[#bcc0c4] cursor-default"
              }`}
              title="Edit"
            >
              <Pencil className="w-[15px] h-[15px] stroke-[1.75]" />
              <span>Edit</span>
            </button>

            <span className="w-px h-[22px] bg-[#dadde1] mx-[1px]" />

            <button
              onClick={tick}
              className="h-[30px] px-[10px] flex items-center gap-[7px] rounded-[6px] border border-[#cbd2d9] bg-white font-semibold text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer"
              title="Run AI Optimisation Analysis"
            >
              <AnalysePetals />
              <span>Analyse</span>
            </button>

            <button
              onClick={() => alert("A/B test workflow initialized.")}
              className="h-[30px] px-[10px] flex items-center gap-[7px] rounded-[6px] border border-[#cbd2d9] bg-white font-semibold text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer"
              title="A/B Test"
            >
              <FlaskConical className="w-[15px] h-[15px] stroke-[1.75]" />
              <span>A/B test</span>
            </button>

            <button className="h-[30px] px-[7px] ml-[7px] flex items-center gap-[9px] font-semibold text-[#1c2b33] rounded-[6px] hover:bg-[#f2f4f7] cursor-pointer">
              <span>More</span>
              <Caret className="w-[10px] h-[10px]" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-[7px] min-w-0 overflow-hidden">
            {[
              { label: "Columns", icon: Columns3 },
              { label: "Breakdown", icon: AlignLeft },
              { label: "Groups", icon: Layers },
            ].map(({ label, icon: Icon }) => (
              <button key={label} className={`h-[30px] pl-[10px] pr-[11px] ${label === "Columns" ? "hidden xl:flex" : "flex"} items-center gap-[7px] rounded-[6px] border border-[#cbd2d9] bg-white font-semibold text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer`}>
                <Icon className="w-[15px] h-[15px] stroke-[1.75]" />
                <span>{label}</span>
                <Caret className="w-[10px] h-[10px] ml-[5px]" />
              </button>
            ))}

            <button className="h-[30px] w-[54px] hidden xl:flex items-center justify-center gap-[9px] rounded-[6px] border border-[#cbd2d9] bg-white text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer" title="Reports">
              <ScrollText className="w-[15px] h-[15px] stroke-[1.75]" />
              <Caret className="w-[10px] h-[10px]" />
            </button>

            <div className="h-[30px] flex rounded-[6px] border border-[#cbd2d9] bg-white text-[#1c2b33] overflow-hidden">
              <button onClick={handleExportCSV} className="w-[33px] flex items-center justify-center hover:bg-[#f7f8fa] cursor-pointer" title="Export Report to CSV">
                <Download className="w-[15px] h-[15px] stroke-[1.75]" />
              </button>
              <span className="w-px bg-[#e1e4e8]" />
              <button className="w-[32px] flex items-center justify-center hover:bg-[#f7f8fa] cursor-pointer" title="Export options">
                <Caret className="w-[10px] h-[10px]" />
              </button>
            </div>

            <button className="w-[34px] h-[30px] flex items-center justify-center rounded-[6px] border border-[#cbd2d9] bg-white text-[#1c2b33] hover:bg-[#f7f8fa] cursor-pointer" title="View charts">
              <SquareActivity className="w-[15px] h-[15px] stroke-[1.75]" />
            </button>
          </div>
        </div>

        {/* Audited Changes Log Drawer */}
        {showAuditDrawer && (
          <div className="bg-[#1c2b36] text-white p-4 border-b border-zinc-800 text-xs space-y-2 max-h-48 overflow-y-auto">
            <div className="flex justify-between items-center font-bold text-zinc-300">
              <span>Normal Operations Audit History</span>
              <button onClick={() => setShowAuditDrawer(false)} className="text-zinc-400 hover:text-white">
                ✕ Close
              </button>
            </div>
            {data.events.length === 0 ? (
              <p className="text-zinc-400">No agent actions recorded yet.</p>
            ) : (
              data.events.map((e) => (
                <div key={e.eventId} className="bg-zinc-800/90 p-2.5 rounded border border-zinc-700 flex justify-between items-center font-mono">
                  <div>
                    <span className="text-emerald-400 font-bold">{agentDisplayName("marketing")}</span>
                    <span className="text-zinc-400"> · {new Date(e.occurredAt).toLocaleString("en-GB")}</span>
                    <p className="text-zinc-200 mt-0.5">
                      Budget modified: {money(Number(e.payload.previousBudgetMinor), "GBP")} → {money(Number(e.payload.newBudgetMinor), "GBP")}/day
                    </p>
                  </div>
                  <span className="text-[11px] text-zinc-400">{String(e.payload.planId)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. The Performance Data Table (100% Functional Sorting & Interaction) */}
        <div className="flex-1 overflow-auto bg-[#e9eaec]">
          {error && (
            <div className="m-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
              {error}
            </div>
          )}

          {/* TAB 1: CAMPAIGNS */}
          {activeTab === "campaigns" && (
            <table className="w-full text-left text-[12px] border-collapse table-fixed">
              <thead className="bg-white sticky top-0 z-20 border-y border-[#dcdddf] text-[12px] font-semibold text-[#1c2b33]">
                <tr className="h-[40px]">
                  <th className="w-[40px] border-r border-[#e4e6eb] text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredCampaigns.length && filteredCampaigns.length > 0}
                      onChange={() => {
                        if (selectedIds.size === filteredCampaigns.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(filteredCampaigns.map((c) => c.id)));
                      }}
                      className="w-[20px] h-[20px] align-middle rounded-[4px] accent-[#0a66c2] cursor-pointer"
                    />
                  </th>
                  {[
                    { label: "Off/On", width: "w-[80px]", sort: "status" },
                    { label: "Campaign", width: "w-[291px]", sort: "name", caret: true },
                    { label: "Delivery", width: "w-[135px]", sort: "delivery", caret: true, active: true },
                    { label: "Actions", width: "w-[169px]", caret: true },
                    { label: "Attribution setting", width: "w-[102px]", caret: true, wrap: true },
                    { label: "Results", width: "w-[124px]", sort: "conversions", caret: true },
                    { label: "Cost per result", width: "w-[145px]", sort: "costPerResult", caret: true },
                    { label: "Budget", width: "", sort: "budgetMinor" },
                  ].map(({ label, width, sort, caret, active, wrap }) => (
                    <th
                      key={label}
                      onClick={sort ? () => handleSort(sort) : undefined}
                      className={`${width} pl-[9px] pr-[8px] border-r border-[#e4e6eb] last:border-r-0 font-semibold ${sort ? "cursor-pointer hover:bg-[#f7f8fa]" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <span className={`flex items-center min-w-0 ${active ? "text-[#0a66c2]" : ""}`}>
                          <span className={wrap ? "leading-[15px] whitespace-normal" : "truncate"}>{label}</span>
                          {active ? (
                            <ArrowDown className="w-[14px] h-[14px] ml-[5px] flex-shrink-0 stroke-[2]" />
                          ) : sort ? (
                            <ArrowUpDown className="w-[14px] h-[14px] ml-[4px] flex-shrink-0 stroke-[1.75]" />
                          ) : null}
                        </span>
                        {caret && <Caret className="w-[9px] h-[9px] flex-shrink-0 text-[#1c2b33]" />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#dadde1]">
                {viewEmptyState ? (
                  <tr>
                    <td colSpan={9} className="pt-[51px] pb-16 text-center bg-[#e9eaec] border-none align-top">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-[38px] h-[38px] rounded-full bg-[#8d95a0] text-white flex items-center justify-center">
                          <Plus className="w-[22px] h-[22px] stroke-[3]" />
                        </div>
                        <h3 className="mt-[15px] font-bold text-[13.5px] leading-[18px] text-[#1c2b33]">No results found</h3>
                        <p className="mt-[3px] text-[11.75px] leading-[16px] text-[#65676b]">You haven&apos;t created any ads yet.</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="mt-[11px] h-[30px] px-[12px] border border-[#bcc0c4] bg-[#eceef0] hover:bg-[#e2e4e8] text-[#1c2b33] font-semibold text-[12px] rounded-[6px] transition-colors cursor-pointer"
                        >
                          Create ad
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map((camp) => {
                    const isChecked = selectedIds.has(camp.id);
                    const isToggleOn = campaignToggles[camp.id] ?? true;
                    const isInlineEditing = inlineEditingId === camp.id;

                    return (
                      <tr
                        key={camp.id}
                        className={`hover:bg-[#f2f4f8] transition-colors group ${
                          isChecked ? "bg-blue-50/50" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-2 py-2 text-center border-r border-[#e4e6eb]">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRow(camp.id)}
                            className="rounded accent-[#0064e0] cursor-pointer scale-90"
                          />
                        </td>

                        {/* On/Off Toggle */}
                        <td className="px-2 py-2 border-r border-[#e4e6eb]">
                          <button
                            onClick={() =>
                              setCampaignToggles((prev) => ({ ...prev, [camp.id]: !isToggleOn }))
                            }
                            className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                              isToggleOn ? "bg-[#0064e0]" : "bg-[#8a8d91]"
                            }`}
                          >
                            <div
                              className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${
                                isToggleOn ? "translate-x-3.5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>

                        {/* Campaign Name */}
                        <td className="px-2 py-2 border-r border-[#e4e6eb] font-medium text-[#1c1e21]">
                          <span
                            onClick={() => {
                              setSelectedCampaignDrill(camp.id);
                              setActiveTab("ad_sets");
                            }}
                            className="hover:underline cursor-pointer font-semibold block text-[12px]"
                          >
                            {camp.name}
                          </span>
                          <span className="text-[11px] text-[#65676b] block">{camp.subtitle}</span>
                        </td>

                        {/* Delivery */}
                        <td className="px-2 py-2 border-r border-[#e4e6eb] text-[#0064e0] font-medium text-[12px]">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isToggleOn ? "bg-emerald-500" : "bg-zinc-400"}`} />
                            <span>{isToggleOn ? "Active" : "Off"}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-2 border-r border-[#e4e6eb] text-[12px] text-[#65676b]">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setInlineEditingId(camp.id);
                                setInlineBudgetValue((camp.budgetMinor / 100).toFixed(2));
                              }}
                              className="text-[#0064e0] hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <span>·</span>
                            <button
                              onClick={handleDuplicateSelected}
                              className="text-[#0064e0] hover:underline cursor-pointer"
                            >
                              Duplicate
                            </button>
                          </div>
                        </td>

                        {/* Attribution setting */}
                        <td className="px-2 py-2 border-r border-[#e4e6eb] text-[11px] text-[#65676b]">
                          <span>7-day click or 1-day view</span>
                        </td>

                        {/* Results */}
                        <td className="px-2 py-2 text-right border-r border-[#e4e6eb] font-semibold text-[#1c1e21]">
                          {camp.coursePurchases > 0 ? camp.coursePurchases : "—"}
                        </td>

                        {/* Cost per result */}
                        <td className="px-2 py-2 text-right border-r border-[#e4e6eb] text-[#1c1e21]">
                          {camp.costPerCoursePurchase > 0 ? `£${(camp.costPerCoursePurchase / 100).toFixed(2)}` : "—"}
                        </td>

                        {/* Budget */}
                        <td className="px-2 py-2 text-right font-medium text-[#1c1e21]">
                          {isInlineEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <span>£</span>
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={inlineBudgetValue}
                                onChange={(e) => setInlineBudgetValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveInlineBudget(camp.id);
                                  if (e.key === "Escape") setInlineEditingId(null);
                                }}
                                className="w-16 border border-blue-600 rounded px-1 text-right text-xs"
                              />
                              <button
                                onClick={() => handleSaveInlineBudget(camp.id)}
                                className="p-0.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={() => {
                                setInlineEditingId(camp.id);
                                setInlineBudgetValue((camp.budgetMinor / 100).toFixed(2));
                              }}
                              className="cursor-pointer hover:underline text-[#0064e0] font-semibold"
                            >
                              {money(camp.budgetMinor, "GBP")} / day
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Dynamic Summary / Totals Row */}
              {!viewEmptyState && showResultsBar && (
                <tfoot className="bg-white border-t-2 border-[#dadde1] sticky bottom-0 z-10 text-[13px] font-semibold text-[#1c1e21]">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 border-r border-[#dadde1]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1 text-[#1c1e21] font-bold">
                          <span>Results from {filteredCampaigns.length} campaigns</span>
                          <Info className="w-3.5 h-3.5 text-zinc-500" />
                        </div>
                        <div
                          onClick={() => setShowResultsBar(false)}
                          className="flex items-center gap-1 text-[11px] text-[#0064e0] cursor-pointer hover:underline mt-0.5"
                        >
                          <EyeOff className="w-3 h-3" />
                          <span>Hide results</span>
                        </div>
                      </div>
                    </td>

                    {/* Amount spent total */}
                    <td className="px-4 py-3 text-right border-r border-[#dadde1]">
                      <div className="flex flex-col items-end">
                        <span className="font-bold">₹{campaignTotals.totalSpent.toLocaleString()}</span>
                        <span className="text-[11px] text-[#65676b] font-normal">Total Spent</span>
                      </div>
                    </td>

                    {/* Reach total */}
                    <td className="px-4 py-3 text-right border-r border-[#dadde1]">
                      <div className="flex flex-col items-end">
                        <span className="font-bold underline decoration-dotted">
                          {campaignTotals.totalReach.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-[#65676b] font-normal">Meta accounts</span>
                      </div>
                    </td>

                    {/* Tickets total */}
                    <td className="px-4 py-3 text-right border-r border-[#dadde1]">
                      <div className="flex flex-col items-end">
                        <span className="font-bold">{campaignTotals.totalTickets}</span>
                        <span className="text-[11px] text-[#65676b] font-normal">Total</span>
                      </div>
                    </td>

                    {/* Cost per ticket total */}
                    <td className="px-4 py-3 text-right border-r border-[#dadde1]">
                      <div className="flex flex-col items-end">
                        <span className="font-bold">₹{campaignTotals.costPerTicket}</span>
                        <span className="text-[11px] text-[#65676b] font-normal">Per Action</span>
                      </div>
                    </td>

                    {/* ROAS average */}
                    <td className="px-4 py-3 text-right border-r border-[#dadde1]">
                      <div className="flex flex-col items-end">
                        <span className="font-bold">{campaignTotals.avgRoas.toFixed(2)}</span>
                        <span className="text-[11px] text-[#65676b] font-normal">Average ROAS</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {/* TAB 2: AD SETS */}
          {activeTab === "ad_sets" && (
            <table className="w-full text-left text-[13px] border-collapse">
              <thead className="bg-[#f0f2f5] text-[#65676b] font-normal sticky top-0 z-20 border-b border-[#dadde1]">
                <tr>
                  <th className="w-10 px-3 py-2 text-center border-r border-[#dadde1]">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredAdSets.length && filteredAdSets.length > 0}
                      onChange={() => {
                        if (selectedIds.size === filteredAdSets.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(filteredAdSets.map((s) => s.id)));
                      }}
                      className="rounded accent-[#0064e0]"
                    />
                  </th>
                  <th className="w-16 px-3 py-2 border-r border-[#dadde1] font-semibold text-[#1c1e21]">
                    Off/On
                  </th>
                  <th
                    onClick={() => handleSort("name")}
                    className="min-w-[260px] px-4 py-2 border-r border-[#dadde1] font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Ad set {renderSortIndicator("name")}
                  </th>
                  <th
                    onClick={() => handleSort("amountSpent")}
                    className="w-32 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Amount spent {renderSortIndicator("amountSpent")}
                  </th>
                  <th
                    onClick={() => handleSort("reach")}
                    className="w-24 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Reach {renderSortIndicator("reach")}
                  </th>
                  <th
                    onClick={() => handleSort("tickets")}
                    className="w-32 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Masterclass tickets {renderSortIndicator("tickets")}
                  </th>
                  <th
                    onClick={() => handleSort("costPerTicket")}
                    className="w-28 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Cost per ticket {renderSortIndicator("costPerTicket")}
                  </th>
                  <th
                    onClick={() => handleSort("purchases")}
                    className="w-32 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Course purchases {renderSortIndicator("purchases")}
                  </th>
                  <th
                    onClick={() => handleSort("costPerPurchase")}
                    className="w-36 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Cost per course purc... {renderSortIndicator("costPerPurchase")}
                  </th>
                  <th
                    onClick={() => handleSort("conversionValue")}
                    className="w-36 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Purchases conversion v... {renderSortIndicator("conversionValue")}
                  </th>
                  <th
                    onClick={() => handleSort("roas")}
                    className="w-28 px-4 py-2 text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Purchase ROAS {renderSortIndicator("roas")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadde1]">
                {filteredAdSets.map((set) => {
                  const isChecked = selectedIds.has(set.id);
                  const isToggleOn = adSetToggles[set.id] ?? true;
                  return (
                    <tr
                      key={set.id}
                      className={`hover:bg-[#f2f4f8] transition-colors ${isChecked ? "bg-blue-50/50" : ""}`}
                    >
                      <td className="px-3 py-3 text-center border-r border-[#dadde1]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(set.id)}
                          className="rounded accent-[#0064e0]"
                        />
                      </td>
                      <td className="px-3 py-3 border-r border-[#dadde1]">
                        <button
                          onClick={() => setAdSetToggles((prev) => ({ ...prev, [set.id]: !isToggleOn }))}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            isToggleOn ? "bg-[#0064e0]" : "bg-[#8a8d91]"
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              isToggleOn ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1]">
                        <button
                          onClick={() => {
                            setSelectedAdSetDrill(set.id);
                            setActiveTab("ads");
                          }}
                          className="text-left text-[#0064e0] font-medium hover:underline cursor-pointer"
                        >
                          {set.name}
                        </button>
                        <div className="text-[12px] text-[#65676b]">{set.subtitle}</div>
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        ₹{set.amountSpent.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        {set.reach.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        {set.tickets > 0 ? set.tickets : "—"}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        {set.costPerTicket > 0 ? `₹${set.costPerTicket}` : "—"}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        {set.purchases}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        ₹{set.costPerPurchase.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        ₹{set.conversionValue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-[#1c1e21]">
                        {set.roas.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {showResultsBar && (
                <tfoot className="bg-white border-t-2 border-[#dadde1] sticky bottom-0 z-10 text-[13px] font-semibold text-[#1c1e21]">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 border-r border-[#dadde1]">
                      <span className="font-bold">Results from {filteredAdSets.length} ad sets</span>
                    </td>
                    <td className="px-4 py-3 text-right border-r border-[#dadde1] font-bold">
                      ₹{adSetTotals.totalSpent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right border-r border-[#dadde1] font-bold">
                      {adSetTotals.totalReach.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right border-r border-[#dadde1] font-bold">
                      {adSetTotals.totalTickets}
                    </td>
                    <td className="px-4 py-3 text-right border-r border-[#dadde1] font-bold">
                      ₹{adSetTotals.costPerTicket}
                    </td>
                    <td className="px-4 py-3 text-right border-r border-[#dadde1] font-bold">
                      {adSetTotals.totalPurchases}
                    </td>
                    <td className="px-4 py-3 text-right border-r border-[#dadde1] font-bold">
                      ₹{adSetTotals.costPerPurchase.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right border-r border-[#dadde1] font-bold">
                      ₹{adSetTotals.totalConversionVal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {adSetTotals.avgRoas.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {/* TAB 3: ADS */}
          {activeTab === "ads" && (
            <table className="w-full text-left text-[13px] border-collapse">
              <thead className="bg-[#f0f2f5] text-[#65676b] font-normal sticky top-0 z-20 border-b border-[#dadde1]">
                <tr>
                  <th className="w-10 px-3 py-2 text-center border-r border-[#dadde1]">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredAds.length && filteredAds.length > 0}
                      onChange={() => {
                        if (selectedIds.size === filteredAds.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(filteredAds.map((a) => a.id)));
                      }}
                      className="rounded accent-[#0064e0]"
                    />
                  </th>
                  <th className="w-16 px-3 py-2 border-r border-[#dadde1] font-semibold text-[#1c1e21]">
                    Off/On
                  </th>
                  <th
                    onClick={() => handleSort("name")}
                    className="min-w-[280px] px-4 py-2 border-r border-[#dadde1] font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Ad {renderSortIndicator("name")}
                  </th>
                  <th className="w-24 px-3 py-2 border-r border-[#dadde1] font-semibold text-[#1c1e21]">
                    Delivery
                  </th>
                  <th
                    onClick={() => handleSort("amountSpent")}
                    className="w-32 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Amount spent {renderSortIndicator("amountSpent")}
                  </th>
                  <th
                    onClick={() => handleSort("landingPageViews")}
                    className="w-36 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Landing page views {renderSortIndicator("landingPageViews")}
                  </th>
                  <th
                    onClick={() => handleSort("tickets")}
                    className="w-32 px-4 py-2 border-r border-[#dadde1] text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Masterclass tickets {renderSortIndicator("tickets")}
                  </th>
                  <th
                    onClick={() => handleSort("costPerTicket")}
                    className="w-28 px-4 py-2 text-right font-semibold text-[#1c1e21] cursor-pointer hover:bg-zinc-200"
                  >
                    Cost per ticket {renderSortIndicator("costPerTicket")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadde1]">
                {filteredAds.map((ad) => {
                  const isChecked = selectedIds.has(ad.id);
                  const isToggleOn = adToggles[ad.id] ?? true;
                  return (
                    <tr
                      key={ad.id}
                      className={`hover:bg-[#f2f4f8] transition-colors ${isChecked ? "bg-blue-50/50" : ""}`}
                    >
                      <td className="px-3 py-3 text-center border-r border-[#dadde1]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(ad.id)}
                          className="rounded accent-[#0064e0]"
                        />
                      </td>
                      <td className="px-3 py-3 border-r border-[#dadde1]">
                        <button
                          onClick={() => setAdToggles((prev) => ({ ...prev, [ad.id]: !isToggleOn }))}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            isToggleOn ? "bg-[#0064e0]" : "bg-[#8a8d91]"
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              isToggleOn ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-[#2d3748] text-white flex items-center justify-center text-[10px] flex-shrink-0">
                            {ad.format === "video" ? "▶" : ad.format === "carousel" ? "⊞" : "🖼"}
                          </div>
                          <span className="text-[#0064e0] font-medium hover:underline cursor-pointer">
                            {ad.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 border-r border-[#dadde1]">
                        {isToggleOn ? (
                          <span className="inline-flex items-center gap-1.5 text-zinc-800 font-medium text-[12px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-zinc-500 font-medium text-[12px]">
                            <span className="w-2 h-2 rounded-full bg-zinc-400" />
                            <span>Off</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        ₹{ad.amountSpent.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        {ad.landingPageViews.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 border-r border-[#dadde1] text-right text-[#1c1e21]">
                        {ad.tickets > 0 ? ad.tickets : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[#1c1e21]">
                        {ad.costPerTicket > 0 ? `₹${ad.costPerTicket}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. Footer Simulation Bar (Docked inside audit drawer mode to keep 1:1 screen clean) */}
        {showAuditDrawer && (
          <footer className="h-10 border-t border-[#dadde1] bg-[#f0f2f5] px-4 flex items-center justify-between text-[12px] text-[#65676b] flex-shrink-0">
            <div>
              <span>
                Primary Campaign Live Budget:{" "}
                <strong>
                  {money(
                    campaignsList.find((c) => c.id === "campaign_A")?.budgetMinor ?? 5000,
                    "GBP"
                  )}
                  /day
                </strong>
              </span>
              <span className="mx-2">·</span>
              <span>Spend per 15m tick: floor(daily budget ÷ 96)</span>
            </div>

            <button
              disabled={busy}
              onClick={tick}
              className="bg-[#0064e0] hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-3 h-3" />
              <span>{busy ? "Simulating..." : "Run 15-Minute Simulation Tick"}</span>
            </button>
          </footer>
        )}
      </div>
      </div>

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#dadde1] flex justify-between items-center">
              <h3 className="font-bold text-base text-[#1c1e21]">Create Campaign</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1c1e21] mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Air Max Promo 2026"
                  value={formCampaignName}
                  onChange={(e) => setFormCampaignName(e.target.value)}
                  className="w-full border border-[#ccd0d5] rounded p-2 text-sm focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1c1e21] mb-1">Campaign Objective</label>
                <select
                  value={formObjective}
                  onChange={(e) => setFormObjective(e.target.value)}
                  className="w-full border border-[#ccd0d5] rounded p-2 text-sm focus:border-blue-600 outline-none"
                >
                  <option value="Sales">Sales / Conversions</option>
                  <option value="Leads">Lead Generation</option>
                  <option value="Traffic">Landing Page Traffic</option>
                  <option value="Engagement">Social Engagement</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#1c1e21] mb-1">Daily Budget (£ GBP)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formDailyBudget}
                  onChange={(e) => setFormDailyBudget(e.target.value)}
                  className="w-full border border-[#ccd0d5] rounded p-2 text-sm focus:border-blue-600 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-[#ccd0d5] rounded font-semibold text-zinc-700 hover:bg-[#f0f2f5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0064e0] hover:bg-blue-700 text-white rounded font-semibold shadow-sm"
                >
                  Publish Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Right rail: dark dock, full height */}
      <aside className="w-[38px] bg-[#1c2a33] flex flex-col items-center text-[#b0bac0] flex-shrink-0 z-20">
        {[
          { icon: ChartNoAxesColumn, title: "Charts" },
          { icon: Pencil, title: "Edit" },
          { icon: Clock, title: "History" },
        ].map(({ icon: Icon, title }) => (
          <button key={title} title={title} className="w-[38px] h-[37px] flex items-center justify-center hover:text-white transition-colors cursor-pointer">
            <Icon className="w-[16px] h-[16px] stroke-[1.75]" />
          </button>
        ))}
      </aside>

      {/* Floating Meta AI */}
      <div className="fixed bottom-[58px] right-[56px] z-30 cursor-pointer hover:opacity-90 transition-opacity" title="Meta AI Assistant">
        <div className="w-[48px] h-[48px] rounded-full bg-white border border-[#d6d8dc] shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex items-center justify-center overflow-hidden">
          {/* Seven tilted petals in a ring, magenta at the top fading to blue at the bottom */}
          <svg className="w-[28px] h-[28px]" viewBox="0 0 28 28" aria-label="Meta AI">
            {["#c95cf5", "#a64ef5", "#7a52ee", "#4a36e8", "#4b33ee", "#7f45e0", "#c54ff2"].map((color, i) => (
              <ellipse key={color} cx="14" cy="3.6" rx="2.6" ry="3.9" fill={color} transform={`rotate(${(i * 360) / 7} 14 14) rotate(-35 14 3.6)`} />
            ))}
          </svg>
        </div>
      </div>

      {/* 5. Non-discrimination Policy Modal Sequence (1:1 with Screenshots 1 & 2) */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-0">
          {policyStep === "review" ? (
            /* Screenshot 1: Review Non-discrimination Policy Modal (1:1 with Screenshot 1 & 2) */
            <div className="bg-white rounded-lg shadow-2xl w-[592px] h-[min(659px,calc(100vh-16px))] overflow-hidden relative border border-[#ccd0d5] flex flex-col animate-in fade-in zoom-in-95">
              <div className="relative w-full h-[203px] bg-[#d8d3cd] overflow-hidden flex-shrink-0">
                <img
                  src="/meta_policy_banner_clean.png"
                  alt="Meta Non-discrimination Policy"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setShowPolicyModal(false)}
                  className="absolute top-[9px] right-[10px] text-[#606770] hover:text-[#1c1e21] p-0.5 cursor-pointer"
                  title="Close"
                >
                  <X className="w-[15px] h-[15px]" />
                </button>
              </div>

              <div className="px-[17px] pt-[28px] pb-[5px] text-[#1c1e21] flex-1 min-h-0 overflow-y-auto flex flex-col justify-between">
                <div>
                  <h2 className="text-[16.25px] font-bold leading-[21px] text-[#1c1e21]">
                    To help maintain the integrity of Meta advertising, please review and accept our Non-discrimination Policy.
                  </h2>

                  <div className="text-[11.75px] leading-[17px] text-[#1c1e21] space-y-[13px] mt-[29px]">
                    <p>
                      Facebook&apos;s Advertising Policies prohibit advertisers from using our ads products to discriminate against individuals or groups of{" "}
                      <a href="#" className="text-[#0064e0] hover:underline">people</a>.{" "}
                      <strong>Ads are discriminatory when they deny opportunities to individuals or groups.</strong>{" "}
                      It&apos;s against our policies to discriminate based on certain personal characteristics, such as race, ethnicity, national origin, religion, age, sex, sexual orientation, gender identity, family/marital status, disability, medical or genetic condition and all other protected classes identified in federal, state and local fair housing and civil rights laws.
                    </p>

                    <p>
                      Our Non-discrimination Policies haven&apos;t changed, but we&apos;ve added examples about what they mean for advertisers. Although discrimination is prohibited, you may target ads at a specific audience based on known interests that align with the product or service you&apos;re advertising.
                    </p>
                  </div>
                </div>

                {/* Two example cards: borderless, filled circle with a browser-window illustration */}
                <div className="grid grid-cols-2 mt-[20px] pb-[4px]">
                  {[
                    { title: "Acceptable ad targeting", text: "Targeting an ad for a job at a", circle: "#6bcfb8", pane: "#e4fffa", mark: "#349a84", ok: true },
                    { title: "Ad discrimination", text: "Targeting an ad for a job at a clothing", circle: "#f0907e", pane: "#ffe3dd", mark: "#de6f5e", ok: false },
                  ].map(card => (
                    <div key={card.title} className="flex flex-col items-center text-center px-2">
                      <svg className="w-[68px] h-[68px] flex-shrink-0" viewBox="0 0 54 54" aria-hidden="true">
                        <circle cx="27" cy="27" r="27" fill={card.circle} />
                        <rect x="14" y="14.5" width="26" height="24" rx="1" fill="#fff" />
                        <circle cx="17.5" cy="17.8" r="1.2" fill={card.circle} />
                        <rect x="20" y="17.2" width="5" height="1.2" rx="0.6" fill={card.circle} />
                        <rect x="16" y="21" width="22" height="15.5" fill={card.pane} />
                        {card.ok
                          ? <path d="M22.5 28.6l3 3 6-6" fill="none" stroke={card.mark} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          : <>
                              <rect x="26" y="23.6" width="2" height="6.4" rx="1" fill={card.mark} />
                              <circle cx="27" cy="32.6" r="1.15" fill={card.mark} />
                            </>}
                      </svg>
                      <div className="font-bold text-[12.5px] text-[#1c1e21] leading-tight mt-[10px]">{card.title}</div>
                      <div className="text-[11.25px] text-[#65676b] mt-[9px] leading-tight line-clamp-1">{card.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-[44px] flex-shrink-0 border-t border-[#e4e6eb] flex items-center justify-end pr-[14px]">
                <button
                  onClick={() => setPolicyStep("confirmed")}
                  className="w-[62px] h-[24px] bg-[#1877f2] hover:bg-[#166fe5] text-white font-semibold text-[11.25px] rounded-[3px] flex items-center justify-center transition-colors cursor-pointer leading-none"
                >
                  I Accept
                </button>
              </div>
            </div>
          ) : (
            /* Confirmation after "I Accept" */
            <div className="self-start mt-[24.8vh] bg-white rounded-[4px] shadow-2xl w-[507px] overflow-hidden relative text-center animate-in fade-in zoom-in-95">
              <button
                onClick={() => setShowPolicyModal(false)}
                className="absolute top-[10px] right-[10px] text-[#606770] hover:text-[#1c1e21] p-0.5 cursor-pointer"
                title="Close"
              >
                <X className="w-[15px] h-[15px]" />
              </button>

              <div className="pt-[28px] pb-[17px] px-6">
                <div className="flex justify-center">
                  <PolicyBadge />
                </div>
                <h3 className="mt-[27px] text-[12px] leading-[16px] font-semibold tracking-[-0.2px] text-[#1c2b33]">
                  Thanks for accepting our Non-discrimination Policy
                </h3>
                <p className="mt-[8px] text-[11.75px] leading-[16px] tracking-[-0.2px] text-[#1c2b33]">
                  You may be periodically asked to review these policies to maintain compliance.
                </p>
              </div>

              <div className="h-[44px] border-t border-[#e5e5e5] flex items-center justify-end pr-[13px]">
                <button
                  onClick={() => setShowPolicyModal(false)}
                  className="w-[46px] h-[23px] bg-[#1b54a8] hover:bg-[#164a96] text-white font-semibold text-[11.5px] rounded-[3px] cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
