import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { FileUp, Loader2, PawPrint, Plus, Search } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "wouter";

export default function Patients() {
  const organizations = trpc.organization.mine.useQuery();
  const organizationId = organizations.data?.[0]?.id;
  const patients = trpc.patient.list.useQuery({ organizationId: organizationId ?? 0 }, { enabled: Boolean(organizationId) });
  const createOwner = trpc.owner.create.useMutation();
  const addAddress = trpc.owner.addAddress.useMutation();
  const createPatient = trpc.patient.create.useMutation({ onSuccess: () => { patients.refetch(); setCreated("Paciente cadastrado."); } });
  const importMarkdown = trpc.markdown.import.useMutation({ onSuccess: result => setImportResult(`Importados: ${result.ownersCreated} proprietários, ${result.patientsCreated} animais e ${result.recordsCreated} atendimentos.`) });
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState("");
  const [importResult, setImportResult] = useState("");
  const [form, setForm] = useState({ ownerName: "", phone: "", email: "", street: "", number: "", city: "", neighborhood: "", reference: "", accessInstructions: "", patientName: "", species: "", breed: "", notes: "" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organizationId) return;
    const owner = await createOwner.mutateAsync({ organizationId, name: form.ownerName, phone: form.phone || undefined, email: form.email || undefined });
    await addAddress.mutateAsync({ organizationId, ownerId: owner.id, street: form.street || undefined, number: form.number || undefined, city: form.city || undefined, neighborhood: form.neighborhood || undefined, reference: form.reference || undefined, accessInstructions: form.accessInstructions || undefined });
    await createPatient.mutateAsync({ organizationId, ownerId: owner.id, name: form.patientName, species: form.species || undefined, breed: form.breed || undefined, notes: form.notes || undefined });
    setForm({ ownerName: "", phone: "", email: "", street: "", number: "", city: "", neighborhood: "", reference: "", accessInstructions: "", patientName: "", species: "", breed: "", notes: "" });
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !organizationId) return;
    const content = await file.text();
    importMarkdown.mutate({ organizationId, fileName: file.name, content });
    event.target.value = "";
  };

  const filtered = patients.data?.filter(patient => `${patient.name} ${patient.ownerName}`.toLowerCase().includes(search.toLowerCase())) ?? [];

  return <DashboardLayout><div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end"><div><p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Fase 2</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Proprietários e pacientes</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">Cadastros, endereços domiciliares, prontuários e importação em lote.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><input ref={fileRef} type="file" accept=".md,text/markdown" className="hidden" onChange={importFile} /><Button variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()} disabled={importMarkdown.isPending}><FileUp className="mr-2 h-4 w-4" />Importar Markdown</Button><Button className="min-h-11" onClick={() => setShowForm(value => !value)}><Plus className="mr-2 h-4 w-4" />Novo cadastro</Button></div></div>
    {importResult ? <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">{importResult}</div> : null}
    {showForm ? <Card><CardHeader><CardTitle>Novo proprietário e paciente</CardTitle><CardDescription>O endereço é obrigatório para o atendimento domiciliar.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="grid gap-5"><div className="grid gap-4 sm:grid-cols-3"><div className="grid gap-2 sm:col-span-2"><Label>Nome do proprietário</Label><Input required value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} /></div><div className="grid gap-2"><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div><div className="grid gap-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div></div><div className="rounded-xl border border-border/70 bg-muted/20 p-4"><p className="mb-3 text-sm font-medium">Endereço do atendimento</p><div className="grid gap-4 sm:grid-cols-4"><div className="grid gap-2 sm:col-span-3"><Label>Logradouro</Label><Input required value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></div><div className="grid gap-2"><Label>Número</Label><Input required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} /></div><div className="grid gap-2"><Label>Cidade</Label><Input required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div><div className="grid gap-2"><Label>Bairro</Label><Input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} /></div><div className="grid gap-2 sm:col-span-2"><Label>Referência</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div><div className="grid gap-2 sm:col-span-4"><Label>Instruções de acesso</Label><Textarea rows={2} value={form.accessInstructions} onChange={e => setForm({ ...form, accessInstructions: e.target.value })} /></div></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="grid gap-2"><Label>Nome do animal</Label><Input required value={form.patientName} onChange={e => setForm({ ...form, patientName: e.target.value })} /></div><div className="grid gap-2"><Label>Espécie</Label><Input placeholder="Canino, felino..." value={form.species} onChange={e => setForm({ ...form, species: e.target.value })} /></div><div className="grid gap-2"><Label>Raça</Label><Input value={form.breed} onChange={e => setForm({ ...form, breed: e.target.value })} /></div><div className="grid gap-2 sm:col-span-3"><Label>Observações iniciais</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div></div>{created ? <p className="text-sm text-primary">{created}</p> : null}<Button type="submit" className="w-fit" disabled={createOwner.isPending || createPatient.isPending}>{createPatient.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar cadastro</Button></form></CardContent></Card> : null}
    <Card><CardContent className="pt-6"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por animal ou proprietário" value={search} onChange={e => setSearch(e.target.value)} /></div></CardContent></Card>
    {patients.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : filtered.length ? <div className="grid gap-3">{filtered.map(patient => <Link key={patient.id} href={`/patients/${patient.id}`}><Card className="cursor-pointer transition-colors hover:border-primary/40"><CardContent className="flex items-center justify-between gap-4 py-5"><div className="flex items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><PawPrint className="h-5 w-5" /></div><div><p className="font-medium">{patient.name}</p><p className="text-sm text-muted-foreground">{patient.ownerName} · {patient.species || "Espécie não informada"}{patient.breed ? ` · ${patient.breed}` : ""}</p></div></div><Badge variant="outline">Abrir prontuário</Badge></CardContent></Card></Link>)}</div> : <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum paciente cadastrado.</CardContent></Card>}
  </div></DashboardLayout>;
}
