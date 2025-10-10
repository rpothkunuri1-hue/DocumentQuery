import pymupdf
import openpyxl
import csv
from bs4 import BeautifulSoup
import io

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


async def extract_text_from_txt(buffer: bytes) -> str:
    """Extract text from TXT file"""
    try:
        return buffer.decode("utf-8").strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from TXT: {str(e)}")

async def extract_text_from_csv(buffer: bytes) -> str:
    """Extract text from CSV file"""
    try:
        content = buffer.decode("utf-8")
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        
        if not rows:
            return ""
        
        # Format as table-like text
        col_widths = [max(len(str(row[i])) if i < len(row) else 0 for row in rows) for i in range(max(len(row) for row in rows))]
        
        text_lines = []
        for row in rows:
            formatted_row = "  ".join(str(cell).ljust(col_widths[i]) if i < len(row) else " " * col_widths[i] for i, cell in enumerate(row))
            text_lines.append(formatted_row)
        
        return "\n".join(text_lines).strip()
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
