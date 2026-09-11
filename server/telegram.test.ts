import { describe, expect, it } from "vitest";
import { parseTelegramCommand } from "./telegram";

describe("parseTelegramCommand", () => {
  it("separa comando e argumento preservando nomes compostos", () => {
    expect(parseTelegramCommand("/paciente  Maria da Silva")).toEqual({
      command: "/paciente",
      args: ["Maria", "da", "Silva"],
      argument: "Maria da Silva",
    });
  });

  it("aceita texto natural sem slash como uma única entrada", () => {
    expect(parseTelegramCommand("registrar atendimento Thor").command).toBe("registrar");
    expect(parseTelegramCommand("registrar atendimento Thor").argument).toBe("atendimento Thor");
  });
});
