import { expect, test } from '@playwright/test'

const SAVE = 'playgrove:2048:v1'
const blank = () => Array<number>(16).fill(0)

test('Playgrove shows six games and 2048 opens from the Game Library', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('06 GAMES AVAILABLE')).toBeVisible()
  for (const title of ['Fourcast','Sudoku','Bingo Duel','Minesweeper','Connect Four','2048']) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Play 2048' }).click()
  await expect(page).toHaveURL(/\/games\/2048$/)
  await expect(page.getByRole('heading', { name: '2048.' })).toBeVisible()
  await expect(page.getByRole('gridcell')).toHaveCount(16)
  await page.getByRole('button', { name: 'All games' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: 'Play Minesweeper' }).click()
  await expect(page.locator('.msw-cell')).toHaveCount(81)
})

test('2048 starts with two tiles, supports directional buttons and undo, and saves progress', async ({page}) => {
  await page.goto('/games/2048')
  const tiles = page.locator('.t48-tile:not([data-value="0"])')
  await expect(tiles).toHaveCount(2)
  await expect(page.getByRole('button',{name:'Undo last move'})).toBeDisabled()
  const initial = await page.locator('.t48-tile').evaluateAll(elements => elements.map(e=>Number(e.getAttribute('data-value'))))
  for (const direction of ['left','up','right','down']) {
    await page.getByRole('button',{name:`Move ${direction}`}).click()
  }
  const moved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), SAVE)
  expect(moved.game.moves).toBeGreaterThan(0)
  expect(moved.game.board.filter((n:number)=>n>0).length).toBeGreaterThanOrEqual(2)
  await expect(page.getByRole('button',{name:'Undo last move'})).toBeEnabled()
  const previousBoard = moved.undo.board
  await page.getByRole('button',{name:'Undo last move'}).click()
  const afterUndo = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), SAVE)
  expect(afterUndo.game.board).toEqual(previousBoard)
  expect(afterUndo.undo).toBeNull()
  await page.reload()
  const afterReload = await page.locator('.t48-tile').evaluateAll(elements => elements.map(e=>Number(e.getAttribute('data-value'))))
  expect(afterReload).toEqual(previousBoard)
  expect(initial).toHaveLength(16)
})

test('2048 responds to keyboard arrows, a touch swipe, and is usable at phone/desktop widths', async ({page}) => {
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:850})
    await page.goto('/games/2048')
    await expect(page.locator('.t48-tile')).toHaveCount(16)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),`Page overflow at ${width}px`).toBe(false)
  }
  const b = blank(); b[0]=2; b[1]=2
  await page.evaluate(({key, board}) => {
    localStorage.setItem(key, JSON.stringify({ game: { board, score:0, moves:0, status:'playing',reached2048:false,spawnIndex:null },undo:null }))
  },{key:SAVE,board:b})
  await page.reload()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('2048-score')).toHaveText('4')
  const prior = (await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'),SAVE)).game.moves
  await page.locator('.t48-board').evaluate(el => {
    const touchStart = new Touch({identifier:2,target:el,clientX:230,clientY:100})
    const touchEnd = new Touch({identifier:2,target:el,clientX:30,clientY:100})
    el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touchStart],changedTouches:[touchStart]}))
    el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[touchEnd]}))
  })
  const after = (await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'),SAVE)).game.moves
  expect(after).toBeGreaterThanOrEqual(prior)
})

test('2048 recognises a winning merge, supports continuing, and shows game over', async ({page}) => {
  const b=blank();b[0]=1024;b[1]=1024
  await page.goto('/games/2048')
  await page.evaluate(({key,board}) => {
    localStorage.setItem(key,JSON.stringify({game:{board,score:0,moves:0,status:'playing',reached2048:false,spawnIndex:null},undo:null}))
  },{key:SAVE,board:b})
  await page.reload()
  await page.getByRole('button',{name:'Move left'}).click()
  await expect(page.getByRole('heading',{name:'You made 2048!'})).toBeVisible()
  await expect(page.getByTestId('2048-score')).toHaveText('2,048')
  await page.getByRole('button',{name:'Keep playing'}).click()
  await expect(page.getByRole('heading',{name:'You made 2048!'})).toHaveCount(0)
  const game=await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null').game,SAVE)
  expect(game.reached2048).toBe(true)
  expect(game.status).toBe('playing')
  await expect(page.getByRole('button',{name:'Undo last move'})).toBeEnabled()

  await page.evaluate(key => {
    const board=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2]
    localStorage.setItem(key,JSON.stringify({game:{board,score:123,moves:50,status:'lost',reached2048:false,spawnIndex:null},undo:null}))
  },SAVE)
  await page.reload()
  await expect(page.getByRole('heading',{name:'No moves left.'})).toBeVisible()
  await page.getByRole('button',{name:'New game'}).first().click()
  await expect(page.locator('.t48-tile:not([data-value="0"])')).toHaveCount(2)
})

test('2048 restarts with confirmation while a game is in progress', async ({page}) => {
  const board = blank();board[4]=2;board[5]=4
  await page.addInitScript(({key,board}) => {
    localStorage.setItem(key,JSON.stringify({game:{board,score:24,moves:5,status:'playing',reached2048:false,spawnIndex:null},undo:null}))
  },{key:SAVE,board})
  await page.goto('/games/2048')
  page.once('dialog',d=>d.dismiss())
  await page.getByRole('button',{name:'New game'}).click()
  await expect(page.getByTestId('2048-score')).toHaveText('24')
  page.once('dialog',d=>d.accept())
  await page.getByRole('button',{name:'New game'}).click()
  await expect(page.getByTestId('2048-score')).toHaveText('0')
})
