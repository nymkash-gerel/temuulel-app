/**
 * Intent validation — checks if classified intent matches expected intent.
 */

export interface IntentValidation {
  valid: boolean
  actual: string
  expected: string | string[] | undefined
  reason: string
}

export function validateIntent(
  actual: string,
  expected?: string | string[],
): IntentValidation {
  if (!expected) {
    return { valid: true, actual, expected, reason: 'No expected intent specified' }
  }

  const acceptableIntents = Array.isArray(expected) ? expected : [expected]
  const valid = acceptableIntents.includes(actual)

  return {
    valid,
    actual,
    expected,
    reason: valid
      ? `Intent "${actual}" matches expected`
      : `Intent mismatch: got "${actual}", expected one of [${acceptableIntents.join(', ')}]`,
  }
}
