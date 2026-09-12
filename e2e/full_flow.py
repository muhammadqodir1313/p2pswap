"""PeerSwap end-to-end test.

Covers the full demo journey in a real browser:
  1. sign up a fresh account
  2. add teach/learn skills on the profile
  3. see a ranked match
  4. request a swap
  5. accept the swap
  6. mark it completed and verify the +10 PeerCoin reward
  7. submit a star rating with a comment

Run with:  python3 e2e/full_flow.py   (optional: BASE_URL=... )
"""

import asyncio
import os
import re
import sys
import time

from playwright.async_api import async_playwright, expect

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")
TIMEOUT = 20_000

TEACH_SKILLS = ["HTML", "React"]
LEARN_SKILLS = ["SQL", "Python"]

steps: list[str] = []


def step(name: str) -> None:
    steps.append(name)
    print(f"PASS  {name}", flush=True)


async def goto(page, path: str) -> None:
    """Navigate and wait for React to hydrate before interacting."""
    await page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(500)


async def peercoin_balance(page) -> int:
    await goto(page, "/dashboard")
    card = page.locator("div", has=page.get_by_text("PeerCoin", exact=True)).last
    await expect(card).to_be_visible(timeout=TIMEOUT)
    text = await card.inner_text()
    match = re.search(r"(\d+)", text)
    assert match, f"no PeerCoin number found in: {text!r}"
    return int(match.group(1))


async def run() -> None:
    email = f"e2e+{int(time.time())}@peerswap.demo"
    password = "peerswap123"
    errors: list[str] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.set_default_timeout(TIMEOUT)

        # 1. Sign up ---------------------------------------------------------
        await goto(page, "/signup")
        await page.get_by_label("First name").fill("Eva")
        await page.get_by_label("Last name").fill("Tester")
        await page.get_by_label("Email").fill(email)
        await page.get_by_label("Password").fill(password)
        await page.get_by_role("button", name="Start Swapping").click()
        await page.wait_for_url(re.compile(r"/dashboard"), timeout=TIMEOUT)
        step("sign up creates an account and lands on the dashboard")

        # 2. Add skills ------------------------------------------------------
        await goto(page, "/profile")
        for skill in TEACH_SKILLS:
            await page.get_by_label("Skills I Can Teach").fill(skill)
            await page.get_by_label("Skills I Can Teach").press("Enter")
            await expect(page.get_by_text(skill, exact=True).first).to_be_visible()
        for skill in LEARN_SKILLS:
            await page.get_by_label("Skills I Want To Learn").fill(skill)
            await page.get_by_label("Skills I Want To Learn").press("Enter")
            await expect(page.get_by_text(skill, exact=True).first).to_be_visible()
        step("teach and learn skills are saved on the profile")

        # 3. Find a match ----------------------------------------------------
        await goto(page, "/matches")
        match_card = page.locator("article").first
        await expect(match_card).to_be_visible(timeout=TIMEOUT)
        await expect(match_card.get_by_text(re.compile(r"\d+%"))).to_be_visible()
        step("matching surfaces at least one ranked peer")

        # 4. Request a swap --------------------------------------------------
        request_button = match_card.get_by_role("button", name="Request Swap")
        await request_button.click()
        await expect(match_card.get_by_role("button", name="Request sent")).to_be_visible()
        step("swap request is created")

        balance_before = await peercoin_balance(page)

        # 5. Accept the swap -------------------------------------------------
        await goto(page, "/sessions")
        accept = page.get_by_role("button", name=re.compile("Accept")).first
        await expect(accept).to_be_visible(timeout=TIMEOUT)
        await accept.click()
        await expect(page.get_by_role("tab", name=re.compile(r"Upcoming \(1\)"))).to_be_visible()
        step("swap request is accepted")

        # 6. Complete the swap -----------------------------------------------
        await page.get_by_role("tab", name=re.compile("Upcoming")).click()
        complete = page.get_by_role("button", name="Mark as Completed").first
        await expect(complete).to_be_visible()
        await complete.click()
        await expect(page.get_by_role("tab", name=re.compile(r"Completed \(1\)"))).to_be_visible()
        step("session is marked completed")

        balance_after = await peercoin_balance(page)
        assert balance_after == balance_before + 10, (
            f"expected +10 PeerCoin, got {balance_before} -> {balance_after}"
        )
        step(f"PeerCoin reward granted ({balance_before} -> {balance_after})")

        # 7. Star rating ------------------------------------------------------
        await goto(page, "/sessions")
        await page.get_by_role("tab", name=re.compile("Completed")).click()
        await page.get_by_role("button", name="5 star").first.click()
        await page.get_by_placeholder("Optional feedback").fill("Great swap, learned a lot!")
        await page.get_by_role("button", name="Submit Feedback").click()
        await expect(page.get_by_text("Thanks for your feedback!").first).to_be_visible()
        step("star rating and feedback are submitted")

        assert not errors, f"page errors: {errors}"
        await browser.close()

    print(f"\nAll {len(steps)} end-to-end steps passed.")


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except Exception as exc:  # noqa: BLE001
        print(f"\nFAIL  {exc}", file=sys.stderr)
        sys.exit(1)
