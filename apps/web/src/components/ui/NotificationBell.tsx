"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Notification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(c - 1, 0));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
  }

  async function markAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!loaded) fetchNotifications(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors duration-150 cursor-pointer"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--color-primary)] px-1 text-[10px] font-bold text-white tabular-nums"
            aria-label={`${unreadCount} unread`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg ring-1 ring-black/5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[color:var(--color-primary)] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mb-2 text-[color:var(--color-text-secondary)]" aria-hidden="true">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm text-[color:var(--color-text-secondary)]">All caught up</p>
              </div>
            ) : (
              notifications.map((n) => {
                const unread = !n.readAt;
                const inner = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b border-[color:var(--color-border)] last:border-0 transition-colors duration-100",
                      unread ? "bg-[color:var(--color-primary-light)]" : "bg-[color:var(--color-surface)]",
                      "hover:bg-[color:var(--color-surface-sunken)] cursor-pointer",
                    )}
                    onClick={() => unread && markRead(n.id)}
                  >
                    {unread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--color-primary)]" />
                    )}
                    <div className={cn("flex flex-col gap-0.5 min-w-0", !unread && "pl-5")}>
                      <p className="text-xs font-semibold text-[color:var(--color-text-primary)] truncate">{n.title}</p>
                      <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-[color:var(--color-text-secondary)] tabular-nums">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => { if (unread) markRead(n.id); setOpen(false); }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
