export const ASSERT_OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;

export type AssertOperator = (typeof ASSERT_OPERATORS)[number];

export const ASSERT_OPERATOR_NAMES_TEXT = ASSERT_OPERATORS.map((operator) => JSON.stringify(operator)).join(", ");

const ASSERT_OPERATOR_SET: ReadonlySet<string> = new Set(ASSERT_OPERATORS);

/** Type guard for supported assert operators. */
export function isAssertOperator(value: string): value is AssertOperator {
  return ASSERT_OPERATOR_SET.has(value);
}
