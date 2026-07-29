/**
 * label-grouping.ts
 *
 * Pure utility function for splitting label arrays into groups based on a cut number.
 * Used by the PDF generator to create separate multi-page PDFs with cut marks between groups.
 *
 * Validates: Requirements 6.5, 6.6, 9.1, 9.2
 */

const MIN_CUT_NUMBER = 2
const MAX_CUT_NUMBER = 16

/**
 * Groups an array of items into chunks of the specified cut number.
 * The last chunk may have fewer items if total is not evenly divisible.
 *
 * @param items - Array of items to group
 * @param cutNumber - Size of each group (must be in [2, 16] range)
 * @returns Array of arrays (groups)
 * @throws Error if cutNumber is outside [2, 16] range
 */
export function groupLabels<T>(items: T[], cutNumber: number): T[][] {
  if (cutNumber < MIN_CUT_NUMBER || cutNumber > MAX_CUT_NUMBER) {
    throw new Error(
      `El número de corte debe estar entre ${MIN_CUT_NUMBER} y ${MAX_CUT_NUMBER}`
    )
  }

  const groups: T[][] = []

  for (let i = 0; i < items.length; i += cutNumber) {
    groups.push(items.slice(i, i + cutNumber))
  }

  return groups
}
