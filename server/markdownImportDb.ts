import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { markdownImports, medicalRecords, ownerAddresses, owners, patients } from "../drizzle/schema";
import { parseMarkdown } from "./markdownImport";

export async function importMarkdownForOrganization(input: {
  userId: number;
  organizationId: number;
  fileName: string;
  content: string;
  sourceKey?: string;
  sourceUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const parsed = parseMarkdown(input.content);
  let ownersCreated = 0;
  let patientsCreated = 0;
  let recordsCreated = 0;
  const warnings: string[] = [];

  await db.transaction(async tx => {
    for (const ownerData of parsed) {
      if (!ownerData.name) { warnings.push("Proprietário sem nome ignorado"); continue; }
      let ownerRows = await tx.select().from(owners).where(and(eq(owners.organizationId, input.organizationId), eq(owners.name, ownerData.name))).limit(1);
      let owner = ownerRows[0];
      if (!owner) {
        const result = await tx.insert(owners).values({ organizationId: input.organizationId, name: ownerData.name, phone: ownerData.phone || null, email: ownerData.email || null });
        ownerRows = await tx.select().from(owners).where(eq(owners.id, Number(result[0].insertId))).limit(1);
        owner = ownerRows[0];
        ownersCreated += 1;
      }
      if (!owner) continue;

      if (ownerData.address) {
        const address = ownerData.address;
        const addressRows = await tx.select().from(ownerAddresses).where(and(eq(ownerAddresses.ownerId, owner.id), eq(ownerAddresses.street, address.logradouro || address.logradouro || ""), eq(ownerAddresses.number, address.número || address.numero || ""))).limit(1);
        if (!addressRows[0]) {
          await tx.insert(ownerAddresses).values({ organizationId: input.organizationId, ownerId: owner.id, label: address.label || "Residência", postalCode: address.cep || null, state: address.estado || null, city: address.cidade || null, neighborhood: address.bairro || null, street: address.logradouro || null, number: address.número || address.numero || null, complement: address.complemento || null, reference: address.referência || address.referencia || null, accessInstructions: address["instruções de acesso"] || address["instrucoes de acesso"] || null });
        }
      }

      for (const animalData of ownerData.animals) {
        let patientRows = await tx.select().from(patients).where(and(eq(patients.organizationId, input.organizationId), eq(patients.ownerId, owner.id), eq(patients.name, animalData.name))).limit(1);
        let patient = patientRows[0];
        if (!patient) {
          const result = await tx.insert(patients).values({ organizationId: input.organizationId, ownerId: owner.id, name: animalData.name, species: animalData.species || null, breed: animalData.breed || null, sex: animalData.sex || null, birthDate: animalData.birthDate || null, importSource: input.fileName });
          patientRows = await tx.select().from(patients).where(eq(patients.id, Number(result[0].insertId))).limit(1);
          patient = patientRows[0];
          patientsCreated += 1;
        }
        if (!patient) continue;

        for (const record of animalData.records) {
          const duplicate = await tx.select().from(medicalRecords).where(and(eq(medicalRecords.patientId, patient.id), eq(medicalRecords.sourceType, "markdown_import"), eq(medicalRecords.originalContent, record.content))).limit(1);
          if (duplicate[0]) continue;
          await tx.insert(medicalRecords).values({ organizationId: input.organizationId, patientId: patient.id, veterinarianUserId: input.userId, recordDate: record.date || null, title: record.title || "Atendimento importado", content: record.content, sourceType: "markdown_import", originalContent: record.content });
          recordsCreated += 1;
        }
      }
    }
    await tx.insert(markdownImports).values({ organizationId: input.organizationId, importedByUserId: input.userId, fileName: input.fileName, sourceKey: input.sourceKey || null, sourceUrl: input.sourceUrl || null, ownersCreated, patientsCreated, recordsCreated, warnings: warnings.length ? JSON.stringify(warnings) : null });
  });

  return { ownersCreated, patientsCreated, recordsCreated, warnings };
}
