import { expect, test, type Page } from '@playwright/test'

const ascending=Array.from({length:25},(_,i)=>i+1)
const spread=(() => {
  const values=Array<number>(25).fill(0)
  ;[0,6,12,18].forEach((position,index)=>{values[position]=22+index})
  let n=1
  for(let i=0;i<25;i++)if(!values[i])values[i]=n++
  return values
})()
async function fillManualBoard(page: Page, layout: number[]) {
  for(const number of layout) await page.getByRole('button',{name:`Place ${number}`,exact:true}).click()
  await expect(page.getByText('25 / 25 filled')).toBeVisible()
}
async function callNumber(page: Page, n: number) {
  await page.getByRole('gridcell',{name:new RegExp(`: ${n}(,|$)`)}).click()
  await page.getByRole('button',{name:`Call number ${n}`}).click()
}

test('Playgrove lists Bingo and all three game routes still work', async ({page}) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await expect(page.getByText('03 GAMES AVAILABLE')).toBeVisible()
  await expect(page.getByRole('heading',{name:'Fourcast'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Sudoku'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Bingo Duel'})).toBeVisible()
  await page.getByRole('button',{name:'Play Bingo'}).click()
  await expect(page).toHaveURL(/\/games\/bingo$/)
  await expect(page.getByRole('heading',{name:/Five lines/})).toBeVisible()
  await page.getByRole('button',{name:'All games'}).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button',{name:'Play Sudoku'}).click()
  await expect(page.locator('.sdk-cell')).toHaveCount(81)
  await page.getByRole('button',{name:'All games'}).click()
  await page.getByRole('button',{name:'Play Fourcast'}).click()
  await expect(page.getByRole('heading',{name:/Crack the code/})).toBeVisible()
})

test('Bingo page and Playgrove library have no horizontal overflow at phone and desktop sizes',async ({page})=>{
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:850})
    await page.goto('/')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`Home overflow at ${width}`).toBe(false)
    await page.goto('/games/bingo')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`Bingo overflow at ${width}`).toBe(false)
  }
})

test('Bingo requires manual board entry, enforces unique numbers, calls both boards, determines winner and rematches',async ({page,browser})=>{
  test.setTimeout(180_000)
  const guestContext=await browser.newContext()
  const guest=await guestContext.newPage()
  try {
    await page.goto('/games/bingo')
    await page.getByLabel('YOUR NICKNAME').fill('Alex')
    await page.getByRole('button',{name:'Create Bingo room'}).click()
    await expect(page.getByRole('heading',{name:'Battle with a friend'})).toBeVisible()
    const room=(await page.locator('.bgo-invite-code span').allTextContents()).join('')
    expect(room).toMatch(/^[A-Z0-9]{6}$/)
    await guest.goto(`/games/bingo?room=${room}`)
    await expect(guest.getByLabel('6-CHARACTER ROOM CODE')).toHaveValue(room)
    await guest.getByLabel('YOUR NICKNAME').fill('Blair')
    await guest.getByRole('button',{name:'Join Bingo room'}).click()
    await expect(page.getByRole('heading',{name:'Build your board.'})).toBeVisible()
    await expect(guest.getByRole('heading',{name:'Build your board.'})).toBeVisible()
    await expect(page.locator('.bgo-cell')).toHaveCount(25)
    await expect(page.getByRole('button',{name:'Lock my board'})).toBeDisabled()
    // Player can pick any cell manually, not just follow a prescribed arrangement.
    await page.getByRole('gridcell',{name:/Row 2 column 5: empty/}).click()
    await page.getByRole('button',{name:'Place 1',exact:true}).click()
    await expect(page.getByRole('button',{name:'Place 1',exact:true})).toBeDisabled()
    await page.getByRole('gridcell',{name:/Row 2 column 5: 1/}).click()
    await page.getByRole('button',{name:'Clear cell'}).click()
    await expect(page.getByRole('button',{name:'Place 1',exact:true})).toBeEnabled()
    await page.getByRole('gridcell',{name:/Row 1 column 1: empty/}).click()
    await fillManualBoard(page,ascending)
    await page.getByRole('button',{name:'Lock my board'}).click()
    await expect(page.getByText('Your board is locked')).toBeVisible()
    await fillManualBoard(guest,spread)
    await guest.getByRole('button',{name:'Lock my board'}).click()
    await expect(page.getByText('Your turn — call a number!')).toBeVisible()
    await expect(guest.getByText('Alex is choosing')).toBeVisible()
    // Server view shows only each player's own layout during play.
    expect(await page.locator('.bgo-board .bgo-cell').allTextContents()).toHaveLength(25)
    await callNumber(page,1)
    await expect(page.getByRole('gridcell',{name:/Row 1 column 1: 1, called/})).toHaveClass(/bgo-marked/)
    await expect(guest.getByRole('gridcell',{name:/Row 1 column 2: 1, called/})).toHaveClass(/bgo-marked/)
    await expect(guest.getByText('Your turn — call a number!')).toBeVisible()
    // Leave to library pauses the game; session can be recovered.
    page.once('dialog',dialog=>dialog.accept())
    await page.getByRole('button',{name:'All games'}).click()
    await expect(page.getByRole('button',{name:'Resume Bingo'})).toBeVisible()
    await page.getByRole('button',{name:'Resume Bingo'}).click()
    await expect(page.getByRole('heading',{name:'The numbers are calling.'})).toBeVisible()
    for(let n=2;n<=21;n++){
      const p=n%2===0?guest:page
      await callNumber(p,n)
    }
    await expect(page.getByText('You got BINGO!')).toBeVisible()
    await expect(guest.getByText('Alex got BINGO!')).toBeVisible()
    await expect(page.getByText('5 lines',{exact:false}).first()).toBeVisible()
    await page.getByRole('button',{name:'Play another round'}).click()
    await expect(page.getByRole('heading',{name:'Build your board.'})).toBeVisible()
    await expect(guest.getByRole('heading',{name:'Build your board.'})).toBeVisible()
    await expect(page.getByText('0 / 25 filled')).toBeVisible()
    await expect(guest.getByText('0 / 25 filled')).toBeVisible()
  } finally {
    await guestContext.close()
  }
})


