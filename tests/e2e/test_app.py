import re

import requests
from playwright.sync_api import expect

from conftest import EMAIL, PASSWORD, login


def card(page, name):
    return page.locator(".card", has_text=name)


def add_manually(page, name, place="Placard", qty="2"):
    page.get_by_role("button", name="Ajouter un article à la main").click()
    d = page.get_by_role("dialog")
    d.locator("#f-name").fill(name)
    d.get_by_role("button", name=place, exact=True).click()
    d.locator("#f-qty").fill(qty)
    d.get_by_role("button", name="Ajouter au stock").click()
    d.wait_for(state="detached")
    expect(card(page, name)).to_be_visible()


def test_admin_is_hidden_from_the_public_domain(server):
    assert requests.get(server["base"] + "/_/", headers={"Host": "stock.example.org"}).status_code == 404
    assert requests.get(server["base"] + "/_/").status_code == 200


def test_empty_stock_then_manual_add_and_steps(phone):
    page = phone()
    expect(page.get_by_text("Stock vide")).to_be_visible()
    add_manually(page, "Riz basmati", qty="2")
    c = card(page, "Riz basmati")
    c.get_by_role("button", name="Ajouter un Riz basmati").click()
    expect(c.locator("output")).to_have_text("3")
    for _ in range(3):
        card(page, "Riz basmati").get_by_role("button", name="Retirer un Riz basmati").click()
    expect(page.locator(".toast")).to_contain_text("liste de courses")
    expect(page.locator(".tab", has_text="Courses").locator(".badge")).to_have_text("1")


def test_shopping_list_basket_and_store(phone):
    page = phone()
    page.locator(".tab", has_text="Courses").click()
    page.locator("#list-add").fill("Pain de campagne")
    page.locator("#list-add").press("Enter")
    c = card(page, "Pain de campagne")
    c.get_by_role("button", name="Un de plus : Pain de campagne").click()
    expect(c.locator("output")).to_have_text("×2")
    c.get_by_role("checkbox", name=re.compile("Pain de campagne")).click()
    page.get_by_role("button", name=re.compile("Ranger les 1 article")).click()
    page.locator(".tab", has_text="Stock").click()
    expect(card(page, "Pain de campagne").locator("output")).to_have_text("2")


def test_scan_typed_code_fills_the_sheet_and_lots(phone):
    page = phone()
    page.get_by_role("button", name="Scanner un code").click()
    page.locator("#typed-code").fill("3017620422003")
    page.locator("#typed-code").press("Enter")
    d = page.get_by_role("dialog", name="Article")
    expect(d.locator("#f-name")).to_have_value("Nutella", timeout=10000)
    expect(d.locator("#f-brand")).to_have_value("Ferrero")
    expect(d.locator(".ticket")).to_contain_text("OPEN FOOD FACTS")
    expect(d.locator("#f-exp")).not_to_have_value("")          # date suggested from the category
    d.get_by_role("button", name="Ajouter au stock").click()
    d.wait_for(state="detached")
    expect(card(page, "Nutella")).to_be_visible()
    # same product again: +1 and the choice of a separate lot
    page.get_by_role("button", name="Scanner un code").click()
    page.locator("#typed-code").fill("3017620422003")
    page.locator("#typed-code").press("Enter")
    expect(page.locator(".toast")).to_contain_text("+1 Nutella")
    page.locator(".toast").get_by_role("button", name="Autre date").click()
    d = page.get_by_role("dialog", name="Article")
    expect(d.get_by_role("heading", name="Nouveau lot")).to_be_visible()
    d.locator("#f-exp").fill("2030-01-01")
    d.get_by_role("button", name="Ajouter au stock").click()
    expect(page.locator(".card", has_text="Nutella")).to_have_count(2)
    expect(page.locator(".lot").first).to_have_text("2 lots")


def test_burst_mode_adds_each_scan(phone):
    page = phone()
    page.get_by_role("button", name="Scanner un code").click()
    page.get_by_role("button", name="Rafale").click()
    for code in ["3017620422003", "5449000000996"]:
        page.locator("#typed-code").fill(code)
        page.locator("#typed-code").press("Enter")
    expect(page.locator(".burst-log li")).to_have_count(2)
    page.get_by_role("button", name="Fermer le scanner").click()
    expect(page.locator(".toast")).to_contain_text("2 articles scannés en rafale")
    expect(card(page, "Nutella").first).to_be_visible(timeout=10000)   # both codes are mocked as Nutella
    expect(page.locator(".card")).to_have_count(2)


def test_two_phones_stay_in_sync_and_count_both_taps(phone, server, ntfy):
    a, b = phone(), phone()
    login(a, server)
    login(b, server)
    add_manually(a, "Lait demi-écrémé", place="Frigo", qty="1")
    expect(card(b, "Lait demi-écrémé")).to_be_visible(timeout=10000)
    card(a, "Lait demi-écrémé").get_by_role("button", name="Ajouter un Lait demi-écrémé").click()
    card(b, "Lait demi-écrémé").get_by_role("button", name="Ajouter un Lait demi-écrémé").click()
    expect(card(a, "Lait demi-écrémé").locator("output")).to_have_text("3", timeout=10000)
    expect(card(b, "Lait demi-écrémé").locator("output")).to_have_text("3", timeout=10000)
    # the product scanned while signed in lands in the household catalog
    b.get_by_role("button", name="Scanner un code").click()
    b.locator("#typed-code").fill("3017620422003")
    b.locator("#typed-code").press("Enter")
    b.get_by_role("dialog", name="Article").get_by_role("button", name="Ajouter au stock").click()
    tok = requests.post(server["base"] + "/api/collections/users/auth-with-password", json={"identity": EMAIL, "password": PASSWORD}).json()["token"]
    items = []
    for _ in range(50):
        items = requests.get(server["base"] + '/api/collections/products/records?filter=code%3D%223017620422003%22', headers={"Authorization": tok}).json()["items"]
        if items: break
        b.wait_for_timeout(100)
    assert items and items[0]["name"] == "Nutella"
    # notification test button
    b.get_by_role("button", name="Synchronisation").first.click()
    b.get_by_role("button", name="Tester les notifications").click()
    expect(b.get_by_role("dialog")).to_contain_text("Notification envoyée")
    assert ntfy["received"] and ntfy["received"][-1]["topic"] == "garde-manger-test"


def test_install_screen_on_iphone(browser, server):
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto(server["base"] + "/")
    gate = page.locator("#gate")
    expect(gate).to_be_visible()
    expect(gate).to_contain_text("Safari · iPhone")
    expect(gate).to_contain_text("Sur l'écran d'accueil")
    page.get_by_role("button", name="Continuer dans le navigateur").click()
    expect(gate).to_be_hidden()
    ctx.close()
