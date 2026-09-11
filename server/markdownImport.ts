export type MarkdownRecord = {
  date?: Date;
  title?: string;
  content: string;
};

export type MarkdownAnimal = {
  name: string;
  species?: string;
  breed?: string;
  sex?: "male" | "female" | "unknown";
  birthDate?: Date;
  records: MarkdownRecord[];
};

export type MarkdownOwner = {
  name: string;
  phone?: string;
  email?: string;
  address?: Record<string, string>;
  animals: MarkdownAnimal[];
};

const normalizeLabel = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function field(line: string, ...labels: string[]) {
  const separator = line.indexOf(":");
  if (separator < 0) return undefined;
  const current = normalizeLabel(line.slice(0, separator));
  return labels.some(label => normalizeLabel(label) === current) ? line.slice(separator + 1).trim() || undefined : undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`) : undefined;
}

function parseSex(value?: string): MarkdownAnimal["sex"] {
  const normalized = normalizeLabel(value || "");
  if (["macho", "male", "masculino"].includes(normalized)) return "male";
  if (["femea", "female", "feminino"].includes(normalized)) return "female";
  if (normalized) return "unknown";
  return undefined;
}

function headingValue(line: string, pattern: RegExp) {
  const match = line.match(pattern);
  return match?.[1]?.trim() || undefined;
}

export function parseMarkdown(content: string): MarkdownOwner[] {
  const owners: MarkdownOwner[] = [];
  let owner: MarkdownOwner | undefined;
  let animal: MarkdownAnimal | undefined;
  let record: MarkdownRecord | undefined;
  let recordLines: string[] = [];
  let addressMode = false;

  const flushRecord = () => {
    if (record && animal) {
      record.content = recordLines.join("\n").trim();
      if (record.content) animal.records.push(record);
    }
    record = undefined;
    recordLines = [];
  };
  const flushAnimal = () => {
    flushRecord();
    if (owner && animal) owner.animals.push(animal);
    animal = undefined;
    addressMode = false;
  };
  const flushOwner = () => {
    flushAnimal();
    if (owner) owners.push(owner);
    owner = undefined;
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^#\s+Propriet[aá]rio\s*:/i.test(line)) {
      flushOwner();
      owner = { name: line.slice(line.indexOf(":") + 1).trim(), animals: [] };
      continue;
    }
    const address = headingValue(line, /^##\s+Endere[cç]o\s*:\s*(.*)$/i);
    if (address !== undefined) {
      if (owner) {
        addressMode = true;
        owner.address = { label: address || "Residência" };
      }
      continue;
    }
    const animalName = headingValue(line, /^##\s+Animal\s*:\s*(.*)$/i);
    if (animalName !== undefined) {
      if (owner) {
        flushAnimal();
        animal = { name: animalName, records: [] };
      }
      continue;
    }
    const attendance = headingValue(line, /^###\s+Atendimento\s*:\s*(.*)$/i);
    if (attendance !== undefined) {
      if (animal) {
        flushRecord();
        const [datePart, ...titleParts] = attendance.split(/\s+[—-]\s+/);
        record = { date: parseDate(datePart), title: titleParts.join(" — ") || "Atendimento importado", content: "" };
      }
      continue;
    }
    if (record) {
      recordLines.push(rawLine);
      continue;
    }
    if (!owner || !line) continue;

    const ownerPhone = field(line, "Telefone", "Celular", "WhatsApp");
    const ownerEmail = field(line, "E-mail", "Email");
    if (!animal) {
      if (ownerPhone) owner.phone = ownerPhone;
      if (ownerEmail) owner.email = ownerEmail;
      if (addressMode) {
        const mappings: Array<[string, string[]]> = [
          ["cep", ["CEP"]], ["estado", ["Estado", "UF"]], ["cidade", ["Cidade"]],
          ["bairro", ["Bairro"]], ["logradouro", ["Logradouro", "Rua"]], ["numero", ["Número", "Numero"]],
          ["complemento", ["Complemento"]], ["referencia", ["Referência", "Referencia"]],
          ["instrucoes de acesso", ["Instruções de acesso", "Instrucoes de acesso"]],
        ];
        for (const [key, labels] of mappings) {
          const value = field(line, ...labels);
          if (value) owner.address = { ...(owner.address || {}), [key]: value };
        }
      }
    } else {
      animal.species ||= field(line, "Espécie", "Especie");
      animal.breed ||= field(line, "Raça", "Raca");
      animal.sex ||= parseSex(field(line, "Sexo"));
      animal.birthDate ||= parseDate(field(line, "Nascimento", "Data de nascimento"));
    }
  }

  flushOwner();
  return owners.filter(item => item.name && item.animals.length > 0);
}

export const markdownImportExample = `# Proprietário: Maria da Silva
Telefone: 51999999999
E-mail: maria@example.com

## Endereço: Residência
Cidade: Marau
Logradouro: Rua Central
Número: 10

## Animal: Thor
Espécie: Canino
Raça: Golden Retriever
Sexo: Macho

### Atendimento: 2024-03-15 — Retorno clínico
Queixa principal: retorno clínico.
Conduta: acompanhamento.`;