test('Bingo Random fills all numbers 1–25, asks before replacing manual entries, and stays editable', async ({page,browser}) => {
  await page.setViewportSize({width:320,height:800})
  const guestContext=await browser.newContext()
  const guest=await guestContext.newPage()
  try {
    await page.goto('/games/bingo')
    await page.getByLabel('YOUR NICKNAME').fill('Alex')
    await page.getByRole('button',{name:'Create Bingo room'}).click()
    const room=(await page.locator('.bgo-invite-code span').allTextContents()).join('')
    await guest.goto(`/games/bingo?room=${room}`)
    await guest.getByLabel('YOUR NICKNAME').fill('Blair')
    await guest.getByRole('button',{name:'Join Bingo room'}).click()
    await expect(page.getByRole('heading',{name:'Build your board.'})).toBeVisible()
    await expect(page.getByRole('button',{name:'Random'})).toBeVisible()

    // Manual placement is still supported, and Random never overwrites it without warning.
    await page.getByRole('button',{name:'Place 1',exact:true}).click()
    await expect(page.getByText('1 / 25 filled')).toBeVisible()
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button',{name:'Random'}).click()
    await expect(page.getByText('1 / 25 filled')).toBeVisible()

    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button',{name:'Random'}).click()
    await expect(page.getByText('25 / 25 filled')).toBeVisible()
    const values=await page.locator('.bgo-board .bgo-cell').allTextContents()
    expect(values.map(Number).sort((a,b)=>a-b)).toEqual(Array.from({length:25},(_,i)=>i+1))
    await expect(page.getByRole('button',{name:'Lock my board'})).toBeEnabled()

    // An automatically generated board can be edited manually before locking.
    const original=Number(values[0])
    await page.getByRole('gridcell',{name:new RegExp('Row 1 column 1: '+original+'$')}).click()
    await page.getByRole('button',{name:'Clear cell'}).click()
    await expect(page.getByText('24 / 25 filled')).toBeVisible()
    await expect(page.getByRole('button',{name:'Lock my board'})).toBeDisabled()
    await page.getByRole('button',{name:`Place ${original}`,exact:true}).click()
    await expect(page.getByText('25 / 25 filled')).toBeVisible()

    // Random boards use the existing draft persistence and server validation.
    await page.reload()
    await expect(page.getByText('25 / 25 filled')).toBeVisible()
    await expect(page.getByRole('button',{name:'Lock my board'})).toBeEnabled()
    await page.getByRole('button',{name:'Lock my board'}).click()
    await expect(page.getByText('Your board is locked')).toBeVisible()
    await expect(page.getByRole('button',{name:'Random'})).toHaveCount(0)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)

    // The opponent can independently randomize and lock a distinct board.
    await guest.getByRole('button',{name:'Random'}).click()
    await expect(guest.getByText('25 / 25 filled')).toBeVisible()
    await guest.getByRole('button',{name:'Lock my board'}).click()
    await expect(page.getByRole('heading',{name:'The numbers are calling.'})).toBeVisible()
  } finally {
    await guestContext.close()
  }
})
