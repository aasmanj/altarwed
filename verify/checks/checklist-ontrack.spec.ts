import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Verifies the redesigned "on track" checklist: status banner, timeline buckets
// with real target dates, the timeline/category view toggle, the filter tabs,
// completion updating progress, and the dashboard At-a-glance sub-line.
test('checklist on-track overhaul', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/checklist`)

  // Status banner: percent + "of N tasks complete". Lazy-seed may add tasks on
  // first GET, so give it a moment to render the populated state.
  await expect(page.getByText(/of \d+ tasks complete/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('text=/\\d+%/').first()).toBeVisible()

  // Timeline is the default view; its toggle should be present and pressed.
  const timelineBtn = page.getByRole('button', { name: 'By timeline' })
  await expect(timelineBtn).toBeVisible()
  await expect(timelineBtn).toHaveAttribute('aria-pressed', 'true')

  // At least one timeline bucket header renders.
  await expect(
    page.getByRole('heading', { name: /This month|Coming up|Later on|Needs attention|Completed|No timing yet/ }).first(),
  ).toBeVisible()

  // Real target date copy (wedding date is set on the seeded couple).
  await expect(page.getByText(/Aim for by/i).first()).toBeVisible()

  await page.screenshot({ path: 'evidence/checklist-timeline.png', fullPage: true })

  // Capture the completion count, toggle the first incomplete task, confirm it moves.
  const beforeText = await page.getByText(/of \d+ tasks complete/i).first().textContent()
  await page.getByRole('button', { name: 'Mark complete' }).first().click()
  await expect
    .poll(async () => (await page.getByText(/of \d+ tasks complete/i).first().textContent()))
    .not.toBe(beforeText)

  // View toggle -> category: a category section header should appear.
  await page.getByRole('button', { name: 'By category' }).click()
  await expect(page.getByRole('heading', { name: /Faith & Spiritual|Ceremony|Vendors/ }).first()).toBeVisible()
  await page.screenshot({ path: 'evidence/checklist-category.png', fullPage: true })

  // Filter tabs: switch to Done.
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true')

  // 🔍 Probe: dashboard At-a-glance Checklist card shows the new timeline-aware sub-line.
  await page.goto(`${cfg.appUrl}/dashboard`)
  await expect(page.getByText('Checklist', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByText(/On track|need(s)? attention|All done!|Getting started/).first(),
  ).toBeVisible()
  await page.screenshot({ path: 'evidence/checklist-dashboard-card.png', fullPage: true })
})
