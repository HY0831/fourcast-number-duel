import { expect, test } from '@playwright/test'

test('Sudoku arrow navigation moves real keyboard focus and leaves other controls alone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/games/sudoku')
  const cells = page.locator('.sdk-cell')
  await expect(cells).toHaveCount(81)
  await cells.first().click()
  await cells.first().press('ArrowRight')
  await expect(cells.nth(1)).toBeFocused()
  await expect(cells.nth(1)).toHaveAttribute('aria-selected', 'true')
  const selected = await page.locator('.sdk-cell[aria-selected="true"]').getAttribute('aria-label')

  const newPuzzle = page.locator('.sdk-actions button').last()
  await newPuzzle.focus()
  await newPuzzle.press('ArrowDown')
  await expect(newPuzzle).toBeFocused()
  await expect(page.locator('.sdk-cell[aria-selected="true"]')).toHaveAttribute('aria-label', selected!)
  const digit = page.locator('.sdk-keypad button').first()
  expect((await digit.boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('2048 arrows do not hijack other focused controls; board moves announce score', async ({ page }) => {
  await page.goto('/games/2048')
  const board = page.locator('.t48-board')
  const newGame = page.locator('.t48-actions button').last()
  await newGame.focus()
  await newGame.press('ArrowLeft')
  await expect(newGame).toBeFocused()
  await expect(page.locator('.t48-control-header')).toContainText('0 moves')

  await board.focus()
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight']) await board.press(key)
  await expect(page.locator('.t48-control-header')).not.toContainText('0 moves')
  await expect(page.locator('.pg-sr-only[role="status"]')).toContainText(/Move \d+; score \d+; highest tile \d+/)
})

test('Minesweeper and Nonogram expose keyboard instructions, board progress and both clue axes', async ({ page }) => {
  await page.goto('/games/minesweeper')
  const mineBoard = page.getByRole('grid', { name: /Minesweeper board/ })
  await expect(mineBoard).toHaveAttribute('aria-describedby', 'msw-keyboard-help')
  await page.locator('.msw-cell').first().click()
  await expect(page.locator('.pg-sr-only[role="status"]')).toContainText(/safe squares revealed; \d+ flags placed/)

  await page.goto('/games/nonogram')
  const search = page.getByRole('textbox', { name: 'Search pictures' })
  await search.focus()
  const focusOutline = await page.locator('.ng-search').evaluate(element => getComputedStyle(element).outlineStyle)
  expect(focusOutline).not.toBe('none')
  await page.locator('.ng-start').first().click()
  const puzzleBoard = page.getByRole('grid', { name: /Nonogram board/ })
  await expect(puzzleBoard).toHaveAttribute('aria-describedby', 'ng-keyboard-help')
  const cells = page.locator('.ng-cell')
  await expect(cells.first()).toHaveAttribute('aria-label', /Row clues: .*Column clues:/)
  await cells.first().focus()
  await cells.first().press('ArrowRight')
  await expect(cells.nth(1)).toBeFocused()
})

test('Fourcast, Bingo Duel and Connect Four expose accessible selected-mode controls', async ({ page }) => {
  await page.goto('/games/fourcast')
  const fourcastModes = page.locator('.mode-choice')
  await expect(fourcastModes.first()).toHaveAttribute('aria-pressed', 'true')
  await fourcastModes.last().click()
  await expect(fourcastModes.last()).toHaveAttribute('aria-pressed', 'true')

  for (const path of ['/games/bingo', '/games/connect-four']) {
    await page.goto(path)
    const group = page.getByRole('group', { name: 'Room action' })
    const create = group.getByRole('button', { name: 'Create room' })
    const join = group.getByRole('button', { name: 'Join room' })
    await expect(create).toHaveAttribute('aria-pressed', 'true')
    await join.click()
    await expect(join).toHaveAttribute('aria-pressed', 'true')
    await expect(create).toHaveAttribute('aria-pressed', 'false')
  }
})

test('Connect Four exposes disc ownership in each column without changing existing move controls', async ({ page, browser }) => {
  test.setTimeout(90_000)
  const guestContext = await browser.newContext()
  const guest = await guestContext.newPage()
  try {
    await page.goto('/games/connect-four')
    await page.getByLabel('YOUR NICKNAME').fill('Alex')
    await page.getByRole('button', { name: 'Create Connect Four room' }).click()
    const roomCode = (await page.locator('.c4-invite-code span').allTextContents()).join('')
    await guest.goto(`/games/connect-four?room=${roomCode}`)
    await guest.getByLabel('YOUR NICKNAME').fill('Blair')
    await guest.getByRole('button', { name: 'Join Connect Four room' }).click()
    const column = page.getByRole('gridcell', { name: 'Drop in column 1' })
    await expect(column).toBeEnabled()
    await expect(column).toHaveAttribute('aria-describedby', 'c4-column-0-contents')
    await expect(page.locator('#c4-column-0-contents')).toContainText('Bottom to top: empty')
    await expect(page.locator('.c4-turn-banner')).toHaveAttribute('aria-live', 'polite')
    await column.click()
    await expect(page.locator('#c4-column-0-contents')).toContainText('player one')
  } finally {
    await guestContext.close().catch(() => {})
  }
})
