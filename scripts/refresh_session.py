from playwright.sync_api import sync_playwright
import json

def main():
    output_path = "soundcharts_state.json"
    
    with sync_playwright() as p:
        # Otvaramo vidljivi Chrome prozor
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        print("\nOtvaram Soundcharts...")
        page.goto("https://app.soundcharts.com/login")
        
        print("\n" + "="*50)
        print(">>> ULOGUJ SE RUČNO PREKO GOOGLE NALOGA U PROZORU KOJI SE OTVORIO.")
        print(">>> Kada se uloguješ i vidiš tabelu sa pesmama, vrati se ovde i pritisni ENTER.")
        print("="*50 + "\n")
        
        input("Pritisni ENTER ovde kada završiš...")
        
        # Sačuvaj sesiju
        state = context.storage_state()
        with open(output_path, "w") as f:
            json.dump(state, f)
        
        print(f"\n✅ Sesija uspešno sačuvana u fajl: {output_path}")
        browser.close()

if __name__ == "__main__":
    main()