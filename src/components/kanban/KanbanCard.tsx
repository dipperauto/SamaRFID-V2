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
    // efeito sutil "glass"
    return "border-sky-300/50 bg-white/5";
  }
  // se hex ou nome, aplica como borda via style inline
  return "";
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

  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative cursor-pointer rounded-xl border bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-xl hover:bg-black/60 transition-colors",
        borderClass,
      )}
      style={
        card.color && card.color !== "liquid_glass" && card.color.startsWith("#")
          ? { borderColor: card.color }
          : undefined
      }
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
            <Badge className="bg-sky-300/20 text-sky-100 hover:bg-sky-300/25">Liquid Glass</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default KanbanCard;