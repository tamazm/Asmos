"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type MemberRow = { id: string; email: string; name: string | null; role: string };
type InviteRow = { id: string; email: string; role: string };

export function TeamManagement({
  members,
  invites,
}: {
  members: MemberRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendInvite() {
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not send invite");
      }
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setInviting(false);
    }
  }

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      await fetch(`/api/invites/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <h2 className="text-sm font-medium text-[color:var(--color-text-primary)]">
        Team
      </h2>

      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] px-4 py-3"
          >
            <div>
              <p className="text-sm text-[color:var(--color-text-primary)]">
                {member.name ?? member.email}
              </p>
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                {member.email}
              </p>
            </div>
            <Badge variant="neutral">{member.role}</Badge>
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">
            Pending invites
          </p>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-[color:var(--color-border)] px-4 py-3"
            >
              <div>
                <p className="text-sm text-[color:var(--color-text-primary)]">
                  {invite.email}
                </p>
                <Badge variant="neutral">{invite.role}</Badge>
              </div>
              <Button
                variant="secondary"
                onClick={() => revoke(invite.id)}
                className={revokingId === invite.id ? "opacity-60" : ""}
              >
                {revokingId === invite.id ? "Revoking…" : "Revoke"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
            Invite a teammate
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN")}
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 bg-[color:var(--color-surface)]"
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </select>
        <Button onClick={sendInvite} className={inviting ? "opacity-60" : ""}>
          {inviting ? "Sending…" : "Send invite"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
