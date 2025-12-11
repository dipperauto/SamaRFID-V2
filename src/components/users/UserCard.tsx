"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";

export type AppUser = {
  username: string; // email
  full_name: string;
  role: string;
  profile_photo_path?: string | null;
  allowed_pages: string[];
};

type Props = {
  user: AppUser;
  apiUrl: string;
  onView: (user: AppUser) => void;
  onEdit?: (user: AppUser) => void;
  editMode?: boolean;
};

const UserCard: React.FC<Props> = ({ user, apiUrl, onView, onEdit, editMode = false }) => {
  const photoUrl = React.useMemo(() => {
    const pRaw = user.profile_photo_path || "";
    if (!pRaw) return null;
    // Normaliza separadores de path para web
    const p = pRaw.replace(/\\/g, "/");
    const webPath =
      p.startsWith("static/") ? p :
      p.startsWith("media/") ? p.replace(/^media\//, "static/") :
      `static/${p.replace(/^\//, "")}`;
    return `${apiUrl}/${webPath}`;
  }, [user.profile_photo_path, apiUrl]);

  const displayRole = React.useMemo(() => {
    const r = (user.role || "").toLowerCase();
    if (r === "usuario" || r === "usuário" || r === "fotografo" || r === "fotógrafo") return "fotógrafo";
    return user.role;
  }, [user.role]);

  return (
    <Card className="rounded-2xl border border-white/20 bg-[#0b1d3a]/50 shadow-xl ring-1 ring-white/10 backdrop-blur-2xl backdrop-saturate-150 text-white">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="shrink-0">
            <Avatar className="w-14 h-14 sm:w-16 sm:h-16 ring-1 ring-white/30">
              {photoUrl ? (
                <AvatarImage src={photoUrl} alt={user.full_name} />
              ) : (
                <AvatarFallback className="bg-white/20">
                  <UserIcon className="h-6 w-6 text-white" />
                </AvatarFallback>
              )}
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold truncate text-base sm:text-lg">{user.full_name}</div>
              <Badge variant="outline" className="bg-white/10 text-white">{displayRole}</Badge>
            </div>
            <div className="text-white/80 text-xs sm:text-sm mt-1 truncate">E-mail: {user.username}</div>
            <div className="text-white/70 text-[11px] sm:text-xs mt-1 line-clamp-2">
              Páginas: {user.allowed_pages.length > 0 ? user.allowed_pages.join(", ") : "—"}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4">
              <Button
                variant="secondary"
                onClick={() => onView(user)}
                className="w-full sm:w-auto bg-white/20 text-white hover:bg-white/25"
              >
                Ver
              </Button>
              {editMode && onEdit && (
                <Button
                  variant="outline"
                  onClick={() => onEdit(user)}
                  className="w-full sm:w-auto border-white/30 bg-white text-black hover:bg-white/90"
                >
                  Editar
                </Button>
              )}
              {editMode && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    const ev = new CustomEvent("user-delete-request", { detail: user });
                    window.dispatchEvent(ev);
                  }}
                  className="w-full sm:w-auto"
                >
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserCard;