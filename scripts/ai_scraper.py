import base64
import json
import os
import time
import webbrowser
from dotenv import load_dotenv
import mss
import openai
import pyautogui
from PIL import Image

# Eksplicitno učitavamo ključeve iz .env.local fajla
load_dotenv(".env.local")

# Inicijalizacija OpenAI klijenta sa učitanim ključem
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
  print(
      "[GRESKA] OPENAI_API_KEY nije pronađen u .env.local fajlu!"
  )
  exit(1)

client = openai.OpenAI(api_key=api_key)


def take_screenshot(filename="screen.png"):
  """Pravi skrinšot trenutnog ekrana i vraća putanju do fajla."""
  with mss.mss() as sct:
    monitor = sct.monitors[1]
    sct_img = sct.grab(monitor)
    img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
    img.save(filename)
    return filename


def ask_ai_for_coordinates(image_path, goal_description):
  """Šalje sliku ekrana AI modelu i traži koordinate (x, y) gde treba kliknuti."""
  with open(image_path, "rb") as image_file:
    base64_image = base64.b64encode(image_file.read()).decode("utf-8")

  response = client.chat.completions.create(
      model="gpt-4o-mini",
      messages=[
          {
              "role": "system",
              "content": (
                  'Return ONLY JSON format like {"x": 120, "y": 340} with no'
                  " other text."
              ),
          },
          {
              "role": "user",
              "content": [
                  {
                      "type": "text",
                      "text": f"Find coordinates to click for: {goal_description}",
                  },
                  {
                      "type": "image_url",
                      "image_url": {
                          "url": f"data:image/png;base64,{base64_image}"
                      },
                  },
              ],
          },
      ],
      max_tokens=50,
  )

  content = response.choices[0].message.content.strip()
  content = content.replace("```json", "").replace("```", "").strip()
  coords = json.loads(content)
  return coords["x"], coords["y"]


def extract_table_data(image_path):
  """Šalje sliku tabele AI-ju da izvuče podatke u strukturirani JSON format."""
  with open(image_path, "rb") as image_file:
    base64_image = base64.b64encode(image_file.read()).decode("utf-8")

  response = client.chat.completions.create(
      model="gpt-4o-mini",
      messages=[
          {
              "role": "system",
              "content": (
                  "Extract the song ranking table from the image and return"
                  " valid JSON array."
              ),
          },
          {
              "role": "user",
              "content": [
                  {
                      "type": "text",
                      "text": "Extract table rows as JSON.",
                  },
                  {
                      "type": "image_url",
                      "image_url": {
                          "url": f"data:image/png;base64,{base64_image}"
                      },
                  },
              ],
          },
      ],
      max_tokens=1500,
  )

  return response.choices[0].message.content


# GLAVNA FUNKCIJA ZA AUTOMATIZACIJU
def fetch_chartmetric_data(
    country="Germany", genre="Hip hop", chart_url="https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiQUxMX0NPVU5UUklFUyIsImZ0c2ciOiJBTExfR0VOUkVTIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0="
):
  print("[AI Agent] Otvaram tačan link u pretraživaču...")
  webbrowser.open(chart_url)

  # Pauza da se stranica u potpunosti učita na ekranu
  time.sleep(5)

  print("[AI Agent] Pravim početni snimak ekrana...")
  img_path = take_screenshot("current_screen.png")

  # 1. AI nalazi dugme za filtere i klikće
  try:
    x, y = ask_ai_for_coordinates(
        img_path, "The '+ Add filters' button with a filter icon"
    )
    pyautogui.click(x, y)
    time.sleep(1)
  except Exception as e:
    print("[AI Agent] Greška pri traženju dugmeta za filtere:", e)
    return None

  print(
      f"[AI Agent] Postavljam filtere -> Država: {country}, Žanr: {genre}"
  )
  time.sleep(3)  # Čekanje da se tabela osveži na ekranu

  # 2. Slikanje osvežene tabele
  print("[AI Agent] Pravim snimak rezultata (tabele)...")
  final_img_path = take_screenshot("table_result.png")

  # 3. Ekstrakcija podataka putem AI Vision-a
  raw_data = extract_table_data(final_img_path)

  try:
    parsed_data = json.loads(raw_data)
    print("[AI Agent] Uspešno izvučeni i parsirani podaci!")
    return parsed_data
  except Exception as e:
    print(
        "[AI Agent] Upozorenje: JSON parsiranje nije uspelo, vraćam sirov tekst:",
        e,
    )
    return raw_data


# Pokretanje skripte direktno iz terminala
if __name__ == "__main__":
  # Ovde unesi svoj tačan Chartmetric link
  target_url = "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiQUxMX0NPVU5UUklFUyIsImZ0c2ciOiJBTExfR0VOUkVTIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0="
  results = fetch_chartmetric_data(
      country="Germany", genre="Hip hop", chart_url=target_url
  )
  print(results)