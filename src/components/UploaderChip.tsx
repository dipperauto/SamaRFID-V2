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
  const match = React.useMemo(() => {
    const u = (uploader || "").toLowerCase();
    return photographers.find((p) => (p.username || "").toLowerCase() === u);
  }, [uploader, photographers]);

  const displayName = match
    ? match.full_name || match.username
    : (() => {
        // Fallback: derive name from email/username
        const raw = uploader || "";
        if (raw.includes("@")) {
          const base = raw.split("@")[0];
          return base.replace(/[\.\_\-]/g, " ").trim();
        }
        return raw;
      })();

  const initials = (displayName || "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const photoSrc = match?.profile_photo_url ? `${apiBase}/${match.profile_photo_url}` : undefined;

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