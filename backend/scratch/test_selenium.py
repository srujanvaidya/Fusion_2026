import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def test_mahabhunakasha():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    try:
        print("Navigating to Mahabhunakasha...")
        driver.get("https://mahabhunakasha.mahabhumi.gov.in/27/index.html")
        
        # Wait for the page to load
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "d_type")))
        print("Page loaded.")
        
        # Select Category (Rural)
        cat_select = driver.find_element(By.ID, "d_type")
        for option in cat_select.find_elements(By.TAG_NAME, 'option'):
            if option.text == 'Rural':
                option.click()
                break
        
        time.sleep(2) # Wait for districts to load
        
        dist_select = driver.find_element(By.ID, "district")
        districts = [opt.text for opt in dist_select.find_elements(By.TAG_NAME, 'option')]
        print("Available Districts:", districts[:5])
        
    except Exception as e:
        print("Error:", e)
    finally:
        driver.quit()

if __name__ == "__main__":
    test_mahabhunakasha()
