"use client";

import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type Photographer = {
  username: string;
  full_name: string;
  profile_photo_url?: string;
};

type Props = {
  uploader: string;
  photographers?: Photographer[];
  apiBase?: string;
  className?: string;
};

const UploaderChip: React.FC<Props> = ({ uploader, photographers = [], apiBase = "", className = "" }) => {
  const sanitizeEmail = React.useCallback((u: string) => {
    return (u || "").toLowerCase().trim().replace(/@/g, "_").replace(/\./g, "_").replace(/[^a-z0-9_]/g, "");
  }, []);

  const normalizeLocal = React.useCallback((u: string) => {
    const local = (u || "").toLowerCase().split("@")[0] || "";
    return local.replace(/[\.\_\-]/g, "");
  }, []);

  const match = React.useMemo(() => {
    const raw = (uploader || "").toLowerCase().trim();
    const candidates = [raw, sanitizeEmail(uploader), normalizeLocal(uploader)];
    return photographers.find((p) => {
      const pu = (p.username || "").toLowerCase().trim();
      const pf = (p.full_name || "").toLowerCase().trim();
      const puCompact = pu.replace(/[\.\_\-]/g, "");
      const pfCompact = pf.replace(/\s+/g, "");
      return (
        candidates.includes(pu) ||
        candidates.includes(puCompact) ||
        candidates.includes(pfCompact)
      );
    });
  }, [uploader, photographers, sanitizeEmail, normalizeLocal]);

  const prettifyFromUsername = React.useCallback((raw: string) => {
    let base = raw.includes("@") ? raw.split("@")[0] : raw;
    base = base.replace(/[\.\_\-]/g, " ").trim().replace(/\s+/g, " ");
    return base
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ")
      || raw;
  }, []);

  const displayName = match
    ? (match.full_name && match.full_name.trim().length ? match.full_name : prettifyFromUsername(match.username || ""))
    : prettifyFromUsername(uploader || "");

  const initials = (displayName || "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  let photoSrc: string | undefined;
  if (match?.profile_photo_url) {
    photoSrc = `${apiBase}/${match.profile_photo_url}`;
  } else if (uploader) {
    const guessed = `media/users/${sanitizeEmail(uploader)}.png`;
    photoSrc = `${apiBase}/${guessed}`;
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-2 py-1 bg-black/5 border text-slate-900 ${className}`}>
      <Avatar className="h-6 w-6">
        {photoSrc ? (
          <AvatarImage src={photoSrc} alt={displayName} />
        ) : (
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        )}
      </Avatar>
      <span className="text-xs font-medium truncate max-w-[140px]">{displayName}</span>
    </div>
  );
};

export default UploaderChip;