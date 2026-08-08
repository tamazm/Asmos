import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "./site";

/**
 * Build a page-level Metadata object with sane SEO defaults (canonical,
 * Open Graph, Twitter card). Pass `path` as the route beginning with "/".
 */
export function buildMetadata({
  title,
  description,
  path,
  image = "/assets/asmos-logo-primary-lightbg.webp",
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: image.startsWith("http") ? image : `${SITE_URL}${image}` }],
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.startsWith("http") ? image : `${SITE_URL}${image}`],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/assets/asmos-logo-primary-lightbg.webp`,
    description:
      "Asmos is an AI conversion optimization platform for ecommerce that analyzes, generates, tests, learns from, and continuously improves popup experiences.",
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function articleJsonLd({
  title,
  description,
  slug,
  image,
  authorName,
  publishDate,
  updatedDate,
}: {
  title: string;
  description: string;
  slug: string;
  image: string;
  authorName: string;
  publishDate: string;
  updatedDate: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    image: image.startsWith("http") ? image : `${SITE_URL}${image}`,
    author: { "@type": "Person", name: authorName },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/asmos-logo-primary-lightbg.webp` },
    },
    datePublished: publishDate,
    dateModified: updatedDate,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}` },
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
