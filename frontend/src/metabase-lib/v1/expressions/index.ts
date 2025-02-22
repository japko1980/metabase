export * from "./config";

import { FK_SYMBOL } from "metabase/lib/formatting";
import * as Lib from "metabase-lib";
import type { Expression } from "metabase-types/api";

import {
  EDITOR_FK_SYMBOLS,
  EDITOR_QUOTES,
  FUNCTIONS,
  OPERATORS,
  getMBQLName,
} from "./config";

// Return a copy with brackets (`[` and `]`) being escaped
function escapeString(string: string) {
  let str = "";
  for (let i = 0; i < string.length; ++i) {
    const ch = string[i];
    if (ch === "[" || ch === "]") {
      str += "\\";
    }
    str += ch;
  }
  return str;
}

// The opposite of escapeString
export function unescapeString(string: string) {
  let str = "";
  for (let i = 0; i < string.length; ++i) {
    const ch1 = string[i];
    const ch2 = string[i + 1];
    if (ch1 === "\\" && (ch2 === "[" || ch2 === "]")) {
      // skip
    } else {
      str += ch1;
    }
  }
  return str;
}

// IDENTIFIERS

// can be double-quoted, but are not by default unless they have non-word characters or are reserved
export function formatIdentifier(
  name: string,
  { quotes = EDITOR_QUOTES } = {},
) {
  if (
    !quotes.identifierAlwaysQuoted &&
    /^\w+$/.test(name) &&
    !isReservedWord(name)
  ) {
    return name;
  }
  return quoteString(name, quotes.identifierQuoteDefault);
}

function isReservedWord(word: string) {
  return !!getMBQLName(word);
}

// METRICS

export function parseMetric(
  metricName: string,
  { query, stageIndex }: { query: Lib.Query; stageIndex: number },
) {
  const metrics = Lib.availableMetrics(query, stageIndex);

  const metric = metrics.find(metric => {
    const displayInfo = Lib.displayInfo(query, stageIndex, metric);

    return displayInfo.displayName.toLowerCase() === metricName.toLowerCase();
  });

  if (metric) {
    return metric;
  }
}

export function formatMetricName(
  metricName: string,
  options: Record<string, any>,
) {
  return formatIdentifier(metricName, options);
}

// SEGMENTS
export function parseSegment(
  segmentName: string,
  { query, stageIndex }: { query: Lib.Query; stageIndex: number },
) {
  const segment = Lib.availableSegments(query, stageIndex).find(segment => {
    const displayInfo = Lib.displayInfo(query, stageIndex, segment);

    return displayInfo.displayName.toLowerCase() === segmentName.toLowerCase();
  });

  if (segment) {
    return segment;
  }

  const column = Lib.fieldableColumns(query, stageIndex).find(field => {
    const displayInfo = Lib.displayInfo(query, stageIndex, field);
    return displayInfo.name.toLowerCase() === segmentName.toLowerCase();
  });

  if (column && Lib.isBoolean(column)) {
    return column;
  }
}

export function formatSegmentName(
  segmentName: string,
  options: Record<string, any>,
) {
  return formatIdentifier(segmentName, options);
}

// DIMENSIONS

/**
 * Find dimension with matching `name` in query. TODO - How is this "parsing" a dimension? Not sure about this name.
 */
export function parseDimension(
  name: string,
  options: {
    query: Lib.Query;
    stageIndex: number;
    expressionIndex: number | undefined;
    startRule: string;
  },
) {
  return getAvailableDimensions(options).find(({ info }) => {
    return EDITOR_FK_SYMBOLS.symbols.some(separator => {
      const displayName = getDisplayNameWithSeparator(
        info.longDisplayName,
        separator,
      );

      return displayName === name;
    });
  })?.dimension;
}

function getAvailableDimensions({
  query,
  stageIndex,
  expressionIndex,
  startRule,
}: {
  query: Lib.Query;
  stageIndex: number;
  expressionIndex: number | undefined;
  startRule: string;
}) {
  const results = Lib.expressionableColumns(
    query,
    stageIndex,
    expressionIndex,
  ).map(dimension => {
    return {
      dimension,
      info: Lib.displayInfo(query, stageIndex, dimension),
    };
  });

  if (startRule === "aggregation") {
    return [
      ...results,
      ...Lib.availableMetrics(query, stageIndex).map(dimension => {
        return {
          dimension,
          info: Lib.displayInfo(query, stageIndex, dimension),
        };
      }),
    ];
  }

  return results;
}

