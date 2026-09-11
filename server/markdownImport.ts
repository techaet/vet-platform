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

const labels = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function valueAfterLabel(line: string, names: string[]) {
  const normalized = labels(line);
  const name = names.find(item => normalized.startsWith(`${labels(item)}:`));
  return name ? line.slice(line.indexOf(":") + 1).trim() : undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(/\b(\d{4})[-/](\d{2})[-/](\d{2})\b|\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
  if (!match) return undefined;
  const year = match[1] || match[6];
  const month = match[2] || match[5];
  const day = match[3] || match[4];
  return new Date(`${year}-${month}-${day}T12:00:00Z`);
}

function parseSex(value?: string): MarkdownAnimal["sex"] {
  if (!value) return undefined;
  const normalized = labels(value);
  if (["macho", "male", "masculino"].includes(normalized)) return "male";
  if (["femea", "female", "feminino"].includes(normalized)) return "female";
  return "unknown";
}

function headingValue(line: string, patterns: RegExp[]) {
  const pattern = patterns.find(item => item.test(line));
  return pattern ? line.slice(line.indexOf(":") + 1).trim() : undefined;
}

export function parseMarkdown(content: string): MarkdownOwner[] {
  const lines = content.split(/\r?\n/);
  const owners: MarkdownOwner[] = [];
  let owner: MarkdownOwner | undefined;
  let animal: MarkdownAnimal | undefined;
  let record: MarkdownRecord | undefined;
  let block: string[] = [];

  const ensureOwner = (name = "Proprietário não identificado") => {
    if (!owner) {
      owner = { name, animals: [] };
      owners.push(owner);
    }
    return owner;
  };
  const ensureAnimal = (name = "Animal não identificado") => {
    const currentOwner = ensureOwner();
    if (!animal) {
      animal = { name, records: [] };
      currentOwner.animals.push(animal);
    }
    return animal;
  };
  const flushRecord = () => {
    if (record && animal) {
      record.content = block.join("\n").trim();
      if (record.content) animal.records.push(record);
    }
    record = undefined;
    block = [];
  };
  const flushAnimal = () => { flushRecord(); animal = undefined; };
  const flushOwner = () => { flushAnimal(); owner = undefined; };
  const startRecord = (value: string, fallbackTitle = "Atendimento importado") => {
    const currentAnimal = ensureAnimal();
    flushRecord();
    const date = parseDate(value);
    const title = value.replace(/\b\d{4}[-/]\d{2}[-/]\d{2}\b|\b\d{2}[/-]\d{2}[/-]\d{4}\b/, "").replace(/^[\s—-]+|[\s—-]+$/g, "").trim();
    record = { date, title: title || fallbackTitle, content: "" };
    return currentAnimal;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { if (record) block.push(rawLine); continue; }

    const ownerName = headingValue(line, [/^#\s+Propriet[aá]rio\s*:/i, /^#\s+Proprietario\s*:/i, /^#\s+(?:Tutor|Dono)\s*:/i])
      || valueAfterLabel(line, ["Proprietário", "Proprietario", "Tutor", "Dono"]);
    if (ownerName) { flushOwner(); owner = { name: ownerName, animals: [] }; owners.push(owner); continue; }

    const animalName = headingValue(line, [/^##?\s+Animal\s*:/i, /^##?\s+Paciente\s*:/i, /^##?\s+Pet\s*:/i])
      || valueAfterLabel(line, ["Animal", "Paciente", "Pet"]);
    if (animalName) { flushAnimal(); ensureOwner(); animal = { name: animalName, records: [] }; owner!.animals.push(animal); continue; }

    const address = headingValue(line, [/^##\s+Endere[cç]o\s*:/i]);
    if (address) { ensureOwner().address = { label: address || "Residência" }; continue; }

    const recordHeading = headingValue(line, [/^###?\s+(?:Atendimento|Consulta|Retorno)\s*:/i]);
    const looseDate = line.match(/\b(?:consulta|atendimento|retorno)\b[^\d]*(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/i);
    if (recordHeading || looseDate) {
      startRecord(recordHeading || looseDate?.[1] || line, looseDate ? "Consulta importada" : undefined);
      if (looseDate?.index !== undefined) {
        const sameLineContent = line.slice(looseDate.index + looseDate[0].length).replace(/^\s*[:—-]\s*/, "").trim();
        if (sameLineContent) block.push(sameLineContent);
      }
      continue;
    }

    if (!owner && /\b(?:tutor|propriet[aá]rio|dono)\b/i.test(line)) { ensureOwner(); }
    if (!animal && /\b(?:animal|paciente|pet)\b/i.test(line)) {
      const mentioned = line.match(/(?:animal|paciente|pet)\s*[:=-]?\s*([A-ZÀ-Ú][\wÀ-ú-]+)/i)?.[1];
      ensureAnimal(mentioned);
    }

    const currentOwner = owner;
    if (record) { block.push(rawLine); continue; }
    if (currentOwner && !animal) {
      currentOwner.phone ||= valueAfterLabel(line, ["Telefone", "Celular", "WhatsApp"]);
      currentOwner.email ||= valueAfterLabel(line, ["E-mail", "Email"]);
      if (currentOwner.address) {
        for (const label of ["CEP", "Estado", "Cidade", "Bairro", "Logradouro", "Número", "Numero", "Complemento", "Referência", "Referencia", "Instruções de acesso", "Instrucoes de acesso"]) {
          const value = valueAfterLabel(line, [label]);
          if (value) currentOwner.address[labels(label)] = value;
        }
      }
    } else if (animal) {
      animal.species ||= valueAfterLabel(line, ["Espécie", "Especie"]) || line.match(/\b(canino|felino|c[aã]o|gato)\b/i)?.[1];
      animal.breed ||= valueAfterLabel(line, ["Raça", "Raca"]);
      animal.sex ||= parseSex(valueAfterLabel(line, ["Sexo"]));
      animal.birthDate ||= parseDate(valueAfterLabel(line, ["Nascimento", "Data de nascimento"]));
      const date = parseDate(line);
      if (date && !record) startRecord(line, "Consulta importada");
    }
  }
  flushOwner();
  return owners;
}
