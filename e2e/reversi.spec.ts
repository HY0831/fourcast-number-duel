import {test,expect,type Page} from '@playwright/test'

async function createAndJoin(host:Page,guest:Page){
  await host.goto('/games/reversi')
  await host.getByLabel('YOUR NICKNAME').fill('Alex')
  await host.getByRole('button',{name:'Create Reversi room'}).click()
  await expect(host.getByRole('heading',{name:'Waiting for your friend.'})).toBeVisible()
  const code=(await host.locator('.rv-invite span').allTextContents()).join('')
  expect(code).toMatch(/^[A-Z0-9]{6}$/)
  await guest.goto('/games/reversi?room='+code)
  await expect(guest.getByLabel('6-CHARACTER ROOM CODE')).toHaveValue(code)
  await guest.getByLabel('YOUR NICKNAME').fill('Blair')
  await guest.getByRole('button',{name:'Join Reversi room'}).click()
  await expect(host.getByText('Your turn — place a disc!')).toBeVisible()
  await expect(guest.getByText('Alex is thinking')).toBeVisible()
  return code
}
const boardCells=(page:Page)=>page.locator('.rv-board .rv-cell')
const gameMove=(page:Page)=>page.locator('.rv-board-heading span').last()

test('Reversi is the ninth library game with its own 8x8 online room route',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await expect(page.getByText('09 GAMES AVAILABLE')).toBeVisible()
  await expect(page.locator('.pg-game-card:visible')).toHaveCount(9)
  await page.getByRole('button',{name:'Play Reversi'}).click()
  await expect(page).toHaveURL(/\/games\/reversi$/)
  await expect(page.getByRole('heading',{name:/Control the corners/})).toBeVisible()
  await expect(page.getByRole('button',{name:'Create Reversi room'})).toBeVisible()
  await page.getByRole('button',{name:'All games'}).click()
  await expect(page).toHaveURL(/\/$/)
  const filter=page.getByRole('group',{name:'Filter games by mode'})
  await filter.getByRole('button',{name:'Multiplayer'}).click()
  await expect(page.locator('.pg-game-card:visible')).toHaveCount(4)
  await expect(page.getByRole('heading',{name:'Reversi'})).toBeVisible()
  await filter.getByRole('button',{name:'Solo'}).click()
  await expect(page.locator('.pg-game-card:visible')).toHaveCount(5)
  await expect(page.getByRole('heading',{name:'Reversi'})).toBeHidden()
})
test('Reversi lobby and waiting room never overflow small mobile screens',async({page})=>{
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:850})
    await page.goto('/games/reversi')
    await expect(page.getByRole('heading',{name:/Control the corners/})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Lobby overflow at '+width).toBe(false)
    await page.getByLabel('YOUR NICKNAME').fill('Alex')
    await page.getByRole('button',{name:'Create Reversi room'}).click()
    await expect(page.getByLabel(/Room code [A-Z0-9]{6}/)).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Waiting page overflow at '+width).toBe(false)
    await page.getByRole('button',{name:'Exit room'}).click()
    await expect(page.getByRole('heading',{name:/Control the corners/})).toBeVisible()
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('reversi:session'))).toBeNull()
  }
})
test('active Reversi board and scores remain visible and playable from 320px phones to desktop',async({page,browser})=>{
  const context=await browser.newContext(),guest=await context.newPage()
  try{
    await createAndJoin(page,guest)
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:850})
      await expect(boardCells(page)).toHaveCount(64)
      await expect(page.locator('.rv-scoreboard')).toBeVisible()
      const layout=await page.evaluate(()=>{
        const board=document.querySelector('.rv-board')!.getBoundingClientRect()
        return {scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,
          boardWidth:board.width,right:board.right,left:board.left}
      })
      expect(layout.scrollWidth,'Page overflow at '+width).toBeLessThanOrEqual(layout.viewport+1)
      expect(layout.boardWidth).toBeGreaterThan(250)
      expect(layout.left,'Board left side must stay visible at '+width).toBeGreaterThanOrEqual(0)
      expect(layout.right,'Board right side must stay visible at '+width).toBeLessThanOrEqual(width+1)
    }
    await page.setViewportSize({width:320,height:780})
    await page.getByRole('gridcell',{name:'Row 3, column 4: Empty, legal move'}).click()
    await expect(gameMove(guest)).toContainText('1 moves')
  }finally{await context.close()}
})

