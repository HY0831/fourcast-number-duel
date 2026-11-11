import {test,expect,type Page} from '@playwright/test'
import {PUZZLES} from '../client/src/games/hashi/puzzle-library.mjs'
import {edgesCross} from '../client/src/games/hashi/hashi-engine.mjs'

const bridge=(page:Page,index:number)=>page.locator('.hb-edge-group').nth(index)
async function activateBridge(page:Page,index:number,times=1) {
  for(let i=0;i<times;i++){await bridge(page,index).focus();await page.keyboard.press('Enter')}
}
const start=async(page:Page,title='First Crossing')=>{
  await page.goto('/games/hashi')
  await page.getByRole('button',{name:'Play '+title}).click()
  await expect(page.getByRole('heading',{name:title+'.'})).toBeVisible()
}
test('Playgrove discovers its eighth game and the curated 45-puzzle gallery',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await expect(page.getByText('08 GAMES AVAILABLE')).toBeVisible()
  await expect(page.locator('.pg-game-card:visible')).toHaveCount(8)
  await page.getByRole('button',{name:'Play Hashi'}).click()
  await expect(page).toHaveURL(/\/games\/hashi$/)
  await expect(page.getByRole('heading',{name:'Hashi: Bridges.'})).toBeVisible()
  await expect(page.locator('.hb-puzzle-card')).toHaveCount(45)
  await expect(page.getByText('0 / 45 completed')).toBeVisible()
  await page.getByRole('button',{name:'All games'}).click()
  await expect(page).toHaveURL(/\/$/)
})
test('45 curated puzzles split into three groups of 15 with search and difficulty filters',async({page})=>{
  await page.goto('/games/hashi')
  for(const level of ['Easy','Medium','Hard']){
    await page.getByRole('group',{name:'Difficulty filter'}).getByRole('button',{name:level}).click()
    await expect(page.locator('.hb-puzzle-card')).toHaveCount(15)
  }
  await page.getByRole('group',{name:'Difficulty filter'}).getByRole('button',{name:'All'}).click()
  await page.getByRole('searchbox',{name:'Search puzzles'}).fill('Master Navigator')
  await expect(page.locator('.hb-puzzle-card')).toHaveCount(1)
  await expect(page.getByRole('heading',{name:'Master Navigator'})).toBeVisible()
  await page.getByRole('searchbox',{name:'Search puzzles'}).fill('unlistedxxxx')
  await expect(page.getByText('No puzzles found.')).toBeVisible()
  await page.getByRole('button',{name:'Clear filters'}).click()
  await expect(page.locator('.hb-puzzle-card')).toHaveCount(45)
})
test('tap islands, keyboard bridge activation, undo, redo, no-bridge marks and progress recovery',async({page})=>{
  await start(page)
  const p=PUZZLES[0]
  await expect(page.locator('.hb-island')).toHaveCount(p.islands.length)
  await expect(page.locator('.hb-edge-group')).toHaveCount(p.edges.length)
  await page.locator('.hb-island').nth(p.edges[0].a).click()
  await page.locator('.hb-island').nth(p.edges[0].b).click()
  await expect(bridge(page,0)).toHaveAttribute('aria-label',/1 of 2 bridges/)
  await activateBridge(page,0)
  await expect(bridge(page,0)).toHaveAttribute('aria-label',/2 of 2 bridges/)
  await page.getByRole('button',{name:'Undo'}).click()
  await expect(bridge(page,0)).toHaveAttribute('aria-label',/1 of 2 bridges/)
  await page.getByRole('button',{name:'Redo'}).click()
  await expect(bridge(page,0)).toHaveAttribute('aria-label',/2 of 2 bridges/)
  await page.getByRole('button',{name:'No bridge'}).click()
  const other=p.edges.findIndex((_,i)=>i!==0)
  await activateBridge(page,other)
  await expect(bridge(page,other)).toHaveAttribute('aria-label',/marked unavailable/)
  await page.reload()
  await expect(page.getByRole('heading',{name:'First Crossing.'})).toBeVisible()
  await expect(bridge(page,0)).toHaveAttribute('aria-label',/2 of 2 bridges/)
  await expect(bridge(page,other)).toHaveAttribute('aria-label',/marked unavailable/)
  await page.getByRole('button',{name:'Puzzle collection'}).click()
  await expect(page.getByRole('button',{name:'Resume First Crossing'})).toBeVisible()
})
test('crossing bridges cannot be placed and Check reports island overload',async({page})=>{
  const puzzle=PUZZLES.find(p=>p.edges.some((_,i)=>p.edges.some((_,j)=>i!==j&&edgesCross(p,i,j))))!
  const a=puzzle.edges.findIndex((_,i)=>puzzle.edges.some((_,j)=>i!==j&&edgesCross(p,i,j)))
  const b=puzzle.edges.findIndex((_,j)=>j!==a&&edgesCross(p,a,j))
  await start(page,puzzle.title)
  await activateBridge(page,a)
  await activateBridge(page,b)
  await expect(bridge(page,b)).toHaveAttribute('aria-label',/0 of 2 bridges/)
  await expect(page.getByText(/cannot cross another bridge/)).toBeVisible()
  await page.getByRole('button',{name:'Check'}).click()
  await expect(page.locator('.hb-message')).toBeVisible()
})
test('hints, pause, zoom, restart confirmation and corrupt save fallback',async({page})=>{
  await start(page)
  await page.getByRole('button',{name:'Hint (3)'}).click()
  await expect(page.getByRole('button',{name:'Hint (2)'})).toBeVisible()
  await page.getByRole('button',{name:'Pause'}).click()
  await expect(page.getByText('Timer paused. Resume to continue.')).toBeVisible()
  await expect(page.getByRole('button',{name:'Check'})).toBeDisabled()
  await page.getByRole('button',{name:'Resume'}).click()
  await page.getByRole('button',{name:'Zoom in'}).click()
  await expect(page.locator('.hb-board')).toHaveAttribute('data-zoom','1.2')
  page.once('dialog',dialog=>dialog.dismiss())
  await page.getByRole('button',{name:'Restart'}).click()
  await expect(page.getByRole('button',{name:'Hint (2)'})).toBeVisible()
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'Restart'}).click()
  await expect(page.getByRole('button',{name:'Hint (3)'})).toBeVisible()
  await page.evaluate(()=>localStorage.setItem('playgrove:hashi:v1:E01',JSON.stringify({id:'E01',bridges:[99],marks:[true]})))
  await page.reload()
  await expect(page.getByRole('button',{name:'Hint (3)'})).toBeVisible()
  await expect(bridge(page,0)).toHaveAttribute('aria-label',/0 of 2 bridges/)
})
test('fully solving a real fixed puzzle records completion and a best time',async({page})=>{
  const p=PUZZLES.find(p=>p.id==='E15')!
  await start(page,p.title)
  for(let i=0;i<p.solution.length;i++)if(p.solution[i])await activateBridge(page,i,p.solution[i])
  await expect(page.getByRole('heading',{name:'Every island connected!'})).toBeVisible()
  await expect(page.getByText(/You solved The Crossing/)).toBeVisible()
  await page.getByRole('button',{name:'Back to library'}).click()
  await expect(page.getByText('1 / 45 completed')).toBeVisible()
  await expect(page.getByRole('button',{name:'View / Replay The Crossing'})).toBeVisible()
  await page.reload()
  await expect(page.getByText('1 / 45 completed')).toBeVisible()
})
test('Hard board scrolls within its panel without overflowing mobile or desktop layout',async({page})=>{
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:800})
    await page.goto('/games/hashi')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
    await page.getByRole('button',{name:'Play The Archipelago'}).click()
    await expect(page.locator('.hb-board')).toHaveAttribute('data-size','15')
    await expect(page.locator('.hb-island')).toHaveCount(PUZZLES.find(p=>p.id==='H01')!.islands.length)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
    if(width<=390){
      const sizes=await page.locator('.hb-board-scroller').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}))
      expect(sizes.scroll).toBeGreaterThan(sizes.client)
    }
    await page.getByRole('button',{name:'Puzzle collection'}).click()
  }
})
test('game remains playable when browser localStorage access is restricted',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Storage denied','SecurityError')}})})
  await start(page)
  await activateBridge(page,0)
  await expect(bridge(page,0)).toHaveAttribute('aria-label',/1 of 2 bridges/)
})
