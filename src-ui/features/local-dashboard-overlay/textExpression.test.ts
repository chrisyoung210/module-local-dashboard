import { describe, expect, it } from "vitest";
import { evaluateTextExpression } from "./textExpression";

describe("evaluateTextExpression — builtin functions", () => {
  it("1: abs(-3.5) => 3.5", () => {
    expect(evaluateTextExpression("abs(-3.5)", {})).toBe("3.5");
  });

  it("2: abs(0) => 0", () => {
    expect(evaluateTextExpression("abs(0)", {})).toBe("0");
  });

  it("3: abs(3.5) => 3.5", () => {
    expect(evaluateTextExpression("abs(3.5)", {})).toBe("3.5");
  });

  it("4: round(3.14159, 2) => 3.14", () => {
    expect(evaluateTextExpression("round(3.14159, 2)", {})).toBe("3.14");
  });

  it("5: round(3.14159, 0) => 3", () => {
    expect(evaluateTextExpression("round(3.14159, 0)", {})).toBe("3");
  });

  it("6: round(3.5, 0) => 4", () => {
    expect(evaluateTextExpression("round(3.5, 0)", {})).toBe("4");
  });

  it("7: round(3.4, 0) => 3", () => {
    expect(evaluateTextExpression("round(3.4, 0)", {})).toBe("3");
  });

  it("8: round(1234, 2) => 1234", () => {
    expect(evaluateTextExpression("round(1234, 2)", {})).toBe("1234");
  });

  it("9: round(2.5, 0) => 3", () => {
    expect(evaluateTextExpression("round(2.5, 0)", {})).toBe("3");
  });

  it("10: round(abs(-3.14159), 2) => 3.14 (nested)", () => {
    expect(evaluateTextExpression("round(abs(-3.14159), 2)", {})).toBe("3.14");
  });

  it("11: abs(round(-3.6, 0)) => 4 (reverse nested)", () => {
    expect(evaluateTextExpression("abs(round(-3.6, 0))", {})).toBe("4");
  });

  it("12: round({speedKmh}, 1) + \" km/h\"", () => {
    expect(
      evaluateTextExpression(
        'round({speedKmh}, 1) + " km/h"',
        { speedKmh: 164.389 },
      ),
    ).toBe("164.4 km/h");
  });

  it("13: abs({latG}) > 1.5 ? \"HIGH\" : \"ok\"", () => {
    expect(
      evaluateTextExpression(
        'abs({latG}) > 1.5 ? "HIGH" : "ok"',
        { latG: 2.1 },
      ),
    ).toBe("HIGH");
    expect(
      evaluateTextExpression(
        'abs({latG}) > 1.5 ? "HIGH" : "ok"',
        { latG: 1.2 },
      ),
    ).toBe("ok");
  });

  it("14: round({speedKmh}, 2) with NaN => NaN", () => {
    expect(
      evaluateTextExpression("round({speedKmh}, 2)", { speedKmh: NaN }),
    ).toBe("NaN");
  });

  it("15: unknownFn(1) throws Unknown function", () => {
    expect(() => evaluateTextExpression("unknownFn(1)", {})).toThrow(
      "Unknown function: unknownFn",
    );
  });

  it("16: abs(1, 2) throws Invalid arguments for abs", () => {
    expect(() => evaluateTextExpression("abs(1, 2)", {})).toThrow(
      "Invalid arguments for abs",
    );
  });

  it("17: round(1, -1) throws Invalid arguments for round: n must be >= 0", () => {
    expect(() => evaluateTextExpression("round(1, -1)", {})).toThrow(
      "Invalid arguments for round: n must be >= 0",
    );
  });

  it("tokenize no longer throws Unknown identifier for function names", () => {
    expect(evaluateTextExpression("abs(-3.5)", {})).toBe("3.5");
  });

  it("empty args list: round(3.14, 0) works", () => {
    expect(evaluateTextExpression("round(3.14, 0)", {})).toBe("3");
  });

  it("nested with ternary: abs({x}) > 10 ? round({x}, 0) : round({x}, 2)", () => {
    expect(
      evaluateTextExpression(
        "abs({x}) > 10 ? round({x}, 0) : round({x}, 2)",
        { x: -15.678 },
      ),
    ).toBe("-16");
    expect(
      evaluateTextExpression(
        "abs({x}) > 10 ? round({x}, 0) : round({x}, 2)",
        { x: -5.678 },
      ),
    ).toBe("-5.68");
  });

  it("existing expressions without functions still work", () => {
    expect(evaluateTextExpression("1 + 2 * 3", {})).toBe("7");
    expect(evaluateTextExpression('"hello" + " " + "world"', {})).toBe(
      "hello world",
    );
    expect(evaluateTextExpression("true ? 1 : 2", {})).toBe("1");
    expect(evaluateTextExpression("{speedKmh} > 100 ? 1 : 0", { speedKmh: 150 })).toBe(
      "1",
    );
  });
});
