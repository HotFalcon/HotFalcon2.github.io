import pyautogui
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time

def main():
    # Set up Selenium to connect to open Chrome instance
    chrome_options = Options()
    chrome_options.add_experimental_option("debuggerAddress", "localhost:9222")  # Connect to Chrome's debugging port
    driver = webdriver.Chrome(options=chrome_options)

    try:
        while True:
            # Refresh the page
            driver.refresh()

            # Wait for page to load
            time.sleep(1)

            # Click at first coordinate (placeholder: x=500, y=300)
            pyautogui.click(500, 300)

            # Wait briefly for UI updates
            time.sleep(1)

            # Click at second coordinate (placeholder: x=600, y=400)
            pyautogui.click(600, 400)

            # Wait for prices to appear
            time.sleep(1)

            # Extract prices (update selector based on site)
            price_elements = driver.find_elements(By.CSS_SELECTOR, ".ticket-price, .price-display, [class*='price']")
            prices = []
            for element in price_elements:
                text = element.text.strip()
                # Match prices (e.g., $25, $25.00)
                if text and ("$" in text or text.replace(".", "").isdigit()):
                    prices.append(text)

            # Print unique prices
            if prices:
                print("Cheapest ticket prices:", list(dict.fromkeys(prices)))
            else:
                print("No prices found.")

            # Wait 5 seconds
            time.sleep(5)

    finally:
        # Keep browser open (don't quit driver)
        pass

if __name__ == "__main__":
    main()