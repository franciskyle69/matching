"""Export all dashboard user accounts to a PDF reference sheet."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from fpdf import FPDF

from accounts.models import get_user_display_name


def _pdf_email(email: str) -> str:
    """Break PDF viewer mailto autodetection (e.g. Outlook) while staying readable."""
    text = str(email or "").strip()
    if not text:
        return ""
    # "[at]" is not matched as an email URI by common PDF readers.
    return text.replace("@", "[at]")


def _ascii(text: str) -> str:
    return (
        str(text or "")
        .replace("\u2014", "-")
        .replace("\u2013", "-")
        .encode("ascii", "replace")
        .decode("ascii")
    )


def _account_row(user: User) -> dict:
    display_name = get_user_display_name(user)
    mentor = getattr(user, "mentor_profile", None)
    mentee = getattr(user, "mentee_profile", None)

    if user.is_staff:
        role = "Coordinator"
        category = "Institutional Admin"
        gender = "Female"
        id_no = "00101"
        program = "Faculty / Staff"
        campus = "-"
    elif mentor:
        role = "Mentor"
        category = mentor.role or "Mentor"
        gender = (mentor.gender or "").title() or "-"
        id_no = (mentor.interests or "").replace("Faculty ID: ", "").replace("Student ID: ", "") or "-"
        program = mentor.program or "-"
        campus = "-"
    elif mentee:
        role = "Mentee"
        category = "Student"
        gender = (mentee.sex or "").title() or "-"
        id_no = mentee.student_id_no or "-"
        program = mentee.program or "-"
        campus = mentee.campus or "-"
    else:
        role = "User"
        category = "-"
        gender = "-"
        id_no = "-"
        program = "-"
        campus = "-"

    return {
        "display_name": display_name,
        "role": role,
        "category": category,
        "gender": gender,
        "email": user.email,
        "username": user.username,
        "id_no": id_no,
        "program": program,
        "campus": campus,
    }


class AccountPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 8, "PeerLink Dashboard - Seeded Accounts", ln=True, align="C")
        self.set_font("Helvetica", "", 9)
        self.cell(
            0,
            6,
            f"Generated {datetime.now().strftime('%B %d, %Y at %H:%M')}  |  Password = email local-part (before [at])",
            ln=True,
            align="C",
        )
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")


class Command(BaseCommand):
    help = "Export all user accounts to a PDF reference sheet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default="",
            help="Output PDF path (default: docs/seeded_accounts.pdf).",
        )

    def handle(self, *args, **options):
        output = options["output"].strip()
        if not output:
            output = str(Path(settings.BASE_DIR) / "docs" / "seeded_accounts.pdf")
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        users = (
            User.objects.select_related("mentor_profile", "mentee_profile")
            .order_by("id")
        )
        rows = [_account_row(user) for user in users]

        pdf = AccountPDF(orientation="L", unit="mm", format="A4")
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=14)
        pdf.add_page()

        col_widths = (8, 38, 18, 28, 14, 54, 34, 14, 22, 22)
        headers = (
            "#",
            "Display Name",
            "Role",
            "Category",
            "Gender",
            "Email",
            "Username",
            "ID No.",
            "Program",
            "Campus",
        )

        pdf.set_font("Helvetica", "B", 8)
        pdf.set_fill_color(230, 236, 245)
        for header, width in zip(headers, col_widths):
            pdf.cell(width, 7, header, border=1, fill=True)
        pdf.ln()

        pdf.set_font("Helvetica", "", 7)
        role_counts = {"Coordinator": 0, "Mentor": 0, "Mentee": 0}
        for index, row in enumerate(rows, start=1):
            role_counts[row["role"]] = role_counts.get(row["role"], 0) + 1
            fill = index % 2 == 0
            if fill:
                pdf.set_fill_color(248, 249, 252)
            values = (
                str(index),
                _ascii(row["display_name"])[:32],
                _ascii(row["role"]),
                _ascii(row["category"])[:18],
                _ascii(row["gender"]),
                _pdf_email(row["email"])[:42],
                _ascii(row["username"])[:22],
                _ascii(str(row["id_no"]))[:8],
                _ascii(row["program"])[:14],
                _ascii(row["campus"])[:12],
            )
            for value, width in zip(values, col_widths):
                pdf.cell(width, 6, value, border=1, fill=fill)
            pdf.ln()

        pdf.ln(6)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, "Summary", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(
            0,
            5,
            f"Total accounts: {len(rows)}  |  "
            f"Coordinators: {role_counts.get('Coordinator', 0)}  |  "
            f"Mentors: {role_counts.get('Mentor', 0)}  |  "
            f"Mentees: {role_counts.get('Mentee', 0)}",
            ln=True,
        )
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Sample logins (password = part before [at]):", ln=True)
        pdf.set_font("Helvetica", "", 8)
        samples = [
            ("Coordinator", "coordinator1@buksu.edu.ph", "coordinator1"),
            ("Faculty mentor", "mentor1@buksu.edu.ph", "mentor1"),
            ("Student mentor", "mentor21@student.buksu.edu.ph", "mentor21"),
            ("Mentee", "mentee1@student.buksu.edu.ph", "mentee1"),
        ]
        for label, email, password in samples:
            pdf.cell(0, 4, f"  {label}: {_pdf_email(email)} / {password}", ln=True)

        pdf.output(str(output_path))
        self.stdout.write(self.style.SUCCESS(f"Wrote {len(rows)} account(s) to {output_path}"))
