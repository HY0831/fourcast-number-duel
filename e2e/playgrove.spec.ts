import { test, expect, type Page } from '@playwright/test'

async function enterDigits(page: Page, code: string) {
  for (const digit of code) {
    await page.getByRole('button', { name: `Digit ${digit}` }).click()
  }
}

test('Playgrove homepage, Fourcast entry, and back navigation work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good games/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fourcast' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play Fourcast' })).toBeVisible()
  await expect(page.getByText('More games are')).toBeVisible()
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(horizontalOverflow).toBe(false)

  await page.getByRole('button', { name: 'Play Fourcast' }).click()
  await expect(page).toHaveURL(/\/games\/fourcast$/)
  await expect(page.getByRole('heading', { name: /Crack the code/ })).toBeVisible()
  await page.getByRole('button', { name: 'All games' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: /Good games/ })).toBeVisible()
})

test('homepage has no horizontal overflow on small phones or desktop', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Good games/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play Fourcast' })).toBeVisible()
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(horizontalOverflow, `No horizontal overflow at ${viewport.width}px`).toBe(false)
  }
})

test('old Fourcast invite links still open the correct Join screen', async ({ page }) => {
  await page.goto('/?room=ABC123')
  await expect(page).toHaveURL(/\/games\/fourcast\?room=ABC123$/)
  await expect(page.getByLabel('6-CHARACTER ROOM CODE')).toHaveValue('ABC123')
  await expect(page.getByRole('heading', { name: 'Got an invite code?' })).toBeVisible()
})

test('two online players can guess, view separate histories, resume and rematch', async ({ page, browser }) => {
  const guestContext = await browser.newContext()
  const guest = await guestContext.newPage()
  try {
    await page.goto('/')
    await page.getByRole('button', { name: 'Play Fourcast' }).click()
    await page.getByLabel('YOUR NICKNAME').fill('Alex')
    await page.getByRole('button', { name: /Create game room/ }).click()
    await expect(page.getByRole('heading', { name: 'Battle with a friend' })).toBeVisible()
    const code = (await page.locator('.invite-code span').allTextContents()).join('')
    expect(code).toMatch(/^[A-Z0-9]{6}$/)

    await guest.goto(`/games/fourcast?room=${code}`)
    await expect(guest.getByLabel('6-CHARACTER ROOM CODE')).toHaveValue(code)
    await guest.getByLabel('YOUR NICKNAME').fill('Blair')
    await guest.getByRole('button', { name: /Join game room/ }).click()
    await expect(page.getByRole('heading', { name: 'Set your secret number' })).toBeVisible()
    await expect(guest.getByRole('heading', { name: 'Set your secret number' })).toBeVisible()

    await enterDigits(page, '1234')
    await page.getByRole('button', { name: /Lock my secret number/ }).click()
    await enterDigits(guest, '5678')
    await guest.getByRole('button', { name: /Lock my secret number/ }).click()

    await expect(page.getByText('Your turn to guess!')).toBeVisible()
    // Repeated guesses are allowed even in No Repeats secret-number mode.
    await enterDigits(page, '1111')
    await page.getByRole('button', { name: /Submit guess/ }).click()
    await expect(guest.getByText('Your turn to guess!')).toBeVisible()
    await enterDigits(guest, '2222')
    await guest.getByRole('button', { name: /Submit guess/ }).click()
    await expect(page.locator('.player-history-1 .guess-row')).toHaveCount(1)
    await expect(page.locator('.player-history-2 .guess-row')).toHaveCount(1)

    // Cancelling a navigation warning must leave the active duel untouched.
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: 'All games' }).click()
    await expect(page).toHaveURL(/\/games\/fourcast$/)

    // Accepting the warning preserves the room session for recovery.
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'All games' }).click()
    await expect(page.getByRole('heading', { name: /Good games/ })).toBeVisible()
    await page.getByRole('button', { name: /Resume Fourcast/ }).click()
    await expect(page.getByText('Your turn to guess!')).toBeVisible()

    await enterDigits(page, '5678')
    await page.getByRole('button', { name: /Submit guess/ }).click()
    await expect(page.getByRole('heading', { name: 'You cracked it!' })).toBeVisible()
    await expect(guest.getByRole('heading', { name: 'Alex wins!' })).toBeVisible()
    await page.getByRole('button', { name: /Play another round/ }).click()
    await expect(page.getByRole('heading', { name: 'Set your secret number' })).toBeVisible()
    await expect(guest.getByRole('heading', { name: 'Set your secret number' })).toBeVisible()
  } finally {
    await guestContext.close()
  }
})
