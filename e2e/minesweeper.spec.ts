import { expect, test, type Page } from '@playwright/test'

const STORAGE = 'playgrove:minesweeper:v1:'
const covered = (page: Page) => page.locator('.msw-cell.msw-covered')

async function savedGame(page: Page, level = 'easy') {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null') as {
    level:string; rows:number; cols:number; mines:number; status:string;
    field: number[] | null; flags:boolean[]; revealed:boolean[]; seconds:number;
  }, STORAGE + level)
}

test('Minesweeper remains available as Playgrove’s fourth game and is reachable without breaking other routes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('09 GAMES AVAILABLE')).toBeVisible()
  for (const name of ['Fourcast','Sudoku','Bingo Duel','Minesweeper']) {
    await expect(page.getByRole('heading',{name,exact:true})).toBeVisible()
  }
  await page.getByRole('button',{name:'Play Minesweeper'}).click()
  await expect(page).toHaveURL(/\/games\/minesweeper$/)
  await expect(page.getByRole('heading',{name:'Minesweeper.'})).toBeVisible()
  await expect(page.getByRole('gridcell')).toHaveCount(81)
  await page.getByRole('button',{name:'All games'}).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button',{name:'Play Sudoku'}).click()
  await expect(page.locator('.sdk-cell')).toHaveCount(81)
})

test('three classic difficulty sizes are scrollable and mobile has no horizontal page overflow', async ({ page }) => {
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({ width, height:844 })
    await page.goto('/games/minesweeper')
    await page.getByRole('button',{name:'Easy, 9 by 9, 10 mines'}).click()
    await expect(page.locator('.msw-cell')).toHaveCount(81)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),`Page overflow at ${width}px`).toBe(false)
    await page.getByRole('button',{name:'Medium, 16 by 16, 40 mines'}).click()
    await expect(page.locator('.msw-cell')).toHaveCount(256)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),`Medium overflow at ${width}px`).toBe(false)
    await page.getByRole('button',{name:'Hard, 30 by 16, 99 mines'}).click()
    await expect(page.locator('.msw-cell')).toHaveCount(480)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),`Hard overflow at ${width}px`).toBe(false)
    if (width <= 390) {
      const { scrollWidth, clientWidth } = await page.locator('.msw-scroll').evaluate(e=>({scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}))
      expect(scrollWidth).toBeGreaterThan(clientWidth)
    }
    await page.getByRole('button',{name:'Zoom in'}).click()
    await expect(page.locator('.msw-grid')).toHaveAttribute('data-zoom','large')
    await page.getByRole('button',{name:'Zoom out'}).click()
    await expect(page.locator('.msw-grid')).toHaveAttribute('data-zoom','regular')
  }
})

test('desktop right-click flags; mobile flag mode, safe first click, pause and local resume', async ({page}) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/games/minesweeper')
  const first = page.locator('.msw-cell').first()
  await first.click({button:'right'})
  await expect(first).toHaveAttribute('aria-label','Row 1, column 1: flagged')
  await expect(page.getByLabel('Estimated mines left')).toHaveText('9')
  await page.getByRole('button',{name:'Flag',exact:true}).click()
  await expect(page.getByRole('button',{name:'Flag',exact:true})).toHaveAttribute('aria-pressed','true')
  await first.click()
  await expect(first).toHaveAttribute('aria-label','Row 1, column 1: covered')
  await page.getByRole('button',{name:'Reveal',exact:true}).click()
  await first.click()
  await expect(first).toHaveAttribute('aria-label',/Row 1, column 1: (empty revealed|revealed \d+)/)
  const saved = await savedGame(page)
  expect(saved.status).toBe('playing')
  expect(saved.field).not.toBeNull()
  expect(saved.field![0]).toBe(0)
  for (const i of [0,1,9,10]) expect(saved.field![i]).not.toBe(-1)
  await page.getByRole('button',{name:'Pause',exact:true}).click()
  await expect(page.locator('.msw-pause-overlay strong')).toHaveText('Game paused')
  await expect(first).toBeDisabled()
  const pausedTime = await page.getByLabel('Elapsed time').textContent()
  await page.waitForTimeout(1250)
  await expect(page.getByLabel('Elapsed time')).toHaveText(pausedTime!)
  await page.getByRole('button',{name:'Resume game'}).click()
  await expect(first).toBeEnabled()
  const recorded = (await savedGame(page)).revealed.filter(Boolean).length
  await page.getByRole('button',{name:'All games'}).click()
  await page.getByRole('button',{name:'Play Minesweeper'}).click()
  await page.reload()
  const restored = await savedGame(page)
  expect(restored.revealed.filter(Boolean).length).toBe(recorded)
  await expect(first).toHaveAttribute('aria-label',/Row 1, column 1: (empty revealed|revealed \d+)/)
})

test('Minesweeper loss reveals mines; a new game can win without any flags', async ({page}) => {
  test.setTimeout(120_000)
  await page.goto('/games/minesweeper')
  await page.locator('.msw-cell').first().click()
  await expect(page.getByLabel('Estimated mines left')).toHaveText('10')
  const initial = await savedGame(page)
  expect(initial.field).not.toBeNull()
  const bomb = initial.field!.indexOf(-1)
  await page.locator('.msw-cell').nth(bomb).click()
  await expect(page.getByText('You hit a mine!')).toBeVisible()
  await expect(page.locator('.msw-cell.msw-exploded')).toHaveCount(1)
  await page.getByRole('button',{name:'Play again'}).click()
  await expect(page.locator('.msw-cell.msw-revealed')).toHaveCount(0)
  await page.locator('.msw-cell').first().click()
  const winning = await savedGame(page)
  const field = winning.field!
  for (let index=0; index<field.length; index++) {
    if (field[index] === -1) continue
    const cell = page.locator('.msw-cell').nth(index)
    const className = await cell.getAttribute('class') ?? ''
    if (className.includes('msw-covered')) await cell.click()
  }
  await expect(page.getByText('Field cleared. You win!')).toBeVisible()
  await expect(page.getByLabel('Estimated mines left')).toHaveText('10')
  await expect(page.getByText(/Best Easy time:/)).toBeVisible()
})

test('new game reset confirmation and independent saved levels', async ({page}) => {
  await page.goto('/games/minesweeper')
  await page.getByRole('button',{name:'Flag',exact:true}).click()
  await covered(page).first().click()
  await expect(page.getByLabel('Estimated mines left')).toHaveText('9')
  await page.getByRole('button',{name:'Medium, 16 by 16, 40 mines'}).click()
  await expect(page.getByLabel('Estimated mines left')).toHaveText('40')
  await page.getByRole('button',{name:'Easy, 9 by 9, 10 mines'}).click()
  await expect(page.getByLabel('Estimated mines left')).toHaveText('9')
  page.once('dialog',dialog=>dialog.dismiss())
  await page.getByRole('button',{name:'New Game'}).click()
  await expect(page.getByLabel('Estimated mines left')).toHaveText('9')
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'New Game'}).click()
  await expect(page.getByLabel('Estimated mines left')).toHaveText('10')
})
