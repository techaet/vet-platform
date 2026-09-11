import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Building2, CalendarDays, FileText, Loader2, MessageCircle, Plus, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";

const foundationItems = [
  { icon: FileText, label: "Prontuário", detail: "Base preparada para pacientes e histórico clínico" },
  { icon: CalendarDays, label: "Agenda", detail: "Estrutura pronta para consultas e lembretes" },
  { icon: MessageCircle, label: "Telegram", detail: "Integração será adicionada na próxima fase" },
  { icon: Users, label: "Equipe", detail: "Organizações e membros já provisionados" },
];

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const organizationsQuery = trpc.organization.mine.useQuery(undefined, { enabled: isAuthenticated });
  const createOrganization = trpc.organization.create.useMutation({
    onSuccess: () => organizationsQuery.refetch(),
  });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const submitOrganization = (event: React.FormEvent) => {
    event.preventDefault();
    createOrganization.mutate({ name, slug, description: description || undefined });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <section className="flex flex-col justify-between gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-primary">Plataforma veterinária</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Fundação do sistema
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Base técnica para organizar veterinários, clínicas, pacientes e os próximos fluxos de atendimento.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit gap-2 px-3 py-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> Fase 1 · base técnica
          </Badge>
        </section>

        {authLoading ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : user ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {foundationItems.map(item => (
                <Card key={item.label} className="border-border/70 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-sm leading-6 text-muted-foreground">{item.detail}</p></CardContent>
                </Card>
              ))}
            </section>

            {organizationsQuery.isLoading ? (
              <Card><CardContent className="flex items-center gap-3 py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Carregando sua organização...</CardContent></Card>
            ) : organizationsQuery.data?.length ? (
              <Card className="border-primary/20 bg-primary/[0.03] shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Sua organização</CardTitle>
                  <CardDescription>O ambiente inicial já está preparado para receber os módulos de pacientes, agenda e integrações.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {organizationsQuery.data.map(organization => (
                    <div key={organization.id} className="rounded-xl border border-border/70 bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{organization.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">/{organization.slug}</p>
                        </div>
                        <Badge variant="outline">{organization.role === "admin" ? "Administrador" : "Veterinário"}</Badge>
                      </div>
                      {organization.description ? <p className="mt-3 text-sm text-muted-foreground">{organization.description}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/20 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Criar a primeira organização</CardTitle>
                  <CardDescription>Esse cadastro cria o ambiente que receberá seus veterinários e pacientes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={submitOrganization}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2"><Label htmlFor="org-name">Nome</Label><Input id="org-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Fernanda Teo Veterinária" required /></div>
                      <div className="grid gap-2"><Label htmlFor="org-slug">Identificador</Label><Input id="org-slug" value={slug} onChange={event => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="fernanda-teo" required /><p className="text-xs text-muted-foreground">Letras minúsculas, números e hífens.</p></div>
                    </div>
                    <div className="grid gap-2"><Label htmlFor="org-description">Descrição breve <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id="org-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Descrição da operação veterinária" rows={3} /></div>
                    {createOrganization.error ? <p className="text-sm text-destructive">Não foi possível criar a organização. Verifique os dados e tente novamente.</p> : null}
                    <Button type="submit" className="w-fit" disabled={createOrganization.isPending}>{createOrganization.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Criar organização</Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
