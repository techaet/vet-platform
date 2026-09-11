import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storageGetSignedUrl, storagePut } from "./storage";
import {
  createMedicalRecord,
  createOwnerObservation,
  createTelegramAppointment,
  findOwnerByName,
  getPatient,
  getTelegramSession,
  getVeterinarianByTelegramChat,
  listOwnerPatients,
  saveTelegramMessage,
  saveTelegramSession,
} from "./db";
import { buildPrescriptionPdf } from "./prescriptionPdf";

const telegramApi = () => `https://api.telegram.org/bot${ENV.telegramBotToken}`;

async function telegramCall(method: string, body: Record<string, unknown>) {
  if (!ENV.telegramBotToken) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  const response = await fetch(`${telegramApi()}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Telegram ${method} failed: ${response.status}`);
  return response.json();
}

async function sendMessage(chatId: string, text: string) {
  await telegramCall("sendMessage", { chat_id: chatId, text });
  await saveTelegramMessage({ telegramChatId: chatId, direction: "outbound", messageType: "text", text });
}

async function identifyPatient(organizationId: number, argument: string) {
  const owners = await findOwnerByName(organizationId, argument.trim());
  if (owners.length !== 1) return { owners, patients: [] as Awaited<ReturnType<typeof listOwnerPatients>> };
  const patients = await listOwnerPatients(organizationId, owners[0].id);
  return { owners, owner: owners[0], patients };
}

export function parseTelegramCommand(text: string) {
  const parts = text.trim().split(/\s+/);
  return { command: parts[0] || "", args: parts.slice(1), argument: parts.slice(1).join(" ").trim() };
}

async function transcribeTelegramVoice(message: any, chatId: string, veterinarianUserId: number, organizationId: number) {
  const voice = message.voice || message.audio;
  const fileResult = await telegramCall("getFile", { file_id: voice.file_id }) as { result?: { file_path?: string } };
  const filePath = fileResult.result?.file_path;
  if (!filePath) throw new Error("Áudio não localizado");
  const url = `${telegramApi().replace("api.telegram.org/bot", "api.telegram.org/file/bot")}/${filePath}`;
  const audioResponse = await fetch(url);
  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  const stored = await storagePut(`telegram/${organizationId}/${veterinarianUserId}/${Date.now()}.ogg`, audioBuffer, "audio/ogg");
  const result = await transcribeAudio({ audioUrl: url, language: "pt", prompt: "Transcrição de atendimento veterinário em português." });
  if (!("text" in result)) throw new Error(result.error);
  return { text: result.text, storageKey: stored.key };
}

