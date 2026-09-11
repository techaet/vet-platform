import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileText, Loader2, MapPin, Pencil, Paperclip, Save } from "lucide-react";
import { useState } from "react";
import { Link, useRoute } from "wouter";

export default function PatientDetail() {
  const [, params] = useRoute("/patients/:id");
  const patientId = Number(params?.id);
  const organizations = trpc.organization.mine.useQuery();
  const organizationId = organizations.data?.[0]?.id;
  const patient = trpc.patient.get.useQuery({ organizationId: organizationId ?? 0, patientId }, { enabled: Boolean(organizationId && patientId) });
  const createRecord = trpc.medicalRecord.create.useMutation({ onSuccess: () => { patient.refetch(); setContent(""); } });
  const updateRecord = trpc.medicalRecord.update.useMutation({ onSuccess: () => { patient.refetch(); setEditing(null); } });
  const addAttachment = trpc.patient.addAttachment.useMutation({ onSuccess: () => patient.refetch() });
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  if (patient.isLoading) return <DashboardLayout><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></DashboardLayout>;
  if (!patient.data || !organizationId) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Paciente não encontrado.</div></DashboardLayout>;
  const data = patient.data;

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addAttachment.mutate({ organizationId, patientId, fileName: file.name, mimeType: file.type as any, fileData: String(reader.result), description: "Anexo do prontuário" });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return <DashboardLayout><div className="mx-auto w-full max-w-6xl space-y-6"><Link href="/patients"><Button variant="ghost" className="-ml-3"><ArrowLeft className="mr-2 h-4 w-4" />Voltar aos pacientes</Button></Link><section className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end"><div><p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Prontuário</p><h1 className="mt-2 text-3xl font-semibold">{data.name}</h1><p className="mt-2 text-muted-foreground">{data.ownerName} · {data.species || "Espécie não informada"}{data.breed ? ` · ${data.breed}` : ""}</p></div><label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"><Paperclip className="mr-2 h-4 w-4" />Adicionar arquivo<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf,audio/mpeg,audio/ogg,audio/wav" onChange={upload} /></label></section><div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"><div className="space-y-6"><Card><CardHeader><CardTitle>Novo atendimento</CardTitle><CardDescription>Registro manual da Fase 2. O fluxo pelo Telegram será adicionado depois.</CardDescription></CardHeader><CardContent><form onSubmit={e => { e.preventDefault(); createRecord.mutate({ organizationId, patientId, content, title: "Atendimento", sourceType: "veterinarian" }); }} className="grid gap-3"><Textarea required rows={5} placeholder="Descreva o atendimento..." value={content} onChange={e => setContent(e.target.value)} /><Button className="w-fit" disabled={createRecord.isPending}>Salvar atendimento</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent className="space-y-4">{data.records.length ? data.records.map(record => <div key={record.id} className="rounded-xl border border-border/70 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-medium">{record.title || "Atendimento"}</p><p className="text-xs text-muted-foreground">{record.recordDate ? new Date(record.recordDate).toLocaleDateString("pt-BR") : "Sem data"}</p></div><Badge variant={record.sourceType === "owner" ? "secondary" : "outline"}>{record.sourceType === "owner" ? "Proprietário" : record.sourceType === "markdown_import" ? "Importado" : "Veterinário"}</Badge></div>{editing === record.id ? <div className="grid gap-2"><Textarea rows={5} value={editContent} onChange={e => setEditContent(e.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={() => updateRecord.mutate({ organizationId, recordId: record.id, content: editContent })}><Save className="mr-2 h-4 w-4" />Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button></div></div> : <><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{record.content}</p><Button variant="ghost" size="sm" className="mt-2" onClick={() => { setEditing(record.id); setEditContent(record.content); }}><Pencil className="mr-2 h-4 w-4" />Editar</Button></>}</div>) : <p className="py-4 text-sm text-muted-foreground">Nenhum atendimento registrado.</p>}</CardContent></Card></div><div className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Endereço domiciliar</CardTitle></CardHeader><CardContent className="space-y-3">{data.addresses.length ? data.addresses.map(address => <div key={address.id} className="rounded-lg bg-muted/30 p-3 text-sm"><p className="font-medium">{address.label}</p><p>{[address.street, address.number, address.complement].filter(Boolean).join(", ")}</p><p>{[address.neighborhood, address.city, address.state].filter(Boolean).join(" · ")}</p>{address.reference ? <p className="mt-2 text-muted-foreground">Referência: {address.reference}</p> : null}{address.accessInstructions ? <p className="mt-1 text-muted-foreground">Acesso: {address.accessInstructions}</p> : null}</div>) : <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Anexos</CardTitle><CardDescription>Fotos, vídeos, PDFs e áudios do paciente.</CardDescription></CardHeader><CardContent className="space-y-3">{data.attachments.length ? data.attachments.map(file => <a key={file.id} href={file.storageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-border/70 p-3 text-sm hover:bg-muted/30"><FileText className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate">{file.fileName}</span></a>) : <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>}</CardContent></Card></div></div></div></DashboardLayout>;
}
