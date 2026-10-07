"""Select original rules through native controls for browser regression suites.

The separate difficulty-browser-smoke.py checks the new challenge defaults.
These helpers let existing long gameplay checks retain comparable records and
fixtures without changing engine state or inserting gameplay inputs in JS.
"""


def start_solo(page, game):
    """Explicitly begin gameplay after a fresh navigation to its ready screen."""
    page.wait_for_function("game => window.firesideSolo?.gameId === game", arg=game)
    assert page.evaluate("window.firesideSolo.getState()") is None, "A fresh solo page started without player input"
    page.locator("#solo-start").click()
    page.wait_for_function("game => window.firesideSolo?.gameId === game && window.firesideSolo.getState() !== null", arg=game)


def standard_profile(page, game):
    if game in ("snake", "2048"):
        button = page.locator('#solo-game [data-mode="classic"]')
        button.focus()
        page.keyboard.press("Space", delay=20)
        expected_field, expected = "mode", "classic"
    else:
        expected_field = "profile" if game == "prism-shift" else "difficulty"
        expected = "beginner" if game == "minesweeper" else "standard"
        if game == "minesweeper":
            select = page.locator(".minesweeper-difficulty")
        else:
            select = page.locator("#solo-game select").filter(has=page.locator('option[value="standard"]'))
        if select.count():
            select.first.click()
            page.keyboard.press("Home")
            page.keyboard.press("Enter")
        else:
            button = page.locator(f'#solo-game [data-{expected_field}="standard"]')
            button.focus()
            page.keyboard.press("Space", delay=20)
    page.wait_for_function("([field, value]) => window.firesideSolo.getState()[field] === value", arg=[expected_field, expected])
