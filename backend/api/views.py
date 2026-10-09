from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .selenium_scraper import scrape_mahabhunakasha
from .models import LandRecord
from django.core.files.base import ContentFile
from django.utils.text import slugify

@csrf_exempt
def land_search_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            category = data.get('category', 'Rural')
            district = data.get('district', '')
            taluka = data.get('taluka', '')
            village = data.get('village', '')
            gat_no = data.get('gat', '')
            
            result = scrape_mahabhunakasha(category, district, taluka, village, gat_no)
            
            # Save to Database
            record = LandRecord.objects.create(
                category=category,
                district=district,
                taluka=taluka,
                village=village,
                gat_no=gat_no,
                owner_name=result.get('owner', '')
            )
            
            if result.get('pdf_content'):
                filename = f"{slugify(district)}_{slugify(gat_no)}.pdf"
                record.pdf_file.save(filename, ContentFile(result['pdf_content']))
            
            # Overwrite the pdf_url with the local database url if we saved it
            if record.pdf_file:
                result['pdf_url'] = record.pdf_file.url
                
            # Don't send bytes to frontend
            if 'pdf_content' in result:
                del result['pdf_content']
                
            return JsonResponse(result)
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)
    return JsonResponse({"error": "Only POST allowed"}, status=405)