export function formatDimensionName(
  dimensionName: string,
  options: Record<string, any>,
) {
  return formatIdentifier(getDisplayNameWithSeparator(dimensionName), options);
}

export function getDisplayNameWithSeparator(
  displayName: string,
  separator = EDITOR_FK_SYMBOLS.default,
) {
  return displayName.replace(` ${FK_SYMBOL} `, separator);
}

// STRING LITERALS

export function formatStringLiteral(
  mbqlString: string,
  { quotes = EDITOR_QUOTES }: Record<string, any> = {},
) {
  return quoteString(mbqlString, quotes.literalQuoteDefault);
}

const DOUBLE_QUOTE = '"';
const SINGLE_QUOTE = "'";
const BACKSLASH = "\\";

const STRING_ESCAPE: Record<string, string> = {
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
};

const STRING_UNESCAPE: Record<string, string> = {
  b: "\b",
  t: "\t",
  n: "\n",
  f: "\f",
  r: "\r",
};

export function quoteString(string: string, quote: string) {
  if (quote === DOUBLE_QUOTE || quote === SINGLE_QUOTE) {
    let str = "";
    for (let i = 0; i < string.length; ++i) {
      const ch = string[i];
      if (ch === quote && string[i - 1] !== BACKSLASH) {
        str += BACKSLASH + ch;
      } else {
        const sub = STRING_ESCAPE[ch];
        str += sub ? sub : ch;
      }
    }
    return quote + str + quote;
  } else if (quote === "[") {
    return "[" + escapeString(string) + "]";
  } else if (quote === "") {
    // unquoted
    return string;
  } else {
    throw new Error("Unknown quoting: " + quote);
  }
}

export function unquoteString(string: string) {
  const quote = string.charAt(0);
  if (quote === DOUBLE_QUOTE || quote === SINGLE_QUOTE) {
    let str = "";
    for (let i = 1; i < string.length - 1; ++i) {
      const ch = string[i];
      if (ch === BACKSLASH) {
        const seq = string[i + 1];
        const unescaped = STRING_UNESCAPE[seq];
        if (unescaped) {
          str += unescaped;
          ++i;
          continue;
        }
      }
      str += ch;
    }
    return str;
  } else if (quote === "[") {
    return unescapeString(string).slice(1, -1);
  } else {
    throw new Error("Unknown quoting: " + string);
  }
}

// move to query lib

export function isExpression(expr: unknown): expr is Expression {
  return (
    isLiteral(expr) ||
    isOperator(expr) ||
    isFunction(expr) ||
    isDimension(expr) ||
    isBooleanLiteral(expr) ||
    isMetric(expr) ||
    isSegment(expr) ||
    isCaseOrIf(expr)
  );
}

export function isLiteral(expr: unknown): boolean {
  return isStringLiteral(expr) || isNumberLiteral(expr);
}

export function isStringLiteral(expr: unknown): boolean {
  return typeof expr === "string";
}

export function isBooleanLiteral(expr: unknown): boolean {
  return typeof expr === "boolean";
}

export function isNumberLiteral(expr: unknown): boolean {
  return typeof expr === "number";
}

export function isOperator(expr: unknown): boolean {
  return (
    Array.isArray(expr) &&
    OPERATORS.has(expr[0]) &&
    expr.slice(1).every(arg => isExpression(arg) || isOptionsObject(arg))
  );
}

export function isOptionsObject(obj: unknown): boolean {
  return obj ? Object.getPrototypeOf(obj) === Object.prototype : false;
}

export function isFunction(expr: unknown): boolean {
  return (
    Array.isArray(expr) &&
    FUNCTIONS.has(expr[0]) &&
    expr.slice(1).every(arg => isExpression(arg) || isOptionsObject(arg))
  );
}

export function isDimension(expr: unknown): boolean {
  return (
    Array.isArray(expr) && (expr[0] === "field" || expr[0] === "expression")
  );
}

export function isMetric(expr: unknown): boolean {
  return (
    Array.isArray(expr) && expr[0] === "metric" && typeof expr[1] === "number"
  );
}

export function isSegment(expr: unknown): boolean {
  return (
    Array.isArray(expr) && expr[0] === "segment" && typeof expr[1] === "number"
  );
}

export function isCaseOrIfOperator(operator: string) {
  return operator === "case" || operator === "if";
}

export function isCaseOrIf(expr: unknown): boolean {
  return Array.isArray(expr) && isCaseOrIfOperator(expr[0]); // && _.all(expr.slice(1), isValidArg)
}

export function isOffset(expr: unknown): boolean {
  return Array.isArray(expr) && expr[0] === "offset";
}
