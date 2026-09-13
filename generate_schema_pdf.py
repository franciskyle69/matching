"""Generate a multi-page visual ER-style PDF for the project schema."""
from fpdf import FPDF

CONTENT_X = 8
CONTENT_Y = 20
CONTENT_W = 404
CONTENT_H = 266

HEADER_H = 9
ROW_H = 4
TOP_PAD = 4
BOTTOM_PAD = 3

ACCENTS = [
    (232, 122, 32),
    (86, 166, 75),
    (33, 130, 200),
    (206, 158, 30),
    (120, 92, 176),
    (96, 106, 120),
]


PAGES = [
    {
        "title": "Account & Access",
        "subtitle": "Django user plus security, notification, and audit records",
        "color": (250, 236, 229),
        "tables": [
            {
                "name": "auth_user",
                "x": 30,
                "y": 62,
                "w": 82,
                "fields": [
                    "* id            SMALLINT  PK",
                    "username        VARCHAR(150) UNIQUE",
                    "email           VARCHAR(254)",
                    "first_name      VARCHAR(150)",
                    "last_name       VARCHAR(150)",
                    "password        VARCHAR(128)",
                    "is_staff        BOOLEAN",
                    "is_active       BOOLEAN",
                    "date_joined     TIMESTAMP",
                ],
            },
            {
                "name": "user_security_state",
                "x": 190,
                "y": 52,
                "w": 100,
                "fields": [
                    "* id                   SMALLINT  PK",
                    "user_id                FK UNIQUE",
                    "must_change_password   BOOLEAN",
                ],
            },
            {
                "name": "notification",
                "x": 190,
                "y": 110,
                "w": 100,
                "fields": [
                    "* id         SMALLINT  PK",
                    "user_id      FK",
                    "message      VARCHAR(255)",
                    "is_read      BOOLEAN",
                    "action_tab   VARCHAR(50)",
                    "created_at   TIMESTAMP",
                ],
            },
            {
                "name": "audit_log",
                "x": 190,
                "y": 185,
                "w": 100,
                "fields": [
                    "* id         SMALLINT  PK",
                    "user_id      FK NULL",
                    "action       VARCHAR(32)",
                    "model_name   VARCHAR(64)",
                    "object_id    VARCHAR(64)",
                    "created_at   TIMESTAMP",
                ],
            },
        ],
        "connections": [
            ("auth_user", "right", 0.25, "user_security_state", "left", 0.5, "1:1"),
            ("auth_user", "right", 0.5, "notification", "left", 0.5, "1:N"),
            ("auth_user", "right", 0.78, "audit_log", "left", 0.5, "1:N"),
        ],
        "notes": {
            "x": 30,
            "y": 190,
            "w": 130,
            "lines": [
                "auth_user is the single identity table.",
                "Deleting a user cascades to security state,",
                "notifications, profiles, posts and comments.",
                "audit_log keeps rows after user deletion (SET NULL).",
            ],
        },
    },
    {
        "title": "Profile Core",
        "subtitle": "Mentor and mentee profiles with their competency bridge tables",
        "color": (228, 244, 229),
        "tables": [
            {
                "name": "interest_tag",
                "x": 24,
                "y": 66,
                "w": 74,
                "fields": [
                    "* id     SMALLINT  PK",
                    "name     VARCHAR(50) UNIQUE",
                ],
            },
            {
                "name": "mentor_profile",
                "x": 140,
                "y": 46,
                "w": 100,
                "fields": [
                    "* id                SMALLINT  PK",
                    "user_id             FK UNIQUE",
                    "program             VARCHAR(100)",
                    "year_level          SMALLINT",
                    "gpa                 DECIMAL(3,2) NULL",
                    "bio                 TEXT",
                    "skills              JSON",
                    "availability        JSON",
                    "capacity            SMALLINT",
                    "gender              VARCHAR(10)",
                    "approved            BOOLEAN",
                ],
            },
            {
                "name": "mentee_profile",
                "x": 284,
                "y": 46,
                "w": 104,
                "fields": [
                    "* id                SMALLINT  PK",
                    "user_id             FK UNIQUE",
                    "program             VARCHAR(100)",
                    "year_level          SMALLINT",
                    "campus              VARCHAR(100)",
                    "student_id_no       VARCHAR(10)",
                    "contact_no          VARCHAR(11)",
                    "learning_style      VARCHAR(100)",
                    "difficulty_level    SMALLINT",
                    "preferred_gender    VARCHAR(20)",
                    "approved            BOOLEAN",
                ],
            },
            {
                "name": "mentor_competency",
                "x": 140,
                "y": 186,
                "w": 100,
                "fields": [
                    "* id                  SMALLINT  PK",
                    "mentor_id             FK",
                    "competency_id         FK",
                    "proficiency_level     SMALLINT 1-5",
                    "UNIQUE(mentor, competency)",
                ],
            },
            {
                "name": "mentee_competency_need",
                "x": 284,
                "y": 186,
                "w": 104,
                "fields": [
                    "* id                  SMALLINT  PK",
                    "mentee_id             FK",
                    "competency_id         FK",
                    "need_level            SMALLINT 1-5",
                    "UNIQUE(mentee, competency)",
                ],
            },
        ],
        "connections": [
            ("mentor_profile", "bottom", 0.5, "mentor_competency", "top", 0.5, "1:N"),
            ("mentee_profile", "bottom", 0.5, "mentee_competency_need", "top", 0.5, "1:N"),
            ("interest_tag", "right", 0.5, "mentor_profile", "left", 0.45, "N:M"),
            ("interest_tag", "bottom", 0.5, "mentee_profile", "bottom", 0.25, "N:M"),
        ],
        "notes": {
            "x": 24,
            "y": 120,
            "w": 96,
            "lines": [
                "Both profiles are 1:1 with auth_user.",
                "interest_tag is shared through two M2M",
                "join tables created by Django.",
                "competency_id points at the Curriculum page.",
            ],
        },
    },
    {
        "title": "Curriculum Graph",
        "subtitle": "Subject to topic to competency, plus per-user topic selections",
        "color": (224, 238, 250),
        "tables": [
            {
                "name": "subject",
                "x": 28,
                "y": 72,
                "w": 90,
                "fields": [
                    "* id          SMALLINT  PK",
                    "name          VARCHAR(150) UNIQUE",
                    "code          VARCHAR(30)",
                    "category      VARCHAR(20)",
                    "description   TEXT",
                ],
            },
            {
                "name": "topic",
                "x": 165,
                "y": 58,
                "w": 104,
                "fields": [
                    "* id           SMALLINT  PK",
                    "subject_id     FK",
                    "name           VARCHAR(150)",
                    "status         VARCHAR(10)",
                    "created_by     FK NULL",
                    "updated_by     FK NULL",
                    "created_at     TIMESTAMP",
                    "updated_at     TIMESTAMP",
                ],
            },
            {
                "name": "competency",
                "x": 165,
                "y": 168,
                "w": 100,
                "fields": [
                    "* id           SMALLINT  PK",
                    "topic_id       FK",
                    "name           VARCHAR(150)",
                    "description    TEXT",
                ],
            },
            {
                "name": "user_topic_preference",
                "x": 305,
                "y": 100,
                "w": 108,
                "fields": [
                    "* id                    SMALLINT  PK",
                    "user_id                 FK",
                    "subject_id              FK",
                    "topic_id                FK",
                    "target                  VARCHAR(10)",
                    "is_active_selection     BOOLEAN",
                    "selected_at             TIMESTAMP",
                    "cleared_at              TIMESTAMP NULL",
                ],
            },
        ],
        "connections": [
            ("subject", "right", 0.5, "topic", "left", 0.4, "1:N"),
            ("topic", "bottom", 0.4, "competency", "top", 0.4, "1:N"),
            ("topic", "right", 0.5, "user_topic_preference", "left", 0.3, "1:N"),
            ("subject", "bottom", 0.5, "user_topic_preference", "bottom", 0.5, "1:N"),
        ],
        "notes": {
            "x": 28,
            "y": 168,
            "w": 106,
            "lines": [
                "UNIQUE(subject, name) on topic.",
                "UNIQUE(topic, name) on competency.",
                "user_topic_preference keeps history:",
                "is_active_selection plus cleared_at.",
            ],
        },
    },
    {
        "title": "Matching & ML",
        "subtitle": "Pairing requests, training dataset, and model registry",
        "color": (250, 243, 217),
        "tables": [
            {
                "name": "mentee_mentor_request",
                "x": 28,
                "y": 66,
                "w": 104,
                "fields": [
                    "* id            SMALLINT  PK",
                    "mentee_id       FK",
                    "mentor_id       FK",
                    "created_at      TIMESTAMP",
                    "accepted        BOOLEAN",
                    "accepted_at     TIMESTAMP NULL",
                    "UNIQUE(mentee, mentor)",
                ],
            },
            {
                "name": "matching_dataset_record",
                "x": 168,
                "y": 60,
                "w": 106,
                "fields": [
                    "* id           SMALLINT  PK",
                    "mentee_id      FK NULL",
                    "mentor_id      FK NULL",
                    "label          BOOLEAN",
                    "source         VARCHAR(16)",
                    "features       JSON",
                    "created_at     TIMESTAMP",
                ],
            },
            {
                "name": "matching_dataset_topic",
                "x": 306,
                "y": 60,
                "w": 106,
                "fields": [
                    "* id                  SMALLINT  PK",
                    "dataset_record_id     FK",
                    "topic_id              FK NULL",
                    "subject_id            FK NULL",
                    "role                  VARCHAR(10)",
                    "topic_snapshot        VARCHAR(150)",
                ],
            },
            {
                "name": "model_metadata",
                "x": 168,
                "y": 170,
                "w": 130,
                "fields": [
                    "* id                            SMALLINT  PK",
                    "version                         VARCHAR(64) UNIQUE",
                    "status                          VARCHAR(16)",
                    "artifact_path                   VARCHAR(255)",
                    "metrics                         JSON",
                    "feature_names                   JSON",
                    "training_rows                   INTEGER",
                    "topic_count_active_at_train     INTEGER",
                    "created_by                      FK NULL",
                ],
            },
        ],
        "connections": [
            ("matching_dataset_record", "right", 0.5, "matching_dataset_topic", "left", 0.5, "1:N"),
        ],
        "notes": {
            "x": 28,
            "y": 170,
            "w": 122,
            "lines": [
                "External keys, see other pages:",
                "mentee_id, mentor_id -> Profile Core",
                "topic_id, subject_id -> Curriculum Graph",
                "created_by -> auth_user",
                "",
                "Dataset rows survive profile deletion",
                "because both FKs are SET NULL.",
            ],
        },
    },
    {
        "title": "Community & Feed",
        "subtitle": "Mentor announcements, comments, and the social post feed",
        "color": (233, 244, 226),
        "tables": [
            {
                "name": "announcement",
                "x": 28,
                "y": 66,
                "w": 100,
                "fields": [
                    "* id           SMALLINT  PK",
                    "mentor_id      FK",
                    "message        TEXT",
                    "created_at     TIMESTAMP",
                    "deleted_at     TIMESTAMP NULL",
                ],
            },
            {
                "name": "announcement_recipient",
                "x": 178,
                "y": 54,
                "w": 110,
                "fields": [
                    "* id                  SMALLINT  PK",
                    "announcement_id       FK",
                    "user_id               FK",
                    "UNIQUE(announcement, user)",
                ],
            },
            {
                "name": "comment",
                "x": 178,
                "y": 150,
                "w": 104,
                "fields": [
                    "* id                SMALLINT  PK",
                    "author_id           FK",
                    "announcement_id     FK",
                    "content             TEXT",
                    "created_at          TIMESTAMP",
                ],
            },
            {
                "name": "user_post",
                "x": 310,
                "y": 96,
                "w": 100,
                "fields": [
                    "* id           SMALLINT  PK",
                    "author_id      FK",
                    "text           TEXT",
                    "image          IMAGE NULL",
                    "category       VARCHAR(20)",
                    "likes          M2M auth_user",
                    "created_at     TIMESTAMP",
                ],
            },
            {
                "name": "post_comment",
                "x": 310,
                "y": 200,
                "w": 100,
                "fields": [
                    "* id           SMALLINT  PK",
                    "post_id        FK",
                    "author_id      FK",
                    "content        TEXT",
                    "created_at     TIMESTAMP",
                ],
            },
        ],
        "connections": [
            ("announcement", "right", 0.3, "announcement_recipient", "left", 0.5, "1:N"),
            ("announcement", "right", 0.75, "comment", "left", 0.3, "1:N"),
            ("user_post", "bottom", 0.5, "post_comment", "top", 0.5, "1:N"),
        ],
        "notes": {
            "x": 28,
            "y": 150,
            "w": 116,
            "lines": [
                "announcement uses soft delete (deleted_at).",
                "No recipient rows means every accepted",
                "mentee of that mentor can see the post.",
                "mentor_id -> Profile Core page.",
                "author_id and user_id -> auth_user.",
            ],
        },
    },
    {
        "title": "Cross-Module Map",
        "subtitle": "How auth_user connects the five areas of the database",
        "color": (240, 240, 242),
        "tables": [
            {
                "name": "mentor_profile",
                "x": 42,
                "y": 52,
                "w": 92,
                "fields": [
                    "Profile Core page",
                    "mentoring capacity and approval",
                ],
            },
            {
                "name": "curriculum",
                "x": 42,
                "y": 136,
                "w": 92,
                "fields": [
                    "subject / topic / competency",
                    "user_topic_preference",
                ],
            },
            {
                "name": "mentee_profile",
                "x": 42,
                "y": 216,
                "w": 92,
                "fields": [
                    "Profile Core page",
                    "learning needs and approval",
                ],
            },
            {
                "name": "auth_user",
                "x": 180,
                "y": 132,
                "w": 76,
                "fields": [
                    "identity hub",
                    "one row per person",
                ],
            },
            {
                "name": "matching",
                "x": 302,
                "y": 52,
                "w": 96,
                "fields": [
                    "mentee_mentor_request",
                    "matching_dataset_record",
                    "model_metadata",
                ],
            },
            {
                "name": "operations",
                "x": 302,
                "y": 136,
                "w": 96,
                "fields": [
                    "notification",
                    "audit_log",
                ],
            },
            {
                "name": "community",
                "x": 302,
                "y": 216,
                "w": 96,
                "fields": [
                    "announcement + recipients",
                    "comment / user_post",
                ],
            },
        ],
        "connections": [
            ("auth_user", "left", 0.2, "mentor_profile", "right", 0.5, "1:1"),
            ("auth_user", "left", 0.5, "curriculum", "right", 0.5, "1:N prefs"),
            ("auth_user", "left", 0.8, "mentee_profile", "right", 0.5, "1:1"),
            ("auth_user", "right", 0.2, "matching", "left", 0.5, "via profiles"),
            ("auth_user", "right", 0.5, "operations", "left", 0.5, "1:N"),
            ("auth_user", "right", 0.8, "community", "left", 0.5, "1:N"),
        ],
        "notes": {
            "x": 150,
            "y": 210,
            "w": 136,
            "lines": [
                "Module to module links:",
                "mentor_profile / mentee_profile -> matching",
                "mentor_profile / mentee_profile -> curriculum",
                "mentor_profile -> community (announcements)",
                "curriculum -> matching (dataset topic snapshot)",
            ],
        },
    },
]


