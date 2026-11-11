import { test, expect, type Page } from '@playwright/test';

function trackRuntimeErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  page.on('response', (res) => {
    const url = res.url();
    if (url.startsWith('http://127.0.0.1:') && res.status() >= 400) {
      // Allow deliberate negative API test probes only when explicitly expected outside normal route loads
      serverErrors.push(`${res.status()} ${url}`);
    }
  });

  return { consoleErrors, pageErrors, serverErrors };
}

test.describe('TyProX 2.0 End-to-End Platform Verification', () => {
  test('1. Landing page renders honestly, toggles theme across reload, and has zero runtime errors', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors, serverErrors } = trackRuntimeErrors(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Master Every Keystroke/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Start Typing/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Curriculum/i }).first()).toBeVisible();

    // Ensure no fabricated testimonials or legacy XP strings appear anywhere
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Alex M.');
    expect(bodyText).not.toContain('Sarah C.');
    expect(bodyText).not.toContain('100 XP');
    expect(bodyText).not.toContain('Demo Rankings');

    // Toggle Dark -> Light and confirm persistence after reload
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: /Switch to light theme/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Restore Dark mode cleanly
    await page.getByRole('button', { name: /Switch to dark theme/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test('2. Typing engine runs full session, updates WPM/Accuracy, opens Replay Viewer, feeds Performance Lab & Drill mode', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors, serverErrors } = trackRuntimeErrors(page);

    // Verify targeted drill query parameter loads drill banner with focus keys
    await page.goto('/typing?mode=drill&duration=15&targets=q,z');
    await expect(page.getByText(/Targeted Practice Drill/i)).toBeVisible();
    await expect(page.getByText(/Focus: q, z/i)).toBeVisible();

    const promptText = await page
      .getByTestId('typing-text-display')
      .evaluate((el) => (el.textContent || '').replace(/\u00a0/g, ' '));
    expect(promptText.length).toBeGreaterThan(60);

    // Focus typing textarea and type complete text cleanly over >1.1s so elapsedMs >= 1000ms
    const inputArea = page.getByLabel('Typing input area');
    await inputArea.focus();
    await page.keyboard.type(promptText, { delay: 5 });

    // Result screen renders server-aligned WPM, Accuracy, Consistency, and Watch Replay CTA
    await expect(page.getByText('Net WPM', { exact: true })).toBeVisible();
    await expect(page.getByText('Accuracy', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Watch Replay/i })).toBeVisible();

    // Open Replay Viewer and scrub/play
    await page.getByRole('button', { name: /Watch Replay/i }).click();
    await expect(page.getByText('Replay Viewer')).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /Exit Replay/i }).click();
    await expect(page.getByText('Net WPM', { exact: true })).toBeVisible();

    // Verify Performance Lab immediately analyzes this saved guest replay telemetry
    await page.goto('/dashboard/performance-lab');
    await expect(page.getByText('Keystroke Frequency Map')).toBeVisible();
    await expect(page.getByText('Hands Load Balance')).toBeVisible();
    await expect(page.getByText('Finger Workload Distribution')).toBeVisible();
    await expect(page.getByText('Left Pinky')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test('3. Curriculum gates lesson 2 behind lesson 1 accuracy mastery and persists unlocked state', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors, serverErrors } = trackRuntimeErrors(page);

    await page.goto('/learn');
    await expect(page.getByText('Home Row Anchors')).toBeVisible();
    await expect(page.getByText(/Pass Lesson 1 to Unlock/i)).toBeVisible();

    await page.getByRole('link', { name: /Start Lesson/i }).first().click();
    await expect(page).toHaveURL(/\/learn\/home-row-foundations/);

    const lessonPrompt = await page
      .getByTestId('typing-text-display')
      .evaluate((el) => (el.textContent || '').replace(/\u00a0/g, ' '));
    expect(lessonPrompt.length).toBeGreaterThan(40);

    const inputArea = page.getByLabel('Lesson typing input area');
    await inputArea.focus();
    await page.keyboard.type(lessonPrompt, { delay: 10 });

    await expect(page.getByText('Lesson Passed')).toBeVisible();
    await expect(page.getByRole('link', { name: /Next: Center Index Reach/i })).toBeVisible();

    // Navigate back to hub and reload to confirm persistence of pass + unlock
    await page.goto('/learn');
    await page.reload();
    await expect(page.getByText('1 / 12 Passed')).toBeVisible();
    await expect(page.getByText(/Pass Lesson 1 to Unlock/i)).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test('4. Daily UTC Challenge loads deterministic prompt and live countdown', async ({ page }) => {
    const { consoleErrors, pageErrors, serverErrors } = trackRuntimeErrors(page);

    await page.goto('/daily');
    await expect(page.getByText(/Daily UTC Challenge/i)).toBeVisible();
    await expect(page.getByText(/Seed: daily-\d{4}-\d{2}-\d{2}/)).toBeVisible();
    await expect(page.getByText('Next UTC Reset')).toBeVisible();

    const firstPrompt = await page
      .getByTestId('typing-text-display')
      .evaluate((el) => (el.textContent || '').replace(/\u00a0/g, ' '));

    await page.reload();
    const secondPrompt = await page
      .getByTestId('typing-text-display')
      .evaluate((el) => (el.textContent || '').replace(/\u00a0/g, ' '));

    expect(firstPrompt.length).toBeGreaterThan(50);
    expect(secondPrompt).toBe(firstPrompt);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test('5. Leaderboard stays honest, filtering works, Preferences update font/audio, and Security gates hold', async ({
    page,
    request,
  }) => {
    const { consoleErrors, pageErrors } = trackRuntimeErrors(page);

    // Leaderboard clean UI & filters (allow upstream Supabase errors only if offline, zero runtime React errors)
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { name: /Global Leaderboard/i })).toBeVisible();
    const lbText = await page.locator('body').innerText();
    expect(lbText).not.toContain('Demo Rankings');
    expect(lbText).not.toContain('KeyMaster99');

    await page.getByRole('button', { name: 'code', exact: true }).click();
    await expect(page).toHaveURL(/mode=code/);

    // Security gates: invalid API filter -> 400, unauth result POST -> 401
    const badFilterRes = await request.get('/api/leaderboard?mode=hacked&duration=999&timeframe=forever');
    expect(badFilterRes.status()).toBe(400);

    const unauthPostRes = await request.post('/api/results', {
      data: { mode: 'words', duration: 30, seed: 'abc1234', telemetry: [] },
    });
    expect(unauthPostRes.status()).toBe(401);

    const crossOriginRes = await request.post('/api/results', {
      headers: { Origin: 'https://evil.example' },
      data: { mode: 'words', duration: 30, seed: 'abc1234', telemetry: [] },
    });
    expect(crossOriginRes.status()).toBe(403);

    // Sitemap exposes curriculum lessons cleanly alongside core routes
    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.status()).toBe(200);
    const sitemapBody = await sitemapRes.text();
    expect(sitemapBody).toContain('/learn/home-row-foundations');
    expect(sitemapBody).toContain('/daily');

    // Dashboard ignores ?demo=true cleanly without inserting demo data
    await page.goto('/dashboard?demo=true');
    await expect(page.getByText('Guest Session Active')).toBeVisible();
    await expect(page.getByText(/No runs yet/i).first()).toBeVisible();

    // Open redirect check on callback
    const callbackRes = await request.get('/auth/callback?next=https://evil.com', {
      maxRedirects: 0,
    });
    expect(callbackRes.status()).toBe(307);
    const locationHeader = callbackRes.headers()['location'] || '';
    expect(locationHeader).not.toContain('evil.com');

    // Profile font switch & audio test click button
    await page.goto('/profile');
    await page.getByRole('button', { name: /IBM Plex Mono/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-typing-font', 'ibm-plex-mono');
    await page.getByRole('button', { name: /Play Test Click/i }).click();

    // Non-existent / invalid challenge route renders clean not-found fallback without crashing
    const challengeResp = await page.goto('/challenge/11111111-1111-4111-8111-111111111111', {
      waitUntil: 'domcontentloaded',
    });
    expect(challengeResp?.status() ?? 200).toBeLessThan(500);
    await expect(
      page.getByRole('heading', { name: /Challenge Expired or Not Found/i })
    ).toBeVisible();
    await page.getByRole('link', { name: /Start a Fresh Practice/i }).click();
    await expect(page).toHaveURL(/\/typing/);
    await expect(page.getByLabel('Typing input area')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('6. Desktop (1440x900) and Mobile (375x812) responsive + keyboard accessibility audit across all routes', async ({
    page,
  }) => {
    const routes = [
      '/',
      '/typing',
      '/learn',
      '/daily',
      '/leaderboard',
      '/dashboard',
      '/dashboard/performance-lab',
      '/profile',
      '/login',
    ];

    const { consoleErrors, pageErrors, serverErrors } = trackRuntimeErrors(page);

    // Desktop dark & light sweep
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ['dark', 'light'] as const) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('main')).toBeVisible();
      if (theme === 'light') {
        const isDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'));
        if (isDark) {
          await page.getByRole('button', { name: /Switch to light theme/i }).click();
        }
      } else {
        const isDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'));
        if (!isDark) {
          await page.getByRole('button', { name: /Switch to dark theme/i }).click();
        }
      }

      for (const route of routes) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main')).toHaveCount(1);
        await expect(page.getByRole('main')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow, `Desktop ${theme} horizontal overflow on ${route}`).toBeLessThanOrEqual(1);

        await expect
          .poll(
            () =>
              page.evaluate(
                () =>
                  Array.from(document.querySelectorAll('img')).filter(
                    (img) => !img.complete || img.naturalWidth === 0
                  ).length
              ),
            { message: `Broken images on ${route}`, timeout: 5000 }
          )
          .toBe(0);
      }
    }

    // Mobile 375x812 dark sweep + mobile menu open & Escape close
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const menuBtn = page.getByRole('button', { name: /Open menu/i });
    const box = await menuBtn.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(40);
    await menuBtn.click();
    await expect(page.getByRole('link', { name: 'Learn' }).last()).toBeVisible();
    await page.keyboard.press('Escape');

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('main')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `Mobile 375px horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test('7. Phase 1D visual & asset regressions: Hero3D HUD non-overlap across viewports, Light CatCompanion contrast & layer separation, and achievement SVGs', async ({
    page,
    request,
  }) => {
    const { consoleErrors, pageErrors, serverErrors } = trackRuntimeErrors(page);

    // 1. Verify missing achievement SVG assets resolve with HTTP 200 and valid SVG content
    for (const svgPath of [
      '/achievements/speed_80.svg',
      '/achievements/speed_150.svg',
      '/achievements/streak_14.svg',
    ]) {
      const res = await request.get(svgPath);
      expect(res.status(), `Asset ${svgPath} status`).toBe(200);
      const body = await res.text();
      expect(body).toContain('<svg');
    }

    // 2. Verify Hero3D chassis and all 4 capability HUD cards never overlap across Desktop/Laptop/Tablet/Mobile in Dark & Light
    const viewports = [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'laptop', width: 1024, height: 768 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 812 },
    ] as const;

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      for (const theme of ['dark', 'light'] as const) {
        const isDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'));
        if (theme === 'light' && isDark) {
          await page.getByRole('button', { name: /Switch to light theme/i }).click();
        } else if (theme === 'dark' && !isDark) {
          await page.getByRole('button', { name: /Switch to dark theme/i }).click();
        }
        await page.waitForTimeout(250);

        const chassisBox = await page.getByTestId('hero-3d-chassis').boundingBox();
        expect(chassisBox, `Hero3D chassis missing on ${vp.name} ${theme}`).not.toBeNull();

        const hudCards = page.getByTestId('hero-hud-card');
        expect(await hudCards.count()).toBe(4);

        for (let i = 0; i < 4; i += 1) {
          const cardBox = await hudCards.nth(i).boundingBox();
          expect(cardBox, `Hero HUD card ${i} missing on ${vp.name} ${theme}`).not.toBeNull();
          if (chassisBox && cardBox) {
            const overlapX = Math.max(
              0,
              Math.min(cardBox.x + cardBox.width, chassisBox.x + chassisBox.width) -
                Math.max(cardBox.x, chassisBox.x)
            );
            const overlapY = Math.max(
              0,
              Math.min(cardBox.y + cardBox.height, chassisBox.y + chassisBox.height) -
                Math.max(cardBox.y, chassisBox.y)
            );
            expect(
              overlapX * overlapY,
              `Hero HUD card ${i} overlaps chassis on ${vp.name} ${theme}`
            ).toBe(0);
          }
        }
      }
    }

    // 3. Verify Light Mode CatCompanion "My Collection" drawer renders opaque semantic light surface and high-contrast text
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/typing?mode=drill&duration=15&targets=q,z');
    const isDarkOnTyping = await page.locator('html').evaluate((el) => el.classList.contains('dark'));
    if (isDarkOnTyping) {
      await page.getByRole('button', { name: /Switch to light theme/i }).click();
    }

    const promptText = await page
      .getByTestId('typing-text-display')
      .evaluate((el) => (el.textContent || '').replace(/\u00a0/g, ' '));

    await page.getByLabel('Typing input area').focus();
    await page.keyboard.type(promptText, { delay: 5 });
    await expect(page.getByText('Net WPM', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /My Collection/i }).click();
    const drawer = page.getByTestId('cat-collection-drawer');
    await expect(drawer).toBeVisible();

    const drawerStyles = await drawer.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        zIndex: Number(cs.zIndex || 0),
      };
    });
    // Light mode --surface is rgb(255, 255, 255) and --text-primary is rgb(17, 17, 19)
    expect(drawerStyles.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(drawerStyles.color).toBe('rgb(17, 17, 19)');
    expect(drawerStyles.zIndex).toBeGreaterThanOrEqual(40);

    await page.getByRole('button', { name: /^close$/i }).click();
    await expect(drawer).toBeHidden();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });
});

