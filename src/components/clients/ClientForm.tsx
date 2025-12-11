"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import PhotoCropper from "@/components/PhotoCropper";

export type ClientFormValues = {
  full_name: string;
  doc: string;
  address: string;
  phone: string;
  pix_key?: string | null;
  bank_data?: string | null;
  municipal_registration?: string | null;
  state_registration?: string | null;
  corporate_name?: string | null; // Razão Social
  trade_name?: string | null;      // Nome Fantasia
  notes?: string | null;
  profile_photo_base64?: string | null;
  email?: string | null;
};

type Props = {
  initial?: ClientFormValues;
  readOnly?: boolean;
  onSubmit: (values: ClientFormValues) => Promise<void> | void;
  onCancel?: () => void;
};

const ClientForm: React.FC<Props> = ({ initial, readOnly = false, onSubmit, onCancel }) => {
  const [values, setValues] = React.useState<ClientFormValues>({
    full_name: initial?.full_name ?? "",
    doc: initial?.doc ?? "",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    pix_key: initial?.pix_key ?? "",
    bank_data: initial?.bank_data ?? "",
    municipal_registration: initial?.municipal_registration ?? "",
    state_registration: initial?.state_registration ?? "",
    corporate_name: initial?.corporate_name ?? "",
    trade_name: initial?.trade_name ?? "",
    notes: initial?.notes ?? "",
    profile_photo_base64: initial?.profile_photo_base64 ?? null,
    email: (initial as any)?.email ?? "",
  });

  const [cep, setCep] = React.useState<string>("");
  const [street, setStreet] = React.useState<string>("");
  const [numberAddr, setNumberAddr] = React.useState<string>("");
  const [neighborhood, setNeighborhood] = React.useState<string>("");
  const [complement, setComplement] = React.useState<string>("");
  
  const setField = (k: keyof ClientFormValues, v: string | null) => {
    setValues((prev) => ({ ...prev, [k]: v as any }));
  };

  const countLines = (text: string) => (text ? text.split(/\r?\n/).length : 0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (readOnly) {
      onCancel?.();
      return;
    }
    const { full_name, doc, phone, notes } = values;
    // Montar endereço final
    const parts = [street, numberAddr ? `nº ${numberAddr}` : "", neighborhood, complement].filter(Boolean);
    const finalAddress = parts.join(", ");
    const addressToSend = finalAddress || values.address;
    if (!full_name || !doc || !addressToSend || !phone) return;
    if (notes && countLines(notes) > 50) return;
    onSubmit({ ...values, address: addressToSend });
  };

  const lookupCEP = async () => {
    const raw = (cep || "").replace(/\D/g, "");
    if (raw.length !== 8) return;
    const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
    if (!res.ok) return;
    const data = await res.json();
    if (data?.erro) return;
    setStreet(data?.logradouro || "");
    setNeighborhood(data?.bairro || "");
    setComplement(data?.complemento || "");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome Completo</Label>
          <Input
            value={values.full_name}
            disabled={readOnly}
            onChange={(e) => setField("full_name", e.target.value)}
            placeholder="Nome completo"
          />
        </div>
        <div className="space-y-2">
          <Label>CPF/CNPJ</Label>
          <Input
            value={values.doc}
            disabled={readOnly}
            onChange={(e) => setField("doc", e.target.value)}
            placeholder="000.000.000-00 ou 00.000.000/0001-00"
          />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input
            value={values.email || ""}
            disabled={readOnly}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>
        <div className="space-y-2">
          <Label>CEP</Label>
          <div className="flex items-center gap-2">
            <Input
              value={cep}
              disabled={readOnly}
              onChange={(e) => setCep(e.target.value)}
              placeholder="00000-000"
              className="flex-1"
            />
            <Button type="button" variant="outline" disabled={readOnly} onClick={lookupCEP} className="bg-white text-black hover:bg-white/90">
              🔍
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Rua</Label>
          <Input value={street} disabled={readOnly} onChange={(e) => setStreet(e.target.value)} placeholder="Rua" />
        </div>
        <div className="space-y-2">
          <Label>Número</Label>
          <Input value={numberAddr} disabled={readOnly} onChange={(e) => setNumberAddr(e.target.value)} placeholder="Número" />
        </div>
        <div className="space-y-2">
          <Label>Bairro</Label>
          <Input value={neighborhood} disabled={readOnly} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" />
        </div>
        <div className="space-y-2">
          <Label>Complemento</Label>
          <Input value={complement} disabled={readOnly} onChange={(e) => setComplement(e.target.value)} placeholder="Complemento" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            value={values.phone}
            disabled={readOnly}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="space-y-2">
          <Label>Chave Pix (opcional)</Label>
          <Input
            value={values.pix_key || ""}
            disabled={readOnly}
            onChange={(e) => setField("pix_key", e.target.value)}
            placeholder="email, telefone, CPF/CNPJ ou aleatória"
          />
        </div>
        <div className="space-y-2">
          <Label>Dados Bancários (opcional)</Label>
          <Input
            value={values.bank_data || ""}
            disabled={readOnly}
            onChange={(e) => setField("bank_data", e.target.value)}
            placeholder="Banco, agência, conta"
          />
        </div>
        <div className="space-y-2">
          <Label>Inscrição Municipal (opcional)</Label>
          <Input
            value={values.municipal_registration || ""}
            disabled={readOnly}
            onChange={(e) => setField("municipal_registration", e.target.value)}
            placeholder="Número da inscrição municipal"
          />
        </div>
        <div className="space-y-2">
          <Label>Inscrição Estadual (opcional)</Label>
          <Input
            value={values.state_registration || ""}
            disabled={readOnly}
            onChange={(e) => setField("state_registration", e.target.value)}
            placeholder="Número da inscrição estadual"
          />
        </div>
        <div className="space-y-2">
          <Label>Razão Social (opcional)</Label>
          <Input
            value={values.corporate_name || ""}
            disabled={readOnly}
            onChange={(e) => setField("corporate_name", e.target.value)}
            placeholder="Razão Social"
          />
        </div>
        <div className="space-y-2">
          <Label>Nome Fantasia (opcional)</Label>
          <Input
            value={values.trade_name || ""}
            disabled={readOnly}
            onChange={(e) => setField("trade_name", e.target.value)}
            placeholder="Nome Fantasia"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notas (até 50 linhas)</Label>
        <Textarea
          value={values.notes || ""}
          disabled={readOnly}
          onChange={(e) => setField("notes", e.target.value)}
          placeholder="Observações gerais..."
          className="min-h-[140px]"
        />
        <div className="text-xs text-gray-500">
          Linhas: {countLines(values.notes || "")} / 50
        </div>
      </div>

      <div className="space-y-2">
        <Label>Foto de Perfil (opcional)</Label>
        <PhotoCropper
          initialImage={values.profile_photo_base64 || null}
          onChange={(dataUrl) => setField("profile_photo_base64", dataUrl)}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="text-black bg-white hover:bg-white/90"
          >
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
        )}
        {!readOnly && (
          <Button type="submit">Salvar</Button>
        )}
      </div>
    </form>
  );
};

export default ClientForm;