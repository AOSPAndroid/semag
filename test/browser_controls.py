"""Native access to optional gameplay controls panels in browser fixtures.

These helpers read DOM visibility and use actual browser pointer input. They
never invoke product handlers, change live state, or replace gameplay timing.
"""
from contextlib import contextmanager


def reveal_controls(page, selector):
    """Return an opened panel token, or None when the control is already visible."""
    target = page.locator(selector).first
    if page.evaluate('Boolean(document.pointerLockElement)'):
        page.keyboard.press('Escape')
        page.wait_for_function('!document.pointerLockElement')
    # Fullscreenchange reparents the shared voxel layout picker into the arena.
    # Wait for that native event before deciding which panel contains it.
    if target.evaluate('node => !!document.fullscreenElement && !document.fullscreenElement.contains(node)'):
        page.wait_for_function('''selector => !document.fullscreenElement ||
            document.fullscreenElement.contains(document.querySelector(selector))''', arg=selector)
    if target.is_visible():
        return None
    panel_id = target.evaluate('node => node.closest("dialog,[role=dialog]")?.id || null')
    assert panel_id, (selector, 'Hidden control has no controls panel')
    prior_phase = page.locator('#solo-app').get_attribute('data-phase') if page.locator('#solo-app').count() else None
    openers = page.locator(f'[aria-controls="{panel_id}"]')
    opener = next((node for node in openers.all() if node.is_visible()), None)
    assert opener, (panel_id, 'Controls panel has no visible opener')
    opener.click()
    target.wait_for(state='visible')
    return {'id': panel_id, 'prior_phase': prior_phase}


def dismiss_controls(page, token, resume=False):
    """Close a panel opened by reveal_controls; optionally resume an active solo."""
    if token is None:
        return
    panel = page.locator('#' + token['id'])
    if panel.is_visible():
        closers = panel.locator('button[aria-label^="Close"],button[id^="close-"]')
        closer = next((node for node in closers.all() if node.is_visible()), None)
        assert closer, (token['id'], 'Controls panel has no visible close button')
        closer.click()
        panel.wait_for(state='hidden')
        # Native dialog.close queues its close event. Wait for the product's
        # focus/input cleanup before the fixture sends its next gameplay key.
        page.wait_for_function('''id => [...document.querySelectorAll("[aria-controls]")]
            .filter(node => node.getAttribute("aria-controls") === id && node.hasAttribute("aria-expanded"))
            .every(node => node.getAttribute("aria-expanded") === "false")''', arg=token['id'])
    if resume and token['prior_phase'] == 'playing':
        pause = page.locator('#solo-pause')
        if pause.is_enabled() and pause.get_attribute('aria-pressed') == 'true':
            pause.click()
            page.wait_for_function('document.getElementById("solo-app").dataset.phase !== "paused"')


@contextmanager
def controls_panel(page, selector, resume=False):
    """Expose a moved control for a native probe, then restore the play layout."""
    token = reveal_controls(page, selector)
    try:
        yield page.locator(selector).first
    finally:
        dismiss_controls(page, token, resume=resume)


def click_control(page, selector):
    """Activate an optional room action without leaving its modal open."""
    with controls_panel(page, selector) as control:
        control.click()