class SchemaPDF(FPDF):
    def header(self):
        self.set_text_color(28, 35, 47)
        self.set_font("Helvetica", "B", 17)
        self.cell(0, 9, "PeerLink Database Schema", new_x="LMARGIN", new_y="NEXT", align="C")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(95, 100, 112)
        self.cell(0, 5, "Entity relationship diagram, one domain per page", new_x="LMARGIN", new_y="NEXT", align="C")

    def footer(self):
        self.set_y(-10)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(125, 125, 125)
        self.cell(0, 5, f"Page {self.page_no()}/{{nb}}", align="C")


def table_height(field_count):
    return HEADER_H + TOP_PAD + field_count * ROW_H + BOTTOM_PAD


def table_rect(table):
    return (table["x"], table["y"], table["w"], table_height(len(table["fields"])))


def anchor_point(table, side, fraction):
    x, y, w, h = table_rect(table)
    if side == "left":
        return x, y + h * fraction
    if side == "right":
        return x + w, y + h * fraction
    if side == "top":
        return x + w * fraction, y
    return x + w * fraction, y + h


def segment_hits_rect(x1, y1, x2, y2, rect, pad=2.5):
    rx, ry, rw, rh = rect
    left, top = rx - pad, ry - pad
    right, bottom = rx + rw + pad, ry + rh + pad
    if abs(y1 - y2) < 1e-6:
        lo, hi = sorted((x1, x2))
        return top <= y1 <= bottom and lo <= right and hi >= left
    lo, hi = sorted((y1, y2))
    return left <= x1 <= right and lo <= bottom and hi >= top


