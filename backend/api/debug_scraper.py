from selenium_scraper import scrape_mahabhunakasha
import json

res = scrape_mahabhunakasha("Rural", "Pune", "Haveli", "Manjri", "142")
if 'pdf_content' in res:
    res['pdf_content_len'] = len(res['pdf_content'])
    del res['pdf_content']
print(json.dumps(res, indent=2))
