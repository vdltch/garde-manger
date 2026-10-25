"""End-to-end test setup: a real PocketBase (migrations + hooks) serving the app from the repo,
a household account, and a fake ntfy server. Run: PB_BIN=path/to/pocketbase pytest tests/e2e"""
import http.server, json, os, shutil, socket, subprocess, tempfile, threading, time
from pathlib import Path

import pytest
import requests

ROOT = Path(__file__).resolve().parents[2]
EMAIL, PASSWORD = "foyer@example.org", "motdepasse-test-1"
ADMIN, ADMIN_PW = "admin@example.org", "admin-test-password-1"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Ntfy(http.server.BaseHTTPRequestHandler):
    received = []

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        Ntfy.received.append(json.loads(body or b"{}"))
        self.send_response(200); self.end_headers(); self.wfile.write(b"{}")

    def log_message(self, *a):
        pass


@pytest.fixture(scope="session")
def ntfy():
    port = free_port()
    srv = http.server.HTTPServer(("127.0.0.1", port), Ntfy)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield {"url": f"http://127.0.0.1:{port}/garde-manger-test", "received": Ntfy.received}
    srv.shutdown()


@pytest.fixture(scope="session")
def server(ntfy):
    pb = os.environ.get("PB_BIN") or shutil.which("pocketbase")
    if not pb:
        pytest.skip("PocketBase introuvable (PB_BIN)")
    data = tempfile.mkdtemp(prefix="gm-pb-")
    port = free_port()
    env = {**os.environ, "GM_NTFY_URL": ntfy["url"]}
    proc = subprocess.Popen(
        [pb, "serve", f"--http=127.0.0.1:{port}", f"--dir={data}",
         f"--migrationsDir={ROOT/'server/pb_migrations'}", f"--hooksDir={ROOT/'server/pb_hooks'}", f"--publicDir={ROOT}"],
        env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    base = f"http://127.0.0.1:{port}"
    for _ in range(100):
        try:
            if requests.get(base + "/api/health", timeout=1).ok:
                break
        except requests.RequestException:
            time.sleep(0.1)
    else:
        proc.kill(); pytest.fail("PocketBase n'a pas démarré:\n" + proc.stdout.read().decode())
    subprocess.run([pb, "superuser", "upsert", ADMIN, ADMIN_PW, f"--dir={data}"], check=True, capture_output=True)
    tok = requests.post(base + "/api/collections/_superusers/auth-with-password", json={"identity": ADMIN, "password": ADMIN_PW}).json()["token"]
    r = requests.post(base + "/api/collections/users/records", headers={"Authorization": tok},
                      json={"email": EMAIL, "password": PASSWORD, "passwordConfirm": PASSWORD, "verified": True})
    assert r.ok, r.text
    yield {"base": base, "admin_token": tok}
    proc.terminate()
    try:
        proc.wait(5)
    except subprocess.TimeoutExpired:
        proc.kill()
    shutil.rmtree(data, ignore_errors=True)


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


OFF_PRODUCT = {"status": 1, "product": {
    "code": "3017620422003", "product_name_fr": "Nutella", "brands": "Ferrero", "quantity": "400 g",
    "image_front_small_url": "", "nutriscore_grade": "e", "nova_group": 4, "environmental_score_grade": "d",
    "categories_tags": ["en:spreads", "en:sweet-spreads"]}}


@pytest.fixture
def phone(browser, server):
    """A fresh 'phone' (desktop-sized so the install screen stays out of the way) with Open Food Facts mocked."""
    pages = []

    def make():
        ctx = browser.new_context(viewport={"width": 430, "height": 900}, locale="fr-FR")
        page = ctx.new_page()
        page.errors = []
        page.on("pageerror", lambda e: page.errors.append(str(e)))
        page.route("**/*openfoodfacts.org/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(OFF_PRODUCT)))
        page.route("**/*openproductsfacts.org/**", lambda r: r.fulfill(status=404, body="{}"))
        page.route("**/*openbeautyfacts.org/**", lambda r: r.fulfill(status=404, body="{}"))
        page.goto(server["base"] + "/")
        page.wait_for_selector(".app")
        pages.append(page)
        return page

    yield make
    for p in pages:
        assert not p.errors, p.errors
        p.context.close()


def login(page, server):
    page.get_by_role("button", name="Synchronisation").first.click()
    dialog = page.get_by_role("dialog")
    dialog.locator("#pb-url").fill(server["base"])
    dialog.locator("#pb-email").fill(EMAIL)
    dialog.locator("#pb-pw").fill(PASSWORD)
    dialog.get_by_role("button", name="Se connecter").click()
    dialog.get_by_text("Synchronisé").wait_for(timeout=10000)
    page.keyboard.press("Escape")
    dialog.wait_for(state="detached")
