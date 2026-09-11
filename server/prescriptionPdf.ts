function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

export function buildPrescriptionPdf(input: {
  businessName?: string | null;
  professionalName?: string | null;
  registration?: string | null;
  phone?: string | null;
  professionalAddress?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  patientName: string;
  ownerName: string;
  issuedAt: Date;
  notes?: string | null;
  items: Array<{ medication: string; concentration?: string | null; presentation?: string | null; dose?: string | null; route?: string | null; frequency?: string | null; duration?: string | null; quantity?: string | null; instructions?: string | null }>;
}) {
  const lines = [
    input.businessName || "Receituário veterinário",
    input.professionalName || "Veterinário responsável",
    input.registration ? `Registro: ${input.registration}` : "",
    input.phone || "",
    input.professionalAddress || "",
    input.headerText || "",
    "",
    `Paciente: ${input.patientName}`,
    `Proprietário: ${input.ownerName}`,
    `Data: ${input.issuedAt.toLocaleDateString("pt-BR")}`,
    "",
    "PRESCRIÇÃO",
    ...input.items.flatMap((item, index) => [
      `${index + 1}. ${item.medication}${item.concentration ? ` — ${item.concentration}` : ""}${item.presentation ? ` (${item.presentation})` : ""}`,
      `Dose: ${item.dose || "não informada"} | Via: ${item.route || "não informada"}`,
      `Frequência: ${item.frequency || "não informada"} | Duração: ${item.duration || "não informada"} | Quantidade: ${item.quantity || "não informada"}`,
      item.instructions ? `Orientações: ${item.instructions}` : "",
      "",
    ]),
    input.notes ? `Observações: ${input.notes}` : "",
    "",
    "Assinatura: ________________________________________________",
    "",
    input.footerText || "Documento gerado pelo sistema veterinário.",
  ].filter(Boolean);

  const commands = ["BT", "/F1 11 Tf", "50 790 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("0 -18 Td");
    commands.push(`(${escapePdf(line)}) Tj`);
  });
  commands.push("ET");
  const content = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, "utf8"); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
