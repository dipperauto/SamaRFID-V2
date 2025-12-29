"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Search, MapPin, List, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UnitsTab } from "@/components/verifications/UnitsTab";
import { CustomListsTab } from "@/components/verifications/CustomListsTab";
import { HistoryTab } from "@/components/verifications/HistoryTab";

const VerificationPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full overflow-hidden p-4">
      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
              <List className="h-5 w-5" />
              Verificação de Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="units" className="w-full">
              <TabsList className="bg-white/10">
                <TabsTrigger value="units" className="text-white">Unidades</TabsTrigger>
                <TabsTrigger value="custom" className="text-white">Listas Personalizadas</TabsTrigger>
                <TabsTrigger value="history" className="text-white">Histórico</TabsTrigger>
              </TabsList>
              <TabsContent value="units">
                <UnitsTab />
              </TabsContent>
              <TabsContent value="custom">
                <CustomListsTab />
              </TabsContent>
              <TabsContent value="history">
                <HistoryTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerificationPage;