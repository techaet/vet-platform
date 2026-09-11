import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Bot, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

export default function Telegram() {
  const organizations = trpc.organization.mine.useQuery();
  const organizationId = organizations.data?.[0]?.id;
  const connect = trpc.telegram.connect.useMutation({ onSuccess: () => setMessage("Chat Telegram vinculado. Configure o webhook com o endereço informado abaixo.") });
  const [chatId, setChatId] = useState("");
  const [message, setMessage] = useState("");
  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
  return <DashboardLayout><div className="mx-auto w-full max-w-3xl space-y-6"><section className="border-b border-border/70 pb-6"><p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Fase 4</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Bot Telegram</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">Conecte o chat do veterinário ao bot para usar prontuário e agenda por comandos.</p></section><Card><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Vincular chat do veterinário</CardTitle><CardDescription>Envie /start ao bot, descubra o ID do chat e informe-o aqui. O token do bot permanece somente no servidor.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={event => { event.preventDefault(); if (organizationId) connect.mutate({ organizationId, chatId }); }}><div className="grid gap-2"><Label>ID do chat Telegram</Label><Input inputMode="numeric" placeholder="Ex.: 123456789" value={chatId} onChange={event => setChatId(event.target.value)} required /></div><Button className="min-h-11 w-fit" disabled={connect.isPending}>{connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Vincular chat</Button>{message ? <p className="text-sm text-primary">{message}</p> : null}</form></CardContent></Card><Card><CardHeader><CardTitle>Webhook do bot</CardTitle><CardDescription>Use este endereço na configuração do Telegram Bot API quando o token estiver configurado.</CardDescription></CardHeader><CardContent><code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{webhookUrl}</code></CardContent></Card><Card><CardHeader><CardTitle>Comandos disponíveis</CardTitle></CardHeader><CardContent><pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm leading-7">{`/ajuda\n/paciente NOME DO PROPRIETÁRIO\n/resumo ID_DO_ANIMAL\n/atendimento ID_DO_ANIMAL TEXTO\n/observacao ID_DO_ANIMAL TEXTO\n/agendar ID_DO_ANIMAL 2026-09-20T14:00\n/pdf ID_DO_ANIMAL\n/sair`}</pre></CardContent></Card></div></DashboardLayout>;
}
