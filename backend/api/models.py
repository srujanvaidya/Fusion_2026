from django.db import models

class LandRecord(models.Model):
    category = models.CharField(max_length=50)
    district = models.CharField(max_length=100)
    taluka = models.CharField(max_length=100)
    village = models.CharField(max_length=100)
    gat_no = models.CharField(max_length=50)
    owner_name = models.CharField(max_length=255, blank=True, null=True)
    pdf_file = models.FileField(upload_to='land_records/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.district} - {self.gat_no}"