def path_cost(points, obstacles):
    hits = 0
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        for rect in obstacles:
            if segment_hits_rect(x1, y1, x2, y2, rect):
                hits += 1
    return hits


STUB = 6.0


def lane_bounds(side1, a1, side2, a2, low, high):
    """Keep the elbow lane outside both boxes, on the side each anchor exits."""
    outward = {"right": 1, "bottom": 1, "left": -1, "top": -1}
    for side, anchor in ((side1, a1), (side2, a2)):
        if outward[side] > 0:
            low = max(low, anchor + STUB)
        else:
            high = min(high, anchor - STUB)
    return low, high


def lane_candidates(a, b, low, high):
    if low > high:
        return []
    mid = min(max((a + b) / 2, low), high)
    values = [mid]
    for step in range(1, 80):
        values.append(mid + step * 2.5)
        values.append(mid - step * 2.5)
    return [v for v in values if low <= v <= high]


def pick_path(candidates, make_points, obstacles):
    best, best_cost = None, None
    for lane in candidates:
        points = make_points(lane)
        cost = path_cost(points, obstacles)
        if cost == 0:
            return points
        if best_cost is None or cost < best_cost:
            best, best_cost = points, cost
    return best


def detour_path(p1, side1, p2, side2, obstacles):
    """Six point path used when the two anchors face away from each other."""
    x1, y1 = p1
    x2, y2 = p2
    horizontal = {"left", "right"}
    sign = {"right": 1, "bottom": 1, "left": -1, "top": -1}
    if side1 in horizontal:
        sx = x1 + sign[side1] * STUB
        ex = x2 + sign[side2] * STUB
        candidates = lane_candidates(y1, y2, CONTENT_Y + 8, CONTENT_Y + CONTENT_H - 8)
        return pick_path(
            candidates,
            lambda lane: [(x1, y1), (sx, y1), (sx, lane), (ex, lane), (ex, y2), (x2, y2)],
            obstacles,
        )
    sy = y1 + sign[side1] * STUB
    ey = y2 + sign[side2] * STUB
    candidates = lane_candidates(x1, x2, CONTENT_X + 8, CONTENT_X + CONTENT_W - 8)
    return pick_path(
        candidates,
        lambda lane: [(x1, y1), (x1, sy), (lane, sy), (lane, ey), (x2, ey), (x2, y2)],
        obstacles,
    )


