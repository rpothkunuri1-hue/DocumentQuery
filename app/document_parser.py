from PyPDF2 import PdfReader
from docx import Document
import openpyxl
import pandas as pd
from bs4 import BeautifulSoup
import pytesseract
from PIL import Image
import io

async def extract_text_from_image(buffer: bytes) -> str:
    """Extract text from image using OCR"""
    try:
        image = Image.open(io.BytesIO(buffer))
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from image: {str(e)}")

async def extract_text_from_pdf(buffer: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_reader = PdfReader(io.BytesIO(buffer))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

async def extract_text_from_docx(buffer: bytes) -> str:
    """Extract text from DOCX file"""
    try:
        doc = Document(io.BytesIO(buffer))
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from DOCX: {str(e)}")

async def extract_text_from_txt(buffer: bytes) -> str:
    """Extract text from TXT file"""
    try:
        return buffer.decode("utf-8").strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from TXT: {str(e)}")

async def extract_text_from_csv(buffer: bytes) -> str:
    """Extract text from CSV file"""
    try:
        df = pd.read_csv(io.BytesIO(buffer))
        text = df.to_string(index=False)
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from CSV: {str(e)}")

async def extract_text_from_excel(buffer: bytes) -> str:
    """Extract text from Excel file"""
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(buffer))
        text = ""
        for sheet_name in workbook.sheetnames:
            sheet = workbook[sheet_name]
            text += f"Sheet: {sheet_name}\n"
            for row in sheet.iter_rows(values_only=True):
                row_text = ", ".join([str(cell) if cell is not None else "" for cell in row])
                text += row_text + "\n"
            text += "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from Excel: {str(e)}")

async def extract_text_from_markdown(buffer: bytes) -> str:
    """Extract text from Markdown file"""
    try:
        return buffer.decode("utf-8").strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from Markdown: {str(e)}")

async def extract_text_from_html(buffer: bytes) -> str:
    """Extract text from HTML file"""
    try:
        html = buffer.decode("utf-8")
        soup = BeautifulSoup(html, "html.parser")
        for script in soup(["script", "style"]):
            script.decompose()
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = "\n".join(chunk for chunk in chunks if chunk)
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from HTML: {str(e)}")

async def extract_text_from_rtf(buffer: bytes) -> str:
    """Extract text from RTF file (basic extraction)"""
    try:
        rtf = buffer.decode("utf-8", errors="ignore")
        rtf = rtf.replace("\\par", "\n")
        rtf = rtf.replace("\\pard", "\n")
        import re
        text = re.sub(r"\{\\[^{}]+\}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?", "", rtf)
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from RTF: {str(e)}")

async def extract_text_from_code(buffer: bytes, extension: str) -> str:
    """Extract text from code files"""
    try:
        code = buffer.decode("utf-8")
        return f"File Type: {extension}\n\n{code}".strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from code file: {str(e)}")

# Supported file extensions for code files
CODE_EXTENSIONS = {
    "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "cs", "go", "rs",
    "rb", "php", "swift", "kt", "r", "sql", "sh", "bash", "json", "xml",
    "yaml", "yml", "css", "scss", "sass", "less", "html", "htm"
}

# Supported image extensions for OCR
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "tiff", "tif"}
