"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

export type Client = {
  id: number;
  full_name: string;
  doc: string;
  address: string;
  phone: string;
  profile_photo_path?: string | null;
  pix_key?: string | null;
  bank_data?: string | null;
  municipal_registration?: string | null;
  state_registration?: string | null;
  corporate_name?: string | null; // Razão Social
  trade_name?: string | null;      // Nome Fantasia
  notes?: string | null;
};

type Props = {
  client: Client;
  apiUrl: string;
  onView: (client: Client) => void;
  onEdit?: (client: Client) => void;
  editMode?: boolean;
};

const ClientCard: React.FC<Props> = ({ client, apiUrl, onView, onEdit, editMode = false }) => {
  const photoUrl = client.profile_photo_path ? `${apiUrl}/${client.profile_photo_path}` : null;

  return (
    <Card className="rounded-2xl border border-white/25 bg-black/40 shadow-xl ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75 text-white">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <Avatar className="w-16 h-16 ring-1 ring-white/30">
              {photoUrl ? (
                <AvatarImage src={photoUrl} alt={client.full_name} />
              ) : (
                <AvatarFallback className="bg-white/20">
                  <User className="h-6 w-6 text-white" />
                </AvatarFallback>
              )}
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold truncate">{client.full_name}</div>
              <Badge variant="outline" className="bg-white/10 text-white">#{client.id}</Badge>
            </div>
            <div className="text-white/80 text-sm mt-1 truncate">Documento: {client.doc}</div>
            <div className="text-white/80 text-sm truncate">Telefone: {client.phone}</div>
            <div className="text-white/70 text-xs mt-1 line-clamp-2">Endereço: {client.address}</div>

            <div className="flex flex-wrap gap-2 mt-3">
              {client.pix_key ? (
                <Badge className="bg-green-500/30 text-white hover:bg-green-500/40">Pix</Badge>
              ) : (
                <Badge variant="outline" className="bg-white/10 text-white">Sem Pix</Badge>
              )}
              {client.bank_data ? (
                <Badge className="bg-blue-500/30 text-white hover:bg-blue-500/40">Bancário</Badge>
              ) : (
                <Badge variant="outline" className="bg-white/10 text-white">Sem banco</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4">
              <Button variant="secondary" onClick={() => onView(client)} className="bg-white/20 text-white hover:bg-white/25">
                Ver
              </Button>
              {editMode && onEdit && (
                <Button variant="outline" onClick={() => onEdit(client)} className="border-white/30 bg-white text-black hover:bg-white/90">
                  Editar
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientCard;