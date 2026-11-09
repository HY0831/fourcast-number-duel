import { expect, test } from '@playwright/test'

test('Playgrove shows three playable games; Sudoku opens and returns to library', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {name: 'Fourcast'})).toBeVisible()
  await expect(page.getByRole('heading', {name: 'Sudoku'})).toBeVisible()
  await expect(page.getByText('03 GAMES AVAILABLE')).toBeVisible()
  await page.getByRole('button', {name: 'Play Sudoku'}).click()
  await expect(page).toHaveURL(/\/games\/sudoku$/)
  await expect(page.getByRole('heading', {name: 'Sudoku.'})).toBeVisible()
  await expect(page.getByRole('gridcell')).toHaveCount(81)
  await page.getByRole('button', {name: 'All games'}).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', {name: 'Play Fourcast'}).click()
  await expect(page).toHaveURL(/\/games\/fourcast$/)
  await expect(page.getByRole('heading', {name:/Crack the code/})).toBeVisible()
})

test('Sudoku Easy / Medium / Hard use distinct clue counts and no horizontal overflow', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height:844})
    await page.goto('/games/sudoku')
    await expect(page.locator('.sdk-board .sdk-cell')).toHaveCount(81)
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    expect(hasOverflow, `No horizontal overflow at ${width}px`).toBe(false)
  }
  await page.getByRole('button', {name:/Easy A gentle warm-up/}).click()
  await expect(page.locator('.sdk-cell.sdk-given')).toHaveCount(43)
  await page.getByRole('button', {name:/Medium Think a little deeper/}).click()
  await expect(page.locator('.sdk-cell.sdk-given')).toHaveCount(34)
  await page.getByRole('button', {name:/Hard A proper brain workout/}).click()
  await expect(page.locator('.sdk-cell.sdk-given')).toHaveCount(29)
})

test('Sudoku allows entry, notes, undo and progress persistence across navigation', async ({ page }) => {
  await page.goto('/games/sudoku')
  const cell = page.locator('.sdk-cell.sdk-editable').first()
  await cell.click()
  await page.getByRole('button', {name:'Notes'}).click()
  await page.getByRole('button', {name:'Digit 3'}).click()
  await expect(cell.locator('.sdk-cell-notes')).toContainText('3')
  await page.getByRole('button', {name:/Notes ON/}).click()
  await page.getByRole('button', {name:'Digit 4'}).click()
  await expect(cell).toHaveText('4')
  await page.getByRole('button', {name:'Undo'}).click()
  await expect(cell.locator('.sdk-cell-notes')).toContainText('3')
  await page.getByRole('button', {name:'Digit 4'}).click()
  await page.getByRole('button', {name:'All games'}).click()
  await page.getByRole('button', {name:'Play Sudoku'}).click()
  await expect(page.locator('.sdk-cell.sdk-editable').first()).toHaveText('4')
  await page.reload()
  await expect(page.locator('.sdk-cell.sdk-editable').first()).toHaveText('4')
})

test('Sudoku pause, hint, and new puzzle work correctly', async ({ page }) => {
  await page.goto('/games/sudoku')
  await page.getByRole('button', {name:'Pause'}).click()
  await expect(page.getByText('Puzzle paused')).toBeVisible()
  await expect(page.locator('.sdk-cell').first()).toBeDisabled()
  await page.getByRole('button', {name:/Resume puzzle/}).click()
  const initial = page.locator('.sdk-cell.sdk-editable').first()
  await initial.click()
  await page.getByRole('button', {name:'Hint'}).click()
  await expect(initial).toHaveAttribute('aria-label', /column \d+: [1-9]/)
  await page.getByRole('button', {name:'Undo'}).click()
  await expect(initial).toHaveAttribute('aria-label', /empty/)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', {name:/New puzzle/}).last().click()
  await expect(page.locator('.sdk-cell.sdk-given')).toHaveCount(43)
})

test('Sudoku completes with hints and displays the results', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/games/sudoku')
  for (let n=0;n<38;n++) await page.getByRole('button', {name:'Hint'}).click()
  await expect(page.getByText('You solved it!')).toBeVisible()
  await expect(page.getByText(/Best Easy time/)).toBeVisible()
  await page.getByRole('button', {name:/New puzzle/}).first().click()
  await expect(page.locator('.sdk-cell.sdk-given')).toHaveCount(43)
})
test('Sudoku filled rows and incorrect entries keep readable text on opaque highlights', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/games/sudoku')
  const row = page.locator('.sdk-board-row').first()
  const editable = row.locator('.sdk-cell.sdk-editable')
  const count = await editable.count()
  expect(count).toBeGreaterThan(0)

  // Fill every editable square in one row, including incorrect entries.
  for (let i = 0; i < count; i++) {
    await editable.nth(i).click()
    await page.getByRole('button', { name: 'Digit 1' }).click()
  }
  await expect(row.locator('.sdk-cell')).toHaveCount(9)
  await expect(row.locator('.sdk-cell.sdk-wrong').first()).toBeVisible()

  // Selecting an incorrect cell exercises the combined selected + wrong state.
  await row.locator('.sdk-cell.sdk-wrong').first().click()
  await expect(row.locator('.sdk-cell.sdk-selected.sdk-wrong')).toHaveCount(1)

  // Check actual computed colours rather than brittle CSS strings.
  const samples = await page.locator('.sdk-cell').evaluateAll(cells => cells
    .filter(cell => /: [1-9]/.test(cell.getAttribute('aria-label') ?? ''))
    .map(cell => {
      const style = getComputedStyle(cell)
      return { label: cell.getAttribute('aria-label'), background: style.backgroundColor, foreground: style.color }
    }))
  expect(samples.length).toBeGreaterThanOrEqual(43)

  const parse = (color: string) => {
    const values = color.match(/[\\d.]+/g)?.map(Number) ?? []
    if (values.length < 3) throw new Error(`Unexpected colour ${color}`)
    return { rgb: values.slice(0, 3), alpha: values.length > 3 ? values[3] : 1 }
  }
  const luminance = (rgb: number[]) => {
    const linear = rgb.map(v => {
      const x = v / 255
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    })
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  for (const sample of samples) {
    const background = parse(sample.background), foreground = parse(sample.foreground)
    expect(background.alpha, `Opaque background on ${sample.label}`).toBe(1)
    const a = luminance(background.rgb), b = luminance(foreground.rgb)
    const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    expect(contrast, `Contrast on ${sample.label}: ${sample.foreground} / ${sample.background}`).toBeGreaterThanOrEqual(4.5)
  }
})
