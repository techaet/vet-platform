import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function wrap(text: string, width = 92) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) { if ((current + " " + word).trim().length > width) { if (current) lines.push(current); current = word; } else current = `${current} ${word}`.trim(); }
  if (current) lines.push(current);
  return lines;
}

export async function buildPrescriptionPdf(input: { letterheadUrl?: string | null; patientName: string; ownerName: string; issuedAt: Date; content?: string | null; notes?: string | null; items?: Array<{ medication: string; concentration?: string | null; presentation?: string | null; dose?: string | null; route?: string | null; frequency?: string | null; duration?: string | null; quantity?: string | null; instructions?: string | null }> }) {
  let document: PDFDocument;
  if (input.letterheadUrl) {
    const response = await fetch(input.letterheadUrl);
    if (!response.ok) throw new Error("Não foi possível carregar a folha timbrada");
    document = await PDFDocument.load(await response.arrayBuffer());
  } else document = await PDFDocument.create();
  const page = document.getPages()[0] || document.addPage();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 90;
  const draw = (line: string, size = 11, isBold = false) => { if (y < 50) { page.drawText(line, { x: 50, y: height - 50, size, font: isBold ? bold : font, color: rgb(0.08, 0.08, 0.08) }); y = height - 68; } else { page.drawText(line, { x: 50, y, size, font: isBold ? bold : font, color: rgb(0.08, 0.08, 0.08) }); y -= size + 6; } };
  draw(`Paciente: ${input.patientName}`, 12, true);
  draw(`Proprietário: ${input.ownerName}`);
  draw(`Data do atendimento: ${input.issuedAt.toLocaleDateString("pt-BR")}`);
  y -= 8;
  draw("RECEITA", 13, true);
  for (const line of wrap(input.content || "")) draw(line);
  for (const item of input.items || []) { draw(`${item.medication}${item.concentration ? ` — ${item.concentration}` : ""}${item.presentation ? ` (${item.presentation})` : ""}`, 11, true); draw(`Dose: ${item.dose || "não informada"} · Via: ${item.route || "não informada"}`); draw(`Frequência: ${item.frequency || "não informada"} · Duração: ${item.duration || "não informada"} · Quantidade: ${item.quantity || "não informada"}`); if (item.instructions) draw(`Orientações: ${item.instructions}`); y -= 6; }
  if (input.notes) { y -= 6; draw(`Observações: ${input.notes}`); }
  y -= 20; draw("Assinatura: ________________________________________________");
  return Buffer.from(await document.save());
}
