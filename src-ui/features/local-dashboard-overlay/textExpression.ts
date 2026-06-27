import { formatTelemetryValue } from "./telemetryFormat";

type ExpressionValue = string | number | boolean | null | undefined;

type Token =
  | { type: "value"; value: ExpressionValue }
  | { type: "operator"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "question" }
  | { type: "colon" };

const OPERATORS = [
  "===",
  "!==",
  ">=",
  "<=",
  "==",
  "!=",
  "&&",
  "||",
  "+",
  "-",
  "*",
  "/",
  "%",
  ">",
  "<",
  "!",
];

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const ch = expression[index];
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let value = "";
      let closed = false;
      index += 1;
      while (index < expression.length) {
        const current = expression[index];
        if (current === "\\") {
          const next = expression[index + 1];
          if (next === undefined)
            throw new Error("Unterminated string literal");
          value += next === "n" ? "\n" : next === "t" ? "\t" : next;
          index += 2;
        } else if (current === quote) {
          index += 1;
          closed = true;
          break;
        } else {
          value += current;
          index += 1;
        }
      }
      if (!closed) throw new Error("Unterminated string literal");
      tokens.push({ type: "value", value });
      continue;
    }
    if (/\d|\./.test(ch)) {
      const start = index++;
      while (index < expression.length && /[\d.]/.test(expression[index]))
        index += 1;
      const value = Number(expression.slice(start, index));
      if (!Number.isFinite(value)) throw new Error("Invalid number literal");
      tokens.push({ type: "value", value });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = index++;
      while (
        index < expression.length &&
        /[A-Za-z0-9_$]/.test(expression[index])
      )
        index += 1;
      const identifier = expression.slice(start, index);
      if (identifier === "true") tokens.push({ type: "value", value: true });
      else if (identifier === "false")
        tokens.push({ type: "value", value: false });
      else if (identifier === "null")
        tokens.push({ type: "value", value: null });
      else if (identifier === "undefined")
        tokens.push({ type: "value", value: undefined });
      else if (identifier === "NaN") tokens.push({ type: "value", value: NaN });
      else if (identifier === "Infinity")
        tokens.push({ type: "value", value: Infinity });
      else throw new Error(`Unknown identifier: ${identifier}`);
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      index += 1;
      continue;
    }
    if (ch === "?") {
      tokens.push({ type: "question" });
      index += 1;
      continue;
    }
    if (ch === ":") {
      tokens.push({ type: "colon" });
      index += 1;
      continue;
    }
    const operator = OPERATORS.find((candidate) =>
      expression.startsWith(candidate, index),
    );
    if (!operator) throw new Error(`Unexpected token: ${ch}`);
    tokens.push({ type: "operator", value: operator });
    index += operator.length;
  }
  return tokens;
}

const number = (value: ExpressionValue) => (value === null ? 0 : Number(value));
const truthy = (value: ExpressionValue) => Boolean(value);

class Parser {
  private index = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionValue {
    const value = this.conditional();
    if (this.peek()) throw new Error("Unexpected token at end of expression");
    return value;
  }

  private conditional(): ExpressionValue {
    const condition = this.logicalOr();
    if (this.peek()?.type !== "question") return condition;
    this.index += 1;
    const whenTrue = this.conditional();
    if (this.take()?.type !== "colon") throw new Error("Expected ':'");
    const whenFalse = this.conditional();
    return truthy(condition) ? whenTrue : whenFalse;
  }

  private logicalOr(): ExpressionValue {
    let value = this.logicalAnd();
    while (this.operator("||")) {
      const right = this.logicalAnd();
      value = truthy(value) ? value : right;
    }
    return value;
  }

  private logicalAnd(): ExpressionValue {
    let value = this.equality();
    while (this.operator("&&")) {
      const right = this.equality();
      value = truthy(value) ? right : value;
    }
    return value;
  }