test('two online players see the standard opening, legal moves, flips and enforced turns',async({page,browser})=>{
  const context=await browser.newContext(),guest=await context.newPage()
  try{
    await createAndJoin(page,guest)
    await expect(boardCells(page)).toHaveCount(64)
    await expect(boardCells(guest)).toHaveCount(64)
    await expect(page.locator('.rv-cell-legal')).toHaveCount(4)
    await expect(guest.locator('.rv-cell-legal')).toHaveCount(0)
    await expect(page.locator('.rv-score').first().locator('b')).toHaveText('2')
    await expect(page.locator('.rv-score').nth(1).locator('b')).toHaveText('2')
    const legal=page.getByRole('gridcell',{name:'Row 3, column 4: Empty, legal move'})
    await legal.click()
    await expect(gameMove(page)).toContainText('1 moves')
    await expect(page.locator('.rv-score').first().locator('b')).toHaveText('4')
    await expect(guest.locator('.rv-score').nth(1).locator('b')).toHaveText('1')
    await expect(page.locator('.rv-cell-legal')).toHaveCount(0)
    await expect(guest.locator('.rv-cell-legal')).toHaveCount(3)
    await expect(page.getByRole('gridcell',{name:/Row 1, column 1: Empty, not a legal move/})).toBeDisabled()
    await guest.locator('.rv-cell-legal').first().click()
    await expect(gameMove(page)).toContainText('2 moves')
    await expect(page.getByText('Your turn — place a disc!')).toBeVisible()
  }finally{await context.close()}
})
test('disconnect pauses Reversi, saved rooms resume after returning to library and after reload',async({page,browser})=>{
  const context=await browser.newContext(),guest=await context.newPage()
  try{
    await createAndJoin(page,guest)
    await page.getByRole('gridcell',{name:'Row 3, column 4: Empty, legal move'}).click()
    await expect(gameMove(guest)).toContainText('1 moves')
    await guest.reload()
    await expect(guest.getByText('Your turn — place a disc!')).toBeVisible()
    await expect(gameMove(guest)).toContainText('1 moves')
    // Cancelling navigation leaves the active match untouched.
    page.once('dialog',dialog=>dialog.dismiss())
    await page.getByRole('button',{name:'All games'}).click()
    await expect(page).toHaveURL(/\/games\/reversi$/)
    // Accepting the warning saves the seat; opponent must wait to reconnect.
    page.once('dialog',dialog=>dialog.accept())
    await page.getByRole('button',{name:'All games'}).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(guest.getByText('Waiting for reconnection')).toBeVisible()
    await expect(guest.locator('.rv-cell-legal')).toHaveCount(0)
    await page.getByRole('button',{name:'Resume Reversi'}).click()
    await expect(page).toHaveURL(/\/games\/reversi$/)
    await expect(gameMove(page)).toContainText('1 moves')
    await expect(guest.getByText('Your turn — place a disc!')).toBeVisible()
    await guest.locator('.rv-cell-legal').first().click()
    await expect(gameMove(page)).toContainText('2 moves')
  }finally{await context.close()}
})
test('full Reversi match ends by official rules, scores discs and allows consensual rematch',async({page,browser})=>{
  test.setTimeout(180_000)
  const context=await browser.newContext(),guest=await context.newPage()
  try{
    await createAndJoin(page,guest)
    let moves=0
    for(let step=1;step<=60;step++){
      if(await page.getByRole('heading',{name:'Round complete.'}).isVisible())break
      await expect.poll(async()=>await page.locator('.rv-cell-legal').count()+await guest.locator('.rv-cell-legal').count(),
        {message:'A player should have a legal move until the match ends'}).toBeGreaterThan(0)
      const player=await page.locator('.rv-cell-legal').count()?page:guest
      await player.locator('.rv-cell-legal').first().click()
      moves++
      await expect(gameMove(page)).toHaveText(new RegExp('^'+moves+' moves'))
    }
    expect(moves).toBeGreaterThan(15)
    await expect(page.getByRole('heading',{name:'Round complete.'})).toBeVisible()
    await expect(guest.getByRole('heading',{name:'Round complete.'})).toBeVisible()
    await expect(page.locator('.rv-score').first().locator('b')).not.toBeEmpty()
    await expect(page.getByRole('button',{name:'Request rematch'})).toBeEnabled()
    await page.getByRole('button',{name:'Request rematch'}).click()
    await expect(page.getByRole('button',{name:/Waiting for your friend/})).toBeDisabled()
    await expect(guest.getByText('Your friend is ready for a rematch.')).toBeVisible()
    await guest.getByRole('button',{name:'Request rematch'}).click()
    await expect(guest.getByText('Your turn — place a disc!')).toBeVisible()
    await expect(page.getByText('Blair is thinking')).toBeVisible()
    await expect(gameMove(page)).toHaveText(/0 moves/)
    await expect(page.getByText(/ROOM [A-Z0-9]{6} · ROUND 2/)).toBeVisible()
    await expect(page.locator('.rv-cell-legal')).toHaveCount(0)
    await expect(guest.locator('.rv-cell-legal')).toHaveCount(4)
  }finally{await context.close()}
})
test('Reversi room still works when browser localStorage is denied',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Storage blocked','SecurityError')}})
  })
  await page.goto('/games/reversi')
  await page.getByLabel('YOUR NICKNAME').fill('Private Player')
  await page.getByRole('button',{name:'Create Reversi room'}).click()
  await expect(page.getByRole('heading',{name:'Waiting for your friend.'})).toBeVisible()
})
