"use client";

import React from "react";
import { KanbanList, KanbanCard } from "./types";
import KanbanCardView from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Droppable, Draggable } from "@hello-pangea/dnd";

type Props = {
  list: KanbanList;
  cards: KanbanCard[];
  onNewCard: (listId: string) => void;
  onCardClick: (card: KanbanCard) => void;
};

const KanbanColumn: React.FC<Props> = ({ list, cards, onNewCard, onCardClick }) => {
  return (
    <div className="w-72 shrink-0 rounded-2xl border border-white/25 bg-black/40 p-3 ring-1 ring-white/20 backdrop-blur-2xl text-white">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">{list.title}</div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/30 bg-white text-black hover:bg-white/90"
          onClick={() => onNewCard(list.id)}
        >
          Novo
        </Button>
      </div>

      <Droppable droppableId={list.id} type="CARD">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex flex-col gap-3"
          >
            {cards
              .sort((a, b) => a.position - b.position)
              .map((card, index) => (
                <Draggable key={card.id} draggableId={card.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={`transition-transform ${snapshot.isDragging ? "scale-[1.02]" : ""}`}
                    >
                      <KanbanCardView card={card} onClick={() => onCardClick(card)} />
                    </div>
                  )}
                </Draggable>
              ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default KanbanColumn;