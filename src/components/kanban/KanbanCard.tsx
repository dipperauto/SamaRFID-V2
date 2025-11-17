"use client";

import React from "react";
import { KanbanCard as CardType } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  card: CardType;
  onClick?: () => void;
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

const KanbanCard: React.FC<Props> = ({ card, onClick }) => {
  const hasAssignees = card.assignees?.length > 0;
  const borderClass = colorStyles(card.color);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-xl border bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-xl hover:bg-black/60 transition-colors",
        borderClass,
      )}
      style={
        card.color && card.color !== "liquid_glass" && card.color.startsWith("#")
          ? { borderColor: card.color }
          : undefined
      }
    >
      <CardContent className="p-3">
        <div className="font-medium">{card.title}</div>
        {card.description ? (
          <div className="mt-1 text-xs text-white/80 line-clamp-3">{card.description}</div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {card.dueDate ? (
            <Badge className="bg-white/15 text-white hover:bg-white/20">
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