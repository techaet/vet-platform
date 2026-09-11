import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Bot, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

export default function Telegram() {
  const organizations = trpc.organization.mine.useQuery();
  const organizationId = organizations.data?.[0]?.id;
  const [chatId, setChatId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const connect = trpc.telegram.connect.useMutation({
    onSuccess: () => { setError(""); setMessage("Chat ID vinculado com sucesso. Agora envie /start ao bot."); },
    onError: mutationError => { setMessage(""); setError(mutationError.message || "Não foi possível vincular o Chat ID."); },
  });
  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
  const canSubmit = Boolean(organizationId && /^-?\d+$/.test(chatId.trim()));
  return <DashboardLayout><div className="mx-auto w-full max-w-3xl space-y-6"><section className="border-b border-border/70 pb-6"><p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Fase 4</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Bot Telegram</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">Conecte o chat do veterinário ao bot para usar prontuário e agenda por comandos.</p></section><Card><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Vincular chat do veterinário</CardTitle><CardDescription>Informe o <strong>Chat ID numérico</strong>, não o número de telefone. Para descobrir o Chat ID, envie /start ao @userinfobot no Telegram.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={event => { event.preventDefault(); setMessage(""); setError(""); if (canSubmit && organizationId) connect.mutate({ organizationId, chatId: chatId.trim() }); }}><div className="grid gap-2"><Label>Chat ID numérico do Telegram</Label><Input inputMode="numeric" placeholder="Ex.: 123456789" value={chatId} onChange={event => setChatId(event.target.value)} required /><p className="text-xs text-muted-foreground">Não use o telefone, @username ou nome do usuário. Use somente o número exibido pelo @userinfobot.</p></div><Button className="min-h-11 w-fit" disabled={!canSubmit || connect.isPending}>{connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Vincular chat</Button>{message ? <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />{message}</p> : null}{error ? <p className="flex items-center gap-2 text-sm text-destructive"><XCircle className="h-4 w-4" />{error}</p> : null}{!organizationId && !organizations.isLoading ? <p className="text-sm text-destructive">Nenhuma organização foi encontrada para este usuário.</p> : null}</form></CardContent></Card><Card><CardHeader><CardTitle>Webhook do bot</CardTitle><CardDescription>Endereço atualmente exibido para a publicação em uso.</CardDescription></CardHeader><CardContent><code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{webhookUrl}</code></CardContent></Card><Card><CardHeader><CardTitle>Comandos disponíveis</CardTitle></CardHeader><CardContent><pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm leading-7">{`/ajuda\n/paciente NOME DO PROPRIETÁRIO\n/resumo ID_DO_ANIMAL\n/atendimento ID_DO_ANIMAL TEXTO\n/observacao ID_DO_ANIMAL TEXTO\n/agendar ID_DO_ANIMAL 2026-09-20T14:00\n/pdf ID_DO_ANIMAL\n/sair`}</pre></CardContent></Card></div></DashboardLayout>;
}
