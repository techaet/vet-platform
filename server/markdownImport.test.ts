import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdownImport";

describe("parseMarkdown", () => {
  it("identifies owner, animal and imported attendance", () => {
    const result = parseMarkdown(`# Proprietário: Maria da Silva
Telefone: 51999999999

## Endereço: Residência
Cidade: Marau
Logradouro: Rua Central
Número: 10

## Animal: Thor
Espécie: Canino
Raça: Golden Retriever

### Atendimento: 2024-03-15
Queixa principal: retorno clínico.
Conduta: acompanhamento.`);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Maria da Silva");
    expect(result[0]?.animals[0]?.name).toBe("Thor");
    expect(result[0]?.animals[0]?.records[0]?.date?.getUTCFullYear()).toBe(2024);
    expect(result[0]?.animals[0]?.records[0]?.content).toContain("retorno clínico");
  });
});
