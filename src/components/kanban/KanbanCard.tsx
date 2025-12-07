"use client";

import React from "react";
import { KanbanCard as CardType } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  card: CardType;
  onClick?: () => void;
  onDelete?: (id: string) => void;
};

const colorStyles = (color?: string | null) => {
  if (!color) return "border-white/20";
  if (color === "liquid_glass") {
    // efeito sutil "glass" claro
    return "border-[#efeae3]/70 bg-[#efeae3]/40";
  }
  // se hex ou nome, aplica como borda via style inline
  return "";
};

// Funções utilitárias para tingir o fundo com versão escurecida da cor escolhida
const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
};

const darkenRgb = (rgb: { r: number; g: number; b: number }, amount = 0.3) => {
  // mistura com preto para escurecer
  const a = Math.min(Math.max(amount, 0), 1);
  return {
    r: Math.round(rgb.r * (1 - a)),
    g: Math.round(rgb.g * (1 - a)),
    b: Math.round(rgb.b * (1 - a)),
  };
};

const rgba = (rgb: { r: number; g: number; b: number }, alpha = 0.12) =>
  `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

const getTintStyle = (color?: string | null): React.CSSProperties | undefined => {
  if (!color || color === "liquid_glass") return undefined;
  if (!color.startsWith("#")) return undefined;
  const rgb = hexToRgb(color);
  if (!rgb) return undefined;
  const dark = darkenRgb(rgb, 0.35);
  return {
    borderColor: color,
    backgroundColor: rgba(dark, 0.12),
  };
};

const KanbanCard: React.FC<Props> = ({ card, onClick, onDelete }) => {
  const hasAssignees = card.assignees?.length > 0;
  const borderClass = colorStyles(card.color);
  const isNearDue = (() => {
    if (!card.dueDate) return false;
    const due = new Date(card.dueDate).getTime();
    const now = Date.now();
    const diff = due - now;
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  })();

  const isLiquid = card.color === "liquid_glass";
  const style = isLiquid ? undefined : getTintStyle(card.color);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative cursor-pointer rounded-xl border backdrop-blur-xl transition-colors",
        isLiquid
          ? "bg-[#efeae3]/60 text-slate-800 ring-[#efeae3]/50 hover:bg-[#efeae3]/70"
          : "bg-white/70 text-slate-800 ring-black/5 hover:bg-white/80",
        borderClass,
      )}
      style={style}
    >
      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 text-red-300 hover:text-red-400 hover:bg-red-500/10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(card.id);
        }}
      >
        <Trash className="h-4 w-4" />
      </Button>

      <CardContent className="p-3">
        <div className="font-medium">{card.title}</div>
        {card.description ? (
          <div className="mt-1 text-xs text-white/80 line-clamp-3">{card.description}</div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {card.dueDate ? (
            <Badge className={cn(isNearDue ? "bg-red-500/30 text-red-200 hover:bg-red-500/35" : "bg-white/15 text-white hover:bg-white/20")}>
              <CalendarDays className="mr-1 h-3 w-3" />
              {new Date(card.dueDate).toLocaleDateString()}
            </Badge>
          ) : null}
          {hasAssignees ? (
            <Badge variant="outline" className="bg-white/10 text-white hover:bg-white/20">
              <Users className="mr-1 h-3 w-3" />
              {card.assignees.join(", ")}
            </Badge>
          ) : null}
          {card.color === "liquid_glass" ? (
            <Badge className="bg-[#f77821]/15 text-[#f77821] hover:bg-[#f77821]/20">Liquid Glass</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default KanbanCard;