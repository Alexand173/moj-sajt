import os
import json
import base64
import sys
from playwright.sync_api import sync_playwright

def main():
    username = os.getenv("SOUNDCHARTS_USERNAME")
    password = os.getenv("SOUNDCHARTS_PASSWORD")
    output_path = os.getenv("AI_SCRAPER_BROWSER_STORAGE_STATE")

    if not username or not password:
        print("Error: SOUNDCHARTS_USERNAME and SOUNDCHARTS_PASSWORD must be set.")
        sys.exit(1)

    if not output_path:
        print("Error: AI_SCRAPER_BROWSER_STORAGE_STATE is not set.")
        sys.exit(1)

    print("Pokrećem Playwright za logovanje na Soundcharts...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Otvori login stranicu
        page.goto("https://app.soundcharts.com/login", wait_until="networkidle")
        print("Otvorena login stranica.")

        # 2. Popuni email i lozinku
        # Napomena: Ovi selektori mogu zavisiti od trenutnog izgleda Soundcharts sajta.
        # Ako padne, proverićemo HTML.
        try:
            page.fill('input[type="email"]', username)
            page.fill('input[type="password"]', password)
            page.click('button[type="submit"]')
            print("Kliknuto na Login.")
        except Exception as e:
            print(f"Greška pri popunjavanju forme: {e}")
            # Sačuvaj screenshot za debug
            page.screenshot(path="login_debug.png")
            browser.close()
            sys.exit(1)

        # 3. Sačekaj da se uloguje (čeka da se pojavi URL market/tracks ili dashboard)
        try:
            page.wait_for_url("**/app/**", timeout=15000)
            print("Uspešno ulogovan.")
        except Exception:
            print("Upozorenje: Možda login nije prošao. Proveravam stanje...")
            page.screenshot(path="login_after_debug.png")

        # 4. Sačuvaj sesiju
        state = context.storage_state()
        with open(output_path, "w") as f:
            json.dump(state, f)
        
        print(f"Sesija uspešno sačuvana u {output_path}")
        browser.close()

if __name__ == "__main__":
    main()