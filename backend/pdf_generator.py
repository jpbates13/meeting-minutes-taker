"""PDF generation utilities for meeting transcripts and minutes."""

import io
import re
import markdown
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, darkblue
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Line
from reportlab.graphics import renderPDF


class PDFGenerator:
    """Handles PDF generation for meeting documents."""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.setup_custom_styles()

    def setup_custom_styles(self):
        """Define custom styles for different document types."""
        
        # Console/monospace style for transcripts
        self.styles.add(ParagraphStyle(
            name='Console',
            parent=self.styles['Normal'],
            fontName='Courier',
            fontSize=10,
            leading=12,
            leftIndent=20,
            rightIndent=20,
            spaceAfter=6,
            textColor=black
        ))
        
        # Elegant header styles for minutes
        self.styles.add(ParagraphStyle(
            name='OrganizationName',
            parent=self.styles['Title'],
            fontName='Times-Bold',
            fontSize=20,
            spaceAfter=6,
            alignment=TA_CENTER,
            textColor=HexColor('#1a365d')
        ))
        
        self.styles.add(ParagraphStyle(
            name='DocumentType',
            parent=self.styles['Normal'],
            fontName='Times-Italic',
            fontSize=12,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=HexColor('#2d3748')
        ))
        
        # Meeting title with elegant serif font
        self.styles.add(ParagraphStyle(
            name='MeetingTitle',
            parent=self.styles['Title'],
            fontName='Times-Bold',
            fontSize=16,
            spaceAfter=12,
            spaceBefore=12,
            alignment=TA_CENTER,
            textColor=HexColor('#2c3e50')
        ))
        
        # Header information
        self.styles.add(ParagraphStyle(
            name='HeaderInfo',
            parent=self.styles['Normal'],
            fontName='Times-Roman',
            fontSize=11,
            spaceAfter=8,
            alignment=TA_CENTER,
            textColor=HexColor('#4a5568')
        ))
        
        # Section headers with elegant styling
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading1'],
            fontName='Times-Bold',
            fontSize=13,
            spaceAfter=8,
            spaceBefore=16,
            textColor=HexColor('#2d3748'),
            borderWidth=0,
            borderColor=HexColor('#e2e8f0'),
            borderPadding=4
        ))
        
        self.styles.add(ParagraphStyle(
            name='SubsectionHeader',
            parent=self.styles['Heading2'],
            fontName='Times-Bold',
            fontSize=12,
            spaceAfter=6,
            spaceBefore=10,
            textColor=HexColor('#4a5568')
        ))

        self.styles.add(ParagraphStyle(
            name='TertiaryHeader',
            parent=self.styles['Normal'],
            fontName='Times-BoldItalic',
            fontSize=11,
            leading=13,
            spaceAfter=5,
            spaceBefore=8,
            textColor=HexColor('#2f4858')
        ))

        self.styles.add(ParagraphStyle(
            name='QuaternaryHeader',
            parent=self.styles['Normal'],
            fontName='Times-Bold',
            fontSize=10.5,
            leading=12,
            spaceAfter=4,
            spaceBefore=6,
            textColor=HexColor('#4a5568')
        ))
        
        # Enhanced body text with serif font
        self.styles.add(ParagraphStyle(
            name='MinutesBody',
            parent=self.styles['Normal'],
            fontName='Times-Roman',
            fontSize=11,
            leading=14,
            spaceAfter=8,
            leftIndent=12,
            rightIndent=12,
            alignment=TA_JUSTIFY
        ))
        
        # Bullet point style
        self.styles.add(ParagraphStyle(
            name='BulletPoint',
            parent=self.styles['Normal'],
            fontName='Times-Roman',
            fontSize=11,
            leading=14,
            spaceAfter=4,
            leftIndent=24,
            rightIndent=12,
            bulletIndent=12
        ))

        self.styles.add(ParagraphStyle(
            name='BlockQuote',
            parent=self.styles['Normal'],
            fontName='Times-Italic',
            fontSize=10.5,
            leading=14,
            leftIndent=26,
            rightIndent=20,
            spaceBefore=4,
            spaceAfter=6,
            textColor=HexColor('#4a5568')
        ))
        
        # Footer style
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontName='Times-Italic',
            fontSize=9,
            alignment=TA_CENTER,
            textColor=HexColor('#718096')
        ))

    def _draw_page_chrome(self, canvas, doc, document_label: str, organization_name: str):
        """Render a subtle footer line, page number, and document label on each page."""
        canvas.saveState()

        y = 0.58 * inch
        canvas.setStrokeColor(HexColor('#e2e8f0'))
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, y + 10, letter[0] - doc.rightMargin, y + 10)

        canvas.setFillColor(HexColor('#718096'))
        canvas.setFont('Times-Italic', 8)
        canvas.drawString(doc.leftMargin, y, organization_name)
        canvas.drawCentredString(letter[0] / 2, y, document_label)
        canvas.drawRightString(letter[0] - doc.rightMargin, y, f'Page {canvas.getPageNumber()}')

        canvas.restoreState()

    def _create_header_section(
        self,
        story,
        meeting_title=None,
        meeting_date=None,
        organization_name: str = "Your Organization",
    ):
        """Create an elegant header section for the minutes PDF."""
        
        # Organization name
        story.append(Paragraph(organization_name, self.styles['OrganizationName']))
        story.append(Paragraph("Meeting Records", self.styles['DocumentType']))
        
        # Add a subtle line
        line_drawing = Drawing(400, 2)
        line_drawing.add(Line(50, 1, 350, 1, strokeColor=HexColor('#e2e8f0'), strokeWidth=1))
        story.append(line_drawing)
        story.append(Spacer(1, 12))
        
        # Meeting title
        if meeting_title:
            story.append(Paragraph(meeting_title, self.styles['MeetingTitle']))
        else:
            story.append(Paragraph("Board Meeting Minutes", self.styles['MeetingTitle']))
        
        # Meeting date and generated timestamp
        if meeting_date:
            story.append(Paragraph(meeting_date, self.styles['HeaderInfo']))
        
        story.append(Paragraph(f"Document generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", 
                              self.styles['HeaderInfo']))
        
        # Another subtle line and spacing
        line_drawing2 = Drawing(400, 2)
        line_drawing2.add(Line(50, 1, 350, 1, strokeColor=HexColor('#e2e8f0'), strokeWidth=1))
        story.append(line_drawing2)
        story.append(Spacer(1, 24))

    def generate_transcript_pdf(
        self,
        transcript_text: str,
        meeting_title: str = None,
        meeting_date: str = None,
        organization_name: str = "Your Organization",
    ) -> bytes:
        """
        Generate a PDF for meeting transcript with console-style formatting.
        
        Args:
            transcript_text: Raw transcript text
            meeting_title: Optional title for the meeting
            meeting_date: Optional date string for the meeting
            
        Returns:
            PDF bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        story = []
        
        # Enhanced header for transcript
        story.append(Paragraph(organization_name, self.styles['OrganizationName']))
        story.append(Paragraph("Meeting Records", self.styles['DocumentType']))
        
        # Add a subtle line
        line_drawing = Drawing(400, 2)
        line_drawing.add(Line(50, 1, 350, 1, strokeColor=HexColor('#e2e8f0'), strokeWidth=1))
        story.append(line_drawing)
        story.append(Spacer(1, 12))
        
        # Title section
        title = meeting_title or "Meeting Transcript"
        story.append(Paragraph(title, self.styles['MeetingTitle']))
        
        if meeting_date:
            story.append(Paragraph(meeting_date, self.styles['HeaderInfo']))
        
        story.append(Paragraph(f"Document generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", 
                              self.styles['HeaderInfo']))
        
        # Another subtle line and spacing
        line_drawing2 = Drawing(400, 2)
        line_drawing2.add(Line(50, 1, 350, 1, strokeColor=HexColor('#e2e8f0'), strokeWidth=1))
        story.append(line_drawing2)
        story.append(Spacer(1, 20))
        
        # Note about transcript format
        story.append(Paragraph(
            "<i>This document contains an AI-generated transcription of the meeting proceedings. "
            "While efforts have been made to ensure accuracy, transcription errors may occur. </i>",
            self.styles['HeaderInfo']
        ))
        story.append(Spacer(1, 16))
        
        # Add transcript content with console styling
        # Split transcript into paragraphs and preserve speaker formatting
        lines = transcript_text.split('\n')
        for line in lines:
            if line.strip():
                # Check if line starts with speaker pattern (e.g., "Speaker 1:" or "[00:05:30]")
                if re.match(r'^(Speaker \d+:|SPEAKER_\d+:|\[\d+:\d+:\d+\])', line.strip()):
                    # Speaker line - make it slightly more prominent
                    story.append(Paragraph(f"<b>{line.strip()}</b>", self.styles['Console']))
                else:
                    story.append(Paragraph(line.strip(), self.styles['Console']))
            else:
                story.append(Spacer(1, 6))
        
        story.append(Spacer(1, 18))

        doc.build(
            story,
            onFirstPage=lambda c, d: self._draw_page_chrome(c, d, 'Meeting Transcript', organization_name),
            onLaterPages=lambda c, d: self._draw_page_chrome(c, d, 'Meeting Transcript', organization_name),
        )
        buffer.seek(0)
        return buffer.getvalue()

    def generate_minutes_pdf(
        self,
        minutes_markdown: str,
        meeting_title: str = None,
        meeting_date: str = None,
        include_ai_disclaimer: bool = True,
        organization_name: str = "Your Organization",
    ) -> bytes:
        """
        Generate a beautifully formatted PDF for meeting minutes.
        
        Args:
            minutes_markdown: Markdown-formatted minutes
            meeting_title: Optional title for the meeting
            meeting_date: Optional date string for the meeting
            
        Returns:
            PDF bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        story = []
        
        # Create elegant header
        self._create_header_section(story, meeting_title, meeting_date, organization_name)
        
        # Parse markdown and convert to PDF elements
        self._parse_markdown_to_story(
            minutes_markdown,
            story,
            include_ai_disclaimer=include_ai_disclaimer,
        )
        
        story.append(Spacer(1, 18))

        doc.build(
            story,
            onFirstPage=lambda c, d: self._draw_page_chrome(c, d, 'Meeting Minutes', organization_name),
            onLaterPages=lambda c, d: self._draw_page_chrome(c, d, 'Meeting Minutes', organization_name),
        )
        buffer.seek(0)
        return buffer.getvalue()

    def _parse_markdown_to_story(
        self,
        markdown_text: str,
        story: list,
        include_ai_disclaimer: bool = True,
    ):
        """
        Parse markdown content and add appropriate PDF elements to the story.
        
        Args:
            markdown_text: Markdown content to parse
            story: ReportLab story list to append elements to
        """
        lines = markdown_text.split('\n')
        i = 0
        
        if include_ai_disclaimer:
            story.append(Paragraph(
                "<i>These minutes are a summary of the meeting proceedings prepared by an AI system. "
                "While efforts have been made to ensure accuracy, these minutes are not guaranteed to be complete or entirely accurate. </i>",
                self.styles['HeaderInfo']
            ))
            story.append(Spacer(1, 16))

        while i < len(lines):
            line = lines[i].strip()
            
            if not line:
                story.append(Spacer(1, 6))
                i += 1
                continue
            
            # Headers with enhanced styling (supports # through ######)
            heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if heading_match:
                level = len(heading_match.group(1))
                heading_text = self._format_inline_markdown(heading_match.group(2).strip())

                if level == 1:
                    story.append(Paragraph(heading_text, self.styles['SectionHeader']))
                    # Add a subtle line under major headers
                    line_drawing = Drawing(400, 1)
                    line_drawing.add(Line(12, 0, 300, 0, strokeColor=HexColor('#e2e8f0'), strokeWidth=0.5))
                    story.append(line_drawing)
                    story.append(Spacer(1, 8))
                elif level == 2:
                    story.append(Paragraph(heading_text, self.styles['SubsectionHeader']))
                    story.append(Spacer(1, 4))
                elif level == 3:
                    story.append(Paragraph(heading_text, self.styles['TertiaryHeader']))
                    story.append(Spacer(1, 4))
                else:
                    # Treat h4-h6 as compact but distinct subheads.
                    story.append(Paragraph(heading_text, self.styles['QuaternaryHeader']))
                    story.append(Spacer(1, 2))

            # Markdown horizontal rule
            elif re.match(r'^(-{3,}|\*{3,}|_{3,})$', line):
                divider = Drawing(400, 1)
                divider.add(Line(12, 0, 310, 0, strokeColor=HexColor('#d9e2ec'), strokeWidth=0.6))
                story.append(Spacer(1, 4))
                story.append(divider)
                story.append(Spacer(1, 6))

            # Block quotes for callouts/notes
            elif line.startswith('> '):
                quote_text = self._format_inline_markdown(line[2:].strip())
                story.append(Paragraph(quote_text, self.styles['BlockQuote']))
            
            # Enhanced bullet points
            elif line.startswith('- ') or line.startswith('* '):
                bullet_text = f"• {line[2:]}"
                formatted_text = self._format_inline_markdown(bullet_text)
                story.append(Paragraph(formatted_text, self.styles['BulletPoint']))
            
            # Numbered lists
            elif re.match(r'^\d+\.\s+', line):
                formatted_text = self._format_inline_markdown(line)
                story.append(Paragraph(formatted_text, self.styles['BulletPoint']))
            
            # Regular paragraphs with justified text
            else:
                formatted_text = self._format_inline_markdown(line)
                story.append(Paragraph(formatted_text, self.styles['MinutesBody']))
            
            i += 1

    def _format_inline_markdown(self, text: str) -> str:
        """
        Convert inline markdown formatting to ReportLab markup.
        
        Args:
            text: Text with markdown formatting
            
        Returns:
            Text with ReportLab XML markup
        """
        # Bold text
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        text = re.sub(r'__(.*?)__', r'<b>\1</b>', text)
        
        # Italic text
        text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
        text = re.sub(r'_(.*?)_', r'<i>\1</i>', text)
        
        # Code/monospace text
        text = re.sub(r'`(.*?)`', r'<font name="Courier" size="10">\1</font>', text)
        
        # Handle common special characters and improve readability
        text = text.replace('—', '—')  # em dash
        text = text.replace('--', '—')  # convert double dash to em dash
        text = text.replace('...', '...')
        
        return text


def generate_transcript_pdf(
    transcript_text: str,
    meeting_title: str = None,
    meeting_date: str = None,
    organization_name: str = "Your Organization",
) -> bytes:
    """Convenience function to generate transcript PDF."""
    generator = PDFGenerator()
    return generator.generate_transcript_pdf(
        transcript_text,
        meeting_title,
        meeting_date,
        organization_name,
    )


def generate_minutes_pdf(
    minutes_markdown: str,
    meeting_title: str = None,
    meeting_date: str = None,
    include_ai_disclaimer: bool = True,
    organization_name: str = "Your Organization",
) -> bytes:
    """Convenience function to generate minutes PDF."""
    generator = PDFGenerator()
    return generator.generate_minutes_pdf(
        minutes_markdown,
        meeting_title,
        meeting_date,
        include_ai_disclaimer=include_ai_disclaimer,
        organization_name=organization_name,
    )