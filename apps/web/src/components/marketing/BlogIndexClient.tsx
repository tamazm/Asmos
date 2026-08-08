"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BlogPost, BlogCategory } from "@/lib/blog/posts";
import { BlogCoverPlaceholder } from "./BlogCoverPlaceholder";

const CATEGORIES: BlogCategory[] = [
  "Conversion Optimization",
  "Popup Optimization",
  "Email Capture",
  "A/B Testing",
  "Shopify",
  "Benchmarks",
  "AI & Automation",
  "Case Studies",
];

export function BlogIndexClient({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<BlogCategory | "All">("All");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      const matchesCategory = activeCategory === "All" || p.category === activeCategory;
      const matchesQuery =
        !query.trim() ||
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.excerpt.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [posts, activeCategory, query]);

  async function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewsletterStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      if (!res.ok) throw new Error();
      setNewsletterStatus("sent");
    } catch {
      setNewsletterStatus("error");
    }
  }

  return (
    <div>
      {/* Search */}
      <div className="mx-auto max-w-md mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles"
          className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-4 py-2.5 text-sm focus:outline-none"
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {(["All", ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
              activeCategory === cat
                ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white"
                : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-[color:var(--color-text-secondary)]">No articles match your search yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden transition-shadow duration-200 hover:shadow-md">
              <BlogCoverPlaceholder category={post.category} />
              <div className="p-5">
                <span className="mb-2.5 inline-block rounded-full bg-[color:var(--color-primary-light)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--color-primary)]">{post.category}</span>
                <h3 className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)] leading-snug group-hover:text-[color:var(--color-primary)] transition-colors duration-200">{post.title}</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed line-clamp-2">{post.excerpt}</p>
                <p className="mt-3 text-[11px] text-[color:var(--color-text-secondary)]">{new Date(post.publishDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {post.readTime}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Newsletter */}
      <div className="mt-16 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-8 text-center max-w-xl mx-auto">
        <h2 className="mb-1.5 text-lg font-bold text-[color:var(--color-text-primary)]">Get conversion insights in your inbox</h2>
        <p className="mb-5 text-xs text-[color:var(--color-text-secondary)]">New experiments, benchmarks, and ecommerce CRO ideas — without the generic marketing advice.</p>
        {newsletterStatus === "sent" ? (
          <p className="text-sm font-medium text-[color:var(--color-text-primary)]">You&apos;re on the list.</p>
        ) : (
          <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row items-center gap-2.5 max-w-sm mx-auto">
            <input
              required
              type="email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Work email"
              className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none bg-[color:var(--color-surface)]"
            />
            <button type="submit" disabled={newsletterStatus === "loading"} className="w-full sm:w-auto shrink-0 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97] disabled:opacity-50">
              {newsletterStatus === "loading" ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        )}
        {newsletterStatus === "error" && <p className="mt-2 text-xs text-red-500">Something went wrong. Please try again.</p>}
      </div>
    </div>
  );
}
