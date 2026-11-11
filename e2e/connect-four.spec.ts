import { expect, test, type Page } from '@playwright/test'

async function createAndJoin(page: Page, guest: Page) {
  await page.goto('/games/connect-four')
  await page.getByLabel('YOUR NICKNAME').fill('Alex')
  await page.getByRole('button', { name: 'Create Connect Four room' }).click()
  await expect(page.getByRole('heading', { name: 'Waiting for your friend.' })).toBeVisible()
  const code = (await page.locator('.c4-invite-code span').allTextContents()).join('')
  expect(code).toMatch(/^[A-Z0-9]{6}$/)
  await guest.goto(`/games/connect-four?room=${code}`)
  await expect(guest.getByLabel('6-CHARACTER ROOM CODE')).toHaveValue(code)
  await guest.getByLabel('YOUR NICKNAME').fill('Blair')
  await guest.getByRole('button', { name: 'Join Connect Four room' }).click()
  await expect(page.getByRole('heading', { name: 'The next move is yours.' })).toBeVisible()
  await expect(guest.getByRole('heading', { name: 'The next move is yours.' })).toBeVisible()
  await expect(page.getByText('Your turn — drop a disc!')).toBeVisible()
  await expect(guest.getByText('Alex is choosing')).toBeVisible()
  return code
}

async function play(page: Page, column: number, expectedMoves: number) {
  await page.getByRole('gridcell', { name: `Drop in column ${column+1}` }).click()
  await expect(page.getByText(`${expectedMoves} / 42 moves`)).toBeVisible()
}

test('Playgrove lists all five games and routes to Connect Four without breaking other games', async ({page}) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await expect(page.getByText('09 GAMES AVAILABLE')).toBeVisible()
  for (const title of ['Fourcast','Sudoku','Bingo Duel','Minesweeper','Connect Four']) {
    await expect(page.getByRole('heading', {name:title,exact:true})).toBeVisible()
  }
  await page.getByRole('button', {name:'Play Connect Four'}).click()
  await expect(page).toHaveURL(/\/games\/connect-four$/)
  await expect(page.getByRole('heading',{name:/Four in a row/})).toBeVisible()
  await page.getByRole('button',{name:'All games'}).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', {name:'Play Minesweeper'}).click()
  await expect(page.getByRole('heading',{name:'Minesweeper.'})).toBeVisible()
})

test('Connect Four uses mobile-friendly cells without horizontal overflow on phone and desktop', async ({page}) => {
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:850})
    await page.goto('/games/connect-four')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `Lobby overflow at ${width}`).toBe(false)
    await page.getByLabel('YOUR NICKNAME').fill('Alex')
    await page.getByRole('button',{name:'Create Connect Four room'}).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `Waiting overflow at ${width}`).toBe(false)
    await page.getByRole('button',{name:'Exit room'}).click()
    await expect(page.getByLabel('YOUR NICKNAME')).toBeVisible()
  }
})

test('two-player game enforces turns, gravity, reconnection, winning four and consensual rematch', async ({page,browser}) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()
  const guest = await context.newPage()
  try {
    const code=await createAndJoin(page,guest)
    await expect(page.locator('.c4-slot')).toHaveCount(42)
    await expect(guest.locator('.c4-slot')).toHaveCount(42)
    await expect(guest.getByRole('gridcell',{name:'Drop in column 1'})).toBeDisabled()
    await play(page,0,1)
    await expect(page.locator('.c4-column').first().locator('.c4-slot').last()).toHaveClass(/c4-slot-1/)
    await expect(guest.locator('.c4-column').first().locator('.c4-slot').last()).toHaveClass(/c4-slot-1/)
    await expect(page.getByRole('gridcell',{name:'Drop in column 2'})).toBeDisabled()
    await play(guest,0,2)
    await expect(page.locator('.c4-column').first().locator('.c4-slot').nth(4)).toHaveClass(/c4-slot-2/)
    // Leaving the game library never silently destroys the active room.
    page.once('dialog',dialog=>dialog.dismiss())
    await page.getByRole('button',{name:'All games'}).click()
    await expect(page).toHaveURL(/\/games\/connect-four$/)
    page.once('dialog',dialog=>dialog.accept())
    await page.getByRole('button',{name:'All games'}).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(guest.getByText('Waiting for reconnection')).toBeVisible()
    await expect(guest.getByRole('gridcell',{name:'Drop in column 4'})).toBeDisabled()
    await page.getByRole('button',{name:'Resume Connect Four'}).click()
    await expect(page.getByText('Your turn — drop a disc!')).toBeVisible()
    await expect(guest.getByText('Alex is choosing')).toBeVisible()
    await expect(page).toHaveURL(/\/games\/connect-four$/)
    // Seven moves: Player 1 bottom row columns 1, 2, 3, 4.
    await play(page,1,3)
    await play(guest,1,4)
    await play(page,2,5)
    await play(guest,2,6)
    await play(page,3,7)
    await expect(page.getByText('You connected four!')).toBeVisible()
    await expect(guest.getByText('Alex wins!')).toBeVisible()
    await expect(page.locator('.c4-slot-winning')).toHaveCount(4)
    await expect(guest.locator('.c4-slot-winning')).toHaveCount(4)
    await expect(page.locator('.c4-column').first()).toBeDisabled()
    await page.getByRole('button',{name:'Request rematch'}).click()
    await expect(page.getByRole('button',{name:/Waiting for friend/})).toBeDisabled()
    await expect(guest.getByText('Your friend is ready for a rematch.')).toBeVisible()
    await expect(guest.getByRole('heading',{name:'Round complete.'})).toBeVisible()
    await guest.getByRole('button',{name:'Request rematch'}).click()
    await expect(guest.getByText('Your turn — drop a disc!')).toBeVisible()
    await expect(page.getByText('Blair is choosing')).toBeVisible()
    await expect(guest.getByText('0 / 42 moves')).toBeVisible()
    await expect(guest.getByText(/ROOM [A-Z0-9]{6} · ROUND 2/)).toBeVisible()
    expect(code).toHaveLength(6)
  } finally {
    await context.close()
  }
})

test('room invitations and saved sessions resume after reload', async ({page,browser}) => {
  const context = await browser.newContext()
  const guest = await context.newPage()
  try {
    await createAndJoin(page, guest)
    await page.getByRole('gridcell',{name:'Drop in column 7'}).click()
    await expect(guest.getByText('1 / 42 moves')).toBeVisible()
    await guest.reload()
    await expect(guest.getByText('1 / 42 moves')).toBeVisible()
    await expect(guest.getByText('Your turn — drop a disc!')).toBeVisible()
    await play(guest,6,2)
    await expect(page.getByText('2 / 42 moves')).toBeVisible()
  } finally {
    await context.close()
  }
})
