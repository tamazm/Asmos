"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { uploadCoupons, exportCoupons } from "./actions";

export function PoolRow({ reward }: { reward: any }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [couponText, setCouponText] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = reward._count?.coupons || 0;
  const used = reward.coupons?.length || 0;

  async function handleUpload() {
    setIsUploading(true);
    try {
      const codes = couponText.split(/[\n,]+/).map((c) => c.trim()).filter(Boolean);
      if (codes.length > 0) {
        await uploadCoupons(reward.id, codes);
      }
      setShowModal(false);
      setCouponText("");
    } catch (e) {
      alert("Failed to upload coupons.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const csvData = await exportCoupons(reward.id);
      const blob = new Blob([csvData], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coupons_${reward.id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert("Failed to export coupons.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <tr className="hover:bg-[color:var(--color-surface-sunken)] transition-colors group">
        <td className="px-6 py-4 font-medium">{reward.label}</td>
        <td className="px-6 py-4">
          <Link href={`/campaigns/${reward.campaignId}`} className="text-blue-500 hover:underline">
            {reward.campaign.name}
          </Link>
        </td>
        <td className="px-6 py-4 text-xs font-semibold">
          <span className="bg-[color:var(--color-surface-raised)] px-2 py-1 rounded-md border border-[color:var(--color-border)]">
            {reward.type}
          </span>
        </td>
        <td className="px-6 py-4 text-sm font-mono text-[color:var(--color-text-secondary)]">
          {reward.couponCode || "—"}
        </td>
        <td className="px-6 py-4">
          {used} / {total}
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              Add Codes
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || total === 0}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-raised)] transition-colors disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </td>
      </tr>

      {mounted && showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Upload Coupons for {reward.label}</h2>
            <p className="text-sm text-gray-500 mb-4">
              Paste your coupon codes below. You can separate them by commas or newlines.
            </p>
            <textarea
              className="w-full h-40 border border-gray-300 rounded-md p-3 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="SUMMER25&#10;VIP20&#10;WELCOME10"
              value={couponText}
              onChange={(e) => setCouponText(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || !couponText.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
