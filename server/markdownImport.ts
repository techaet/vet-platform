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

function field(lines: string[], label: string) {
  const line = lines.find(item => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line?.slice(line.indexOf(":") + 1).trim() || undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`) : undefined;
}

function parseSex(value?: string): MarkdownAnimal["sex"] {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (["macho", "male", "masculino"].includes(normalized)) return "male";
  if (["fêmea", "femea", "female", "feminino"].includes(normalized)) return "female";
  return "unknown";
}

export function parseMarkdown(content: string): MarkdownOwner[] {
  const lines = content.split(/\r?\n/);
  const owners: MarkdownOwner[] = [];
  let owner: MarkdownOwner | undefined;
  let animal: MarkdownAnimal | undefined;
  let record: MarkdownRecord | undefined;
  let block: string[] = [];

  const flushRecord = () => {
    if (!record || !animal) return;
    record.content = block.join("\n").trim();
    if (record.content) animal.records.push(record);
    record = undefined;
    block = [];
  };
  const flushAnimal = () => {
    flushRecord();
    if (owner && animal) owner.animals.push(animal);
    animal = undefined;
  };
  const flushOwner = () => {
    flushAnimal();
    if (owner) owners.push(owner);
    owner = undefined;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^#\s+Proprietário\s*:/i.test(line) || /^#\s+Proprietario\s*:/i.test(line)) {
      flushOwner();
      owner = { name: line.slice(line.indexOf(":") + 1).trim(), animals: [] };
      continue;
    }
    if (/^##\s+Endereço\s*:/i.test(line) || /^##\s+Endereco\s*:/i.test(line)) {
      if (!owner) continue;
      owner.address = { label: line.slice(line.indexOf(":") + 1).trim() || "Residência" };
      continue;
    }
    if (/^##\s+Animal\s*:/i.test(line)) {
      if (!owner) continue;
      flushAnimal();
      animal = { name: line.slice(line.indexOf(":") + 1).trim(), records: [] };
      continue;
    }
    if (/^###\s+Atendimento\s*:/i.test(line)) {
      if (!animal) continue;
      flushRecord();
      const value = line.slice(line.indexOf(":") + 1).trim();
      const [datePart, ...titleParts] = value.split(/\s+[—-]\s+/);
      record = { date: parseDate(datePart), title: titleParts.join(" — ") || "Atendimento importado", content: "" };
      continue;
    }
    if (record) block.push(rawLine);
    else if (owner && !animal) {
      const ownerLines = [rawLine];
      owner.phone ||= field(ownerLines, "Telefone");
      owner.email ||= field(ownerLines, "E-mail") || field(ownerLines, "Email");
      if (owner.address) {
        for (const label of ["CEP", "Estado", "Cidade", "Bairro", "Logradouro", "Número", "Numero", "Complemento", "Referência", "Referencia", "Instruções de acesso", "Instrucoes de acesso"]) {
          const value = field(ownerLines, label);
          if (value) owner.address[label.toLowerCase()] = value;
        }
      }
    } else if (animal) {
      const animalLines = [rawLine];
      animal.species ||= field(animalLines, "Espécie") || field(animalLines, "Especie");
      animal.breed ||= field(animalLines, "Raça") || field(animalLines, "Raca");
      animal.sex ||= parseSex(field(animalLines, "Sexo"));
      animal.birthDate ||= parseDate(field(animalLines, "Nascimento"));
    }
  }
  flushOwner();
  return owners;
}
