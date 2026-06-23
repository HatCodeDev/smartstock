import traceback
import sys
import os

# Add parent dir to path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.pdf_service import pdf_report_service

try:
    print("Generating PDF...")
    res = pdf_report_service.generate_pdf(
        averages={},
        trends=[],
        fp_growth={},
        holt_winters={},
        kmeans={}
    )
    print("Success! Generated PDF of type:", type(res), "length:", len(res))
except Exception as e:
    traceback.print_exc()
