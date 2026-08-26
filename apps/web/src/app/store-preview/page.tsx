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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F9F9F9] font-sans text-gray-900">
      <AdvancedPreviewBar campaigns={serializedCampaigns} />
      {/* Fake Header */}
      <header className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-4 sm:px-8">
        <div className="min-w-0 text-xl font-black tracking-tighter sm:text-2xl">Acme Store</div>
        <nav className="space-x-8 text-sm font-semibold text-gray-500 hidden md:block">
          <a href="#" className="hover:text-black">New Arrivals</a>
          <a href="#" className="hover:text-black">Best Sellers</a>
          <a href="#" className="hover:text-black">Clothing</a>
          <a href="#" className="hover:text-black">Accessories</a>
        </nav>
        <div className="flex shrink-0 gap-4 text-gray-400 sm:gap-5" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
      </header>

      {/* Fake Hero */}
      <main className="min-w-0">
        <div className="flex min-h-[60dvh] flex-col items-center justify-center bg-[#E5E5E5] px-4 py-12 text-center">
          <h1 className="mb-4 break-words text-4xl font-extrabold tracking-tight text-black sm:text-5xl md:text-6xl">The Summer Collection</h1>
          <p className="mb-8 max-w-xl break-words text-lg text-gray-600 md:text-xl">
            Discover our latest arrivals designed to keep you cool and stylish all season long. Designed with premium materials.
          </p>
          <button className="transform rounded-full bg-black px-8 py-3.5 font-bold text-white transition-[background-color,transform] hover:scale-105 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
            Shop Now
          </button>
        </div>

        {/* Fake Grid */}
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-20">
          <h2 className="text-2xl font-black mb-10 tracking-tight text-center">Trending Now</h2>
          <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="group min-w-0 cursor-pointer">
                <div className="bg-[#EAEAEA] aspect-[3/4] mb-4 rounded-xl overflow-hidden transition-opacity group-hover:opacity-80" />
                <h3 className="mb-1 break-words text-sm font-bold text-gray-900">Premium Product {i}</h3>
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