  private equality(): ExpressionValue {
    let value = this.comparison();
    while (true) {
      if (this.operator("==")) {
        const right = this.comparison();
        value =
          value === right ||
          (value != null && right != null && number(value) === number(right));
      } else if (this.operator("!=")) {
        const right = this.comparison();
        value = !(
          value === right ||
          (value != null && right != null && number(value) === number(right))
        );
      } else if (this.operator("===")) value = value === this.comparison();
      else if (this.operator("!==")) value = value !== this.comparison();
      else return value;
    }
  }

  private comparison(): ExpressionValue {
    let value = this.additive();
    while (true) {
      if (this.operator(">")) value = number(value) > number(this.additive());
      else if (this.operator(">="))
        value = number(value) >= number(this.additive());
      else if (this.operator("<"))
        value = number(value) < number(this.additive());
      else if (this.operator("<="))
        value = number(value) <= number(this.additive());
      else return value;
    }
  }

  private additive(): ExpressionValue {
    let value = this.multiplicative();
    while (true) {
      if (this.operator("+")) {
        const right = this.multiplicative();
        value =
          typeof value === "string" || typeof right === "string"
            ? `${value ?? ""}${right ?? ""}`
            : number(value) + number(right);
      } else if (this.operator("-"))
        value = number(value) - number(this.multiplicative());
      else return value;
    }
  }

  private multiplicative(): ExpressionValue {
    let value = this.unary();
    while (true) {
      if (this.operator("*")) value = number(value) * number(this.unary());
      else if (this.operator("/")) value = number(value) / number(this.unary());
      else if (this.operator("%")) value = number(value) % number(this.unary());
      else return value;
    }
  }

  private unary(): ExpressionValue {
    if (this.operator("!")) return !truthy(this.unary());
    if (this.operator("-")) return -number(this.unary());
    if (this.operator("+")) return number(this.unary());
    const token = this.take();
    if (token?.type === "value") return token.value;
    if (token?.type === "paren" && token.value === "(") {
      const value = this.conditional();
      const close = this.take();
      if (close?.type !== "paren" || close.value !== ")")
        throw new Error("Expected ')'");
      return value;
    }
    throw new Error("Unexpected token");
  }

  private operator(value: string) {
    const token = this.peek();
    if (token?.type !== "operator" || token.value !== value) return false;
    this.index += 1;
    return true;
  }
  private peek() {
    return this.tokens[this.index];
  }
  private take() {
    return this.tokens[this.index++];
  }
}

function formatExpressionValue(
  value: unknown,
  format: string | undefined,
  _field: string,
): string {
  if (!format)
    return typeof value === "string" ? JSON.stringify(value) : String(value);
  const numeric = Number(value);
  // 小数精度格式 (如 "0.0", "0.00") — 仅文本表达式支持
  if (/^0\.(0+)$/.test(format) && Number.isFinite(numeric))
    return JSON.stringify(numeric.toFixed(format.length - 2));
  // 其余格式统一委托给 formatTelemetryValue（枚举、零补位、时间格式）
  return JSON.stringify(formatTelemetryValue(value, format));
}

export function evaluateTextExpression(
  expression: string,
  frame: Record<string, unknown>,
  valueField?: string,
  defaultFormat?: string,
): string {
  const normalized = expression
    .trim()
    .replace(/^(.+\?.+:\s*(?:""|''))\s*\+\s*(\{[^{}]+\})$/, "($1) + $2");
  const prepared = normalized.replace(
    /\{([^{}]+)\}/g,
    (_match, token: string) => {
      const [rawField, ...formatParts] = token.split("|");
      const field = rawField.trim() === "value" ? valueField : rawField.trim();
      if (!field) throw new Error("No telemetry field selected for {value}");
      const value = frame[field];
      const format = formatParts.join("|").trim() || defaultFormat;
      return formatExpressionValue(value, format, field);
    },
  );
  return String(new Parser(tokenize(prepared)).parse() ?? "");
}
