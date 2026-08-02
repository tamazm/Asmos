import { authProtect } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { AdvancedPreviewBar } from "./AdvancedPreviewBar";
import { WidgetInjector } from "./WidgetInjector";

export default async function PreviewPage(props: {
  searchParams: Promise<{ site?: string; variantId?: string }>;
}) {
  await authProtect();
  const resolvedParams = await props.searchParams;
  const site = resolvedParams.site || "example.com";
  const variantId = resolvedParams.variantId;

  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { 
      accountId: account.id,
      status: { notIn: ["DRAFT", "FAILED", "GENERATING"] }
    },
    orderBy: { updatedAt: "desc" },
    include: {
      variants: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializedCampaigns = campaigns.map((campaign: any) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    variants: campaign.variants.map((v: any) => ({
      id: v.id,
      name: v.name,
      isControl: v.isControl,
      isWinner: campaign.winningVariantId === v.id,
      status: v.status,
    })),
  }));

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-gray-900 font-sans">
      <AdvancedPreviewBar campaigns={serializedCampaigns} />
      {/* Fake Header */}
      <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="font-black text-2xl tracking-tighter">Acme Store</div>
        <nav className="space-x-8 text-sm font-semibold text-gray-500 hidden md:block">
          <a href="#" className="hover:text-black">New Arrivals</a>
          <a href="#" className="hover:text-black">Best Sellers</a>
          <a href="#" className="hover:text-black">Clothing</a>
          <a href="#" className="hover:text-black">Accessories</a>
        </nav>
        <div className="flex gap-5 text-gray-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
      </header>

      {/* Fake Hero */}
      <main>
        <div className="bg-[#E5E5E5] h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 text-black">The Summer Collection</h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl">
            Discover our latest arrivals designed to keep you cool and stylish all season long. Designed with premium materials.
          </p>
          <button className="bg-black text-white px-8 py-3.5 rounded-full font-bold hover:bg-gray-800 transition transform hover:scale-105">
            Shop Now
          </button>
        </div>

        {/* Fake Grid */}
        <div className="max-w-6xl mx-auto py-20 px-8">
          <h2 className="text-2xl font-black mb-10 tracking-tight text-center">Trending Now</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-12">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="group cursor-pointer">
                <div className="bg-[#EAEAEA] aspect-[3/4] mb-4 rounded-xl overflow-hidden transition-opacity group-hover:opacity-80" />
                <h3 className="font-bold text-sm text-gray-900 mb-1">Premium Product {i}</h3>
                <p className="text-gray-500 text-sm font-medium">$129.00</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Widget is injected client-side so it re-executes when variantId changes */}
      {site && <WidgetInjector site={site} defaultVariantId={variantId} />}
    </div>
  );
}
