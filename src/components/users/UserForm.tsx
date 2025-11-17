"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import PhotoCropper from "@/components/PhotoCropper";
import { PAGES } from "@/utils/pages";

export type UserFormValues = {
  username: string; // email
  full_name: string;
  password?: string | null;
  role: string;
  allowed_pages: string[];
  profile_photo_base64?: string | null;
};

type Props = {
  initial?: UserFormValues;
  readOnly?: boolean;
  isEdit?: boolean;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
  onCancel?: () => void;
};

const UserForm: React.FC<Props> = ({ initial, readOnly = false, isEdit = false, onSubmit, onCancel }) => {
  const [values, setValues] = React.useState<UserFormValues>({
    username: initial?.username ?? "",
    full_name: initial?.full_name ?? "",
    password: initial?.password ?? null,
    role: initial?.role ?? "usuario",
    allowed_pages: initial?.allowed_pages ?? [],
    profile_photo_base64: initial?.profile_photo_base64 ?? null,
  });

  const setField = (k: keyof UserFormValues, v: any) => {
    setValues((prev) => ({ ...prev, [k]: v }));
  };

  const togglePage = (key: string, checked: boolean) => {
    setValues((prev) => {
      const set = new Set(prev.allowed_pages);
      if (checked) set.add(key); else set.delete(key);
      return { ...prev, allowed_pages: Array.from(set) };
    });
  };

  const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (readOnly) {
      onCancel?.();
      return;
    }
    const { username, full_name, role } = values;
    if (!username || !full_name || !role) return;
    if (!isEdit && (!values.password || values.password.length < 1)) return;
    if (!isValidEmail(username)) return;
    onSubmit(values);
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
          <Label>E-mail (usuário)</Label>
          <Input
            value={values.username}
            disabled={readOnly || isEdit}
            onChange={(e) => setField("username", e.target.value)}
            placeholder="ex.: joao@empresa.com"
          />
        </div>
        {!readOnly && !isEdit && (
          <div className="space-y-2 md:col-span-2">
            <Label>Senha</Label>
            <Input
              type="password"
              value={values.password || ""}
              onChange={(e) => setField("password", e.target.value)}
              placeholder="senha segura"
            />
          </div>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label>Papel</Label>
          <Select value={values.role} onValueChange={(v) => setField("role", v)} disabled={readOnly}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="administrador">Administrador</SelectItem>
              <SelectItem value="usuario">Usuário</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Foto de Perfil (opcional)</Label>
        <PhotoCropper
          initialImage={values.profile_photo_base64 || null}
          onChange={(dataUrl) => setField("profile_photo_base64", dataUrl)}
        />
      </div>

      <div className="space-y-2">
        <Label>Páginas permitidas</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PAGES.map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white">
              <Checkbox
                checked={values.allowed_pages.includes(p.key)}
                disabled={readOnly}
                onCheckedChange={(c) => togglePage(p.key, !!c)}
              />
              <span className="text-sm">{p.label}</span>
            </label>
          ))}
        </div>
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

export default UserForm;