def build_path(p1, side1, p2, side2, obstacles):
    x1, y1 = p1
    x2, y2 = p2
    horizontal = {"left", "right"}

    if (side1 in horizontal) == (side2 in horizontal):
        if side1 in horizontal:
            low, high = lane_bounds(side1, x1, side2, x2, CONTENT_X + 4, CONTENT_X + CONTENT_W - 4)
            candidates = lane_candidates(x1, x2, low, high)
            path = pick_path(
                candidates,
                lambda lane: [(x1, y1), (lane, y1), (lane, y2), (x2, y2)],
                obstacles,
            )
        else:
            low, high = lane_bounds(side1, y1, side2, y2, CONTENT_Y + 6, CONTENT_Y + CONTENT_H - 6)
            candidates = lane_candidates(y1, y2, low, high)
            path = pick_path(
                candidates,
                lambda lane: [(x1, y1), (x1, lane), (x2, lane), (x2, y2)],
                obstacles,
            )
        return path or detour_path(p1, side1, p2, side2, obstacles)

    if side1 in horizontal:
        return [(x1, y1), (x2, y1), (x2, y2)]
    return [(x1, y1), (x1, y2), (x2, y2)]


def draw_backdrop(pdf, page):
    pdf.set_fill_color(*page["color"])
    pdf.set_draw_color(206, 208, 212)
    pdf.set_line_width(0.2)
    pdf.rect(CONTENT_X, CONTENT_Y, CONTENT_W, CONTENT_H, style="FD")
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(62, 66, 74)
    pdf.text(CONTENT_X + 5, CONTENT_Y + 8, page["title"])
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(105, 110, 118)
    pdf.text(CONTENT_X + 5, CONTENT_Y + 13.5, page["subtitle"])


