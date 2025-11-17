export type KanbanList = {
  id: string;
  title: string;
  order: number;
};

export type KanbanCard = {
  id: string;
  listId: string;
  title: string;
  description?: string;
  assignees: string[]; // usernames
  dueDate?: string | null; // ISO date string
  color?: string | null; // name or hex, 'liquid_glass' supported
  position: number; // 0-based index within list
};

export type KanbanBoard = {
  lists: KanbanList[];
  cards: KanbanCard[];
};