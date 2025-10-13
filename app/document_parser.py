import pymupdf

async def extract_text_from_pdf(buffer: bytes) -> str:
    """Extract text from PDF file using pymupdf"""
    try:
        doc = pymupdf.open(stream=buffer, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")