def draw_table(pdf, table, accent):
    x, y, w, h = table_rect(table)
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(118, 122, 128)
    pdf.set_line_width(0.3)
    pdf.rect(x, y, w, h, style="FD")

    pdf.set_fill_color(*accent)
    pdf.rect(x, y, w, HEADER_H, style="F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    pdf.text(x + 3, y + 6.2, table["name"])

    pdf.set_text_color(32, 36, 42)
    pdf.set_font("Courier", "", 6.6)
    line_y = y + HEADER_H + TOP_PAD + 1
    for field in table["fields"]:
        pdf.text(x + 3, line_y, field)
        line_y += ROW_H


def draw_notes(pdf, notes):
    if not notes:
        return
    x, y, w = notes["x"], notes["y"], notes["w"]
    h = 10 + len(notes["lines"]) * 4.2
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(178, 182, 188)
    pdf.set_line_width(0.25)
    pdf.rect(x, y, w, h, style="FD")
    pdf.set_font("Helvetica", "B", 7.6)
    pdf.set_text_color(70, 74, 82)
    pdf.text(x + 3, y + 5.4, "Notes")
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(88, 92, 100)
    line_y = y + 10
    for line in notes["lines"]:
        pdf.text(x + 3, line_y, line)
        line_y += 4.2


def draw_endpoint(pdf, x, y):
    pdf.set_fill_color(70, 74, 82)
    pdf.ellipse(x - 0.7, y - 0.7, 1.4, 1.4, style="F")


def draw_label(pdf, points, label):
    if not label:
        return
    index = len(points) // 2
    x1, y1 = points[index - 1]
    x2, y2 = points[index]
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    pdf.set_font("Helvetica", "B", 6.6)
    width = pdf.get_string_width(label) + 3
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(178, 182, 188)
    pdf.set_line_width(0.2)
    pdf.rect(cx - width / 2, cy - 2.6, width, 5.2, style="FD")
    pdf.set_text_color(60, 64, 72)
    pdf.text(cx - width / 2 + 1.5, cy + 1.2, label)


def draw_connection(pdf, points, label):
    pdf.set_draw_color(88, 92, 100)
    pdf.set_line_width(0.4)
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        pdf.line(x1, y1, x2, y2)
    draw_endpoint(pdf, *points[0])
    draw_endpoint(pdf, *points[-1])
    draw_label(pdf, points, label)


def render_page(pdf, page, accent):
    pdf.add_page()
    draw_backdrop(pdf, page)

    tables = {table["name"]: table for table in page["tables"]}
    for table in page["tables"]:
        draw_table(pdf, table, accent)
    draw_notes(pdf, page.get("notes"))

    notes = page.get("notes")
    note_rect = None
    if notes:
        note_rect = (notes["x"], notes["y"], notes["w"], 10 + len(notes["lines"]) * 4.2)

    for src_name, src_side, src_frac, dst_name, dst_side, dst_frac, label in page["connections"]:
        src, dst = tables[src_name], tables[dst_name]
        obstacles = [
            table_rect(t) for name, t in tables.items() if name not in (src_name, dst_name)
        ]
        if note_rect:
            obstacles.append(note_rect)
        p1 = anchor_point(src, src_side, src_frac)
        p2 = anchor_point(dst, dst_side, dst_frac)
        points = build_path(p1, src_side, p2, dst_side, obstacles)
        draw_connection(pdf, points, label)


def build_pdf():
    pdf = SchemaPDF(orientation="L", unit="mm", format="A3")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=False)

    for index, page in enumerate(PAGES):
        render_page(pdf, page, ACCENTS[index % len(ACCENTS)])

    output_path = "database_schema.pdf"
    pdf.output(output_path)
    print(f"PDF saved to: {output_path}")


if __name__ == "__main__":
    build_pdf()