async function processText(chatId: string, text: string, vet: NonNullable<Awaited<ReturnType<typeof getVeterinarianByTelegramChat>>>, audioKey?: string) {
  const parsed = parseTelegramCommand(text);
  const command = parsed.command;
  const rest = parsed.args;
  const argument = parsed.argument;
  const session = await getTelegramSession(chatId);

  if (command === "/start" || command === "/ajuda" || command === "/help") {
    await sendMessage(chatId, "Bot veterinário ativo.\n\nComandos:\n/paciente NOME DO PROPRIETÁRIO\n/resumo ID_DO_ANIMAL\n/atendimento ID_DO_ANIMAL TEXTO\n/observacao ID_DO_ANIMAL TEXTO\n/agendar ID_DO_ANIMAL 2026-09-20T14:00\n/pdf ID_DO_ANIMAL\n/sair");
    return;
  }
  if (command === "/sair") {
    await saveTelegramSession({ telegramChatId: chatId, organizationId: vet.organizationId, veterinarianUserId: vet.userId, mode: "idle" });
    await sendMessage(chatId, "Contexto encerrado.");
    return;
  }
  if (command === "/paciente") {
    const result = await identifyPatient(vet.organizationId, argument);
    if (result.owners.length !== 1) { await sendMessage(chatId, result.owners.length ? "Encontrei mais de um proprietário com esse nome. Informe o nome completo." : "Proprietário não encontrado."); return; }
    if (!result.owner || result.patients.length === 0) { await sendMessage(chatId, "Proprietário encontrado, mas sem animais cadastrados."); return; }
    await saveTelegramSession({ telegramChatId: chatId, organizationId: vet.organizationId, veterinarianUserId: vet.userId, mode: "idle", ownerId: result.owner.id, patientId: result.patients[0].id });
    await sendMessage(chatId, result.patients.map(patient => `${patient.id} — ${patient.name} (${patient.species || "espécie não informada"})`).join("\n") + "\n\nUse /resumo ID para consultar o paciente.");
    return;
  }
  if (command === "/resumo") {
    const patientId = Number(rest[0] || session?.patientId);
    if (!patientId) { await sendMessage(chatId, "Informe o ID do animal. Ex.: /resumo 12"); return; }
    const patient = await getPatient(vet.userId, vet.organizationId, patientId);
    if (!patient) { await sendMessage(chatId, "Paciente não encontrado."); return; }
    const history = patient.records.slice(0, 3).map(record => `${record.recordDate ? new Date(record.recordDate).toLocaleDateString("pt-BR") : "sem data"}: ${record.content.slice(0, 280)}`).join("\n");
    await saveTelegramSession({ telegramChatId: chatId, organizationId: vet.organizationId, veterinarianUserId: vet.userId, mode: "idle", ownerId: patient.ownerId, patientId });
    await sendMessage(chatId, `Paciente: ${patient.name}\nProprietário: ${patient.ownerName}\nEndereço: ${patient.addresses[0] ? [patient.addresses[0].street, patient.addresses[0].number, patient.addresses[0].city].filter(Boolean).join(", ") : "não cadastrado"}\n\nHistórico recente:\n${history || "Sem atendimentos registrados."}`);
    return;
  }
  if (command === "/atendimento" || command === "/observacao") {
    const patientId = Number(rest[0]);
    const body = rest.slice(1).join(" ").trim();
    const resolvedPatientId = patientId || session?.patientId;
    if (!resolvedPatientId && !body) { await sendMessage(chatId, `Use: ${command} ID_DO_ANIMAL TEXTO`); return; }
    if (!body && resolvedPatientId) {
      await saveTelegramSession({ telegramChatId: chatId, organizationId: vet.organizationId, veterinarianUserId: vet.userId, mode: command === "/atendimento" ? "record" : "owner_observation", patientId: resolvedPatientId });
      await sendMessage(chatId, command === "/atendimento" ? "Envie agora o relato do atendimento." : "Envie agora a observação encaminhada pelo proprietário.");
      return;
    }
    const patientIdForRecord = resolvedPatientId as number;
    const patient = await getPatient(vet.userId, vet.organizationId, patientIdForRecord);
    if (!patient) { await sendMessage(chatId, "Paciente não encontrado."); return; }
    if (command === "/atendimento") await createMedicalRecord(vet.userId, { organizationId: vet.organizationId, patientId: patientIdForRecord, content: body, title: "Atendimento via Telegram", sourceType: "veterinarian" });
    else { await createOwnerObservation({ organizationId: vet.organizationId, patientId: patientIdForRecord, veterinarianUserId: vet.userId, content: body, originalAudioKey: audioKey }); await createMedicalRecord(vet.userId, { organizationId: vet.organizationId, patientId: patientIdForRecord, content: body, title: "Observação do proprietário", sourceType: "owner" }); }
    await sendMessage(chatId, command === "/atendimento" ? "Atendimento registrado no prontuário." : "Observação do proprietário registrada e identificada no prontuário.");
    return;
  }
  if (command === "/agendar") {
    const patientId = Number(rest[0]);
    const scheduledAt = new Date(rest[1] || "");
    if (!patientId || Number.isNaN(scheduledAt.getTime())) { await sendMessage(chatId, "Use: /agendar ID_DO_ANIMAL 2026-09-20T14:00"); return; }
    const patient = await getPatient(vet.userId, vet.organizationId, patientId);
    if (!patient) { await sendMessage(chatId, "Paciente não encontrado."); return; }
    const address = patient.addresses[0];
    const addressText = address ? [address.street, address.number, address.complement, address.city, address.reference].filter(Boolean).join(", ") : undefined;
    await createTelegramAppointment({ organizationId: vet.organizationId, ownerId: patient.ownerId, patientId, veterinarianUserId: vet.userId, scheduledAt, addressText });
    await sendMessage(chatId, `Consulta agendada para ${scheduledAt.toLocaleString("pt-BR")} em ${addressText || "endereço não cadastrado"}.`);
    return;
  }
  if (command === "/pdf") {
    const patientId = Number(rest[0] || session?.patientId);
    const patient = patientId ? await getPatient(vet.userId, vet.organizationId, patientId) : undefined;
    if (!patient) { await sendMessage(chatId, "Informe um ID de animal válido. Ex.: /pdf 12"); return; }
    const pdf = buildPrescriptionPdf({ businessName: "Prontuário veterinário", professionalName: vet.displayName, patientName: patient.name, ownerName: patient.ownerName, issuedAt: new Date(), notes: patient.records.map(record => `${record.title || "Registro"}: ${record.content}`).join("\n"), items: [] });
    const stored = await storagePut(`telegram/${vet.organizationId}/patients/${patient.id}/prontuario-${patient.id}.pdf`, pdf, "application/pdf");
    const signedUrl = await storageGetSignedUrl(stored.key);
    await telegramCall("sendDocument", { chat_id: chatId, document: signedUrl, caption: `Prontuário de ${patient.name}` });
    return;
  }
  if (session?.mode === "record" && session.patientId) {
    await createMedicalRecord(vet.userId, { organizationId: vet.organizationId, patientId: session.patientId, content: text, title: "Atendimento via Telegram", sourceType: "veterinarian" });
    await saveTelegramSession({ telegramChatId: chatId, organizationId: vet.organizationId, veterinarianUserId: vet.userId, mode: "idle", patientId: session.patientId });
    await sendMessage(chatId, "Atendimento registrado no prontuário.");
    return;
  }
  if (session?.mode === "owner_observation" && session.patientId) {
    await createOwnerObservation({ organizationId: vet.organizationId, patientId: session.patientId, veterinarianUserId: vet.userId, content: text, originalAudioKey: audioKey });
    await createMedicalRecord(vet.userId, { organizationId: vet.organizationId, patientId: session.patientId, content: text, title: "Observação do proprietário", sourceType: "owner" });
    await saveTelegramSession({ telegramChatId: chatId, organizationId: vet.organizationId, veterinarianUserId: vet.userId, mode: "idle", patientId: session.patientId });
    await sendMessage(chatId, "Observação do proprietário registrada.");
    return;
  }
  if (session?.patientId && /^(resumo|histórico|historico)\b/i.test(text)) {
    await processText(chatId, `/resumo ${session.patientId}`, vet);
    return;
  }
  if (session?.patientId && /^(atendimento|registrar atendimento|pós[- ]consulta|pos[- ]consulta)\b/i.test(text)) {
    await saveTelegramSession({ telegramChatId: chatId, organizationId: vet.organizationId, veterinarianUserId: vet.userId, mode: "record", patientId: session.patientId });
    await sendMessage(chatId, "Envie agora o relato do atendimento, por texto ou áudio.");
    return;
  }
  if (session?.patientId && /^(observação do proprietário|observacao do proprietario)\b/i.test(text)) {
    await saveTelegramSession({ telegramChatId: chatId, organizationId: vet.organizationId, veterinarianUserId: vet.userId, mode: "owner_observation", patientId: session.patientId });
    await sendMessage(chatId, "Envie agora o texto ou áudio encaminhado pelo proprietário.");
    return;
  }
  await sendMessage(chatId, "Não entendi. Use /ajuda para ver os comandos disponíveis.");
}

export function registerTelegramWebhook(app: Express) {
  app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
    if (ENV.telegramWebhookSecret && req.header("x-telegram-bot-api-secret-token") !== ENV.telegramWebhookSecret) {
      res.status(401).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true });
    try {
      const update = req.body;
      const message = update?.message;
      if (!message?.chat?.id) return;
      const chatId = String(message.chat.id);
      const vet = await getVeterinarianByTelegramChat(chatId);
      if (!vet) return;
      const rawText = message.text || message.caption;
      let text = rawText as string | undefined;
      let audioKey: string | undefined;
      if (!text && (message.voice || message.audio)) {
        const transcription = await transcribeTelegramVoice(message, chatId, vet.userId, vet.organizationId);
        text = transcription.text;
        audioKey = transcription.storageKey;
      }
      if (!text) return;
      await saveTelegramMessage({ telegramChatId: chatId, telegramMessageId: message.message_id, organizationId: vet.organizationId, veterinarianUserId: vet.userId, direction: "inbound", messageType: audioKey ? "voice" : "text", text, rawPayload: JSON.stringify(update) });
      await processText(chatId, text, vet, audioKey);
    } catch (error) {
      console.error("[Telegram] webhook error", error);
    }
  });
}
