"""
Tests for document parsing functionality
"""
import pytest
import io
from app.document_parser import (
    extract_text_from_txt,
    extract_text_from_html,
    extract_text_from_markdown,
    extract_text_from_csv,
    CODE_EXTENSIONS
)


class TestTextExtraction:
    """Test suite for text extraction from different document formats"""
    
    @pytest.mark.asyncio
    async def test_extract_text_from_txt(self):
        """Test plain text extraction"""
        content = b"Hello, this is a test document.\nIt has multiple lines."
        result = await extract_text_from_txt(content)
        assert "Hello, this is a test document" in result
        assert "It has multiple lines" in result
    
    @pytest.mark.asyncio
    async def test_extract_text_from_txt_empty(self):
        """Test empty text file"""
        content = b""
        result = await extract_text_from_txt(content)
        assert result == ""
    
    @pytest.mark.asyncio
    async def test_extract_text_from_html(self):
        """Test HTML text extraction"""
        html_content = b"""
        <html>
            <head><title>Test Page</title></head>
            <body>
                <h1>Test Heading</h1>
                <p>This is a test paragraph.</p>
                <script>console.log('test');</script>
            </body>
        </html>
        """
        result = await extract_text_from_html(html_content)
        assert "Test Heading" in result
        assert "This is a test paragraph" in result
        assert "console.log" not in result  # Scripts should be removed
    
    @pytest.mark.asyncio
    async def test_extract_text_from_html_with_styles(self):
        """Test HTML with style tags"""
        html_content = b"""
        <html>
            <style>.test { color: red; }</style>
            <body><p>Content</p></body>
        </html>
        """
        result = await extract_text_from_html(html_content)
        assert "Content" in result
        assert "color: red" not in result  # Styles should be removed
    
    @pytest.mark.asyncio
    async def test_extract_text_from_markdown(self):
        """Test Markdown extraction"""
        markdown_content = b"# Test Heading\n\nThis is **bold** text."
        result = await extract_text_from_markdown(markdown_content)
        assert "# Test Heading" in result
        assert "**bold**" in result
    
    @pytest.mark.asyncio
    async def test_extract_text_from_csv(self):
        """Test CSV extraction"""
        csv_content = b"Name,Age,City\nJohn,30,NYC\nJane,25,LA"
        result = await extract_text_from_csv(csv_content)
        assert "Name" in result
        assert "John" in result
        assert "Jane" in result
        assert "30" in result
    
    @pytest.mark.asyncio
    async def test_extract_text_from_csv_empty(self):
        """Test empty CSV"""
        csv_content = b""
        with pytest.raises(Exception):
            await extract_text_from_csv(csv_content)
    
    @pytest.mark.asyncio
    async def test_extract_text_from_txt_unicode(self):
        """Test text with Unicode characters"""
        content = "Hello 世界 🌍".encode('utf-8')
        result = await extract_text_from_txt(content)
        assert "Hello" in result
        assert "世界" in result
        assert "🌍" in result


class TestCodeExtensions:
    """Test suite for code file extension support"""
    
    def test_code_extensions_contains_common_languages(self):
        """Test that common programming languages are supported"""
        assert "py" in CODE_EXTENSIONS
        assert "js" in CODE_EXTENSIONS
        assert "ts" in CODE_EXTENSIONS
        assert "java" in CODE_EXTENSIONS
        assert "cpp" in CODE_EXTENSIONS
    
    def test_code_extensions_contains_web_languages(self):
        """Test that web-related file types are supported"""
        assert "html" in CODE_EXTENSIONS
        assert "css" in CODE_EXTENSIONS
        assert "json" in CODE_EXTENSIONS
        assert "xml" in CODE_EXTENSIONS


class TestErrorHandling:
    """Test suite for error handling in document parsing"""
    
    @pytest.mark.asyncio
    async def test_extract_text_from_txt_invalid_encoding(self):
        """Test handling of invalid encoding"""
        # Invalid UTF-8 sequence
        invalid_content = b"\xff\xfe"
        with pytest.raises(Exception):
            await extract_text_from_txt(invalid_content)
    
    @pytest.mark.asyncio
    async def test_extract_text_from_html_malformed(self):
        """Test handling of malformed HTML"""
        # BeautifulSoup should handle this gracefully
        malformed_html = b"<html><body><p>Unclosed paragraph"
        result = await extract_text_from_html(malformed_html)
        assert "Unclosed paragraph" in result


class TestEdgeCases:
    """Test suite for edge cases in document parsing"""
    
    @pytest.mark.asyncio
    async def test_extract_text_from_txt_whitespace_only(self):
        """Test file with only whitespace"""
        content = b"   \n\n\t\t   "
        result = await extract_text_from_txt(content)
        assert result == ""
    
    @pytest.mark.asyncio
    async def test_extract_text_from_html_nested_tags(self):
        """Test HTML with deeply nested tags"""
        html_content = b"""
        <html>
            <body>
                <div><div><div><p>Deeply nested content</p></div></div></div>
            </body>
        </html>
        """
        result = await extract_text_from_html(html_content)
        assert "Deeply nested content" in result
    
    @pytest.mark.asyncio
    async def test_extract_text_from_csv_with_commas(self):
        """Test CSV with values containing commas"""
        csv_content = b'"Name","Description"\n"John","Lives in NYC, works in finance"'
        result = await extract_text_from_csv(csv_content)
        assert "John" in result
        assert "Lives in NYC" in result
        assert "works in finance" in result
