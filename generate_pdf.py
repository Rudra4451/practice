import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Suppress headers/footers on cover page
        if self._pageNumber == 1:
            self.restoreState()
            return

        # Header
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#FF5C00"))
        self.drawString(54, 750, "TyProX")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#71717A"))
        self.drawString(90, 750, "|   A-Z Architecture, UI/UX & System Specification Document")
        
        self.setStrokeColor(colors.HexColor("#E4E4E7"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)

        # Footer
        self.line(54, 45, 558, 45)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#71717A"))
        self.drawString(54, 32, "Confidential & Proprietary — TyProX Engineering")
        
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_str)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#0F0F10")
    accent_color = colors.HexColor("#FF5C00")
    secondary_text = colors.HexColor("#52525B")
    bg_light = colors.HexColor("#F4F4F5")
    code_bg = colors.HexColor("#18181B")

    styles.add(ParagraphStyle(
        name='CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=32,
        leading=38,
        textColor=accent_color,
        spaceAfter=10
    ))

    styles.add(ParagraphStyle(
        name='CoverSubtitle',
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=22,
        textColor=primary_color,
        spaceAfter=15
    ))

    styles.add(ParagraphStyle(
        name='CoverMeta',
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=secondary_text,
        spaceAfter=30
    ))

    styles.add(ParagraphStyle(
        name='DocHeading1',
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=accent_color,
        spaceBefore=18,
        spaceAfter=10,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        name='DocHeading2',
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        name='DocHeading3',
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#27272A"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    ))

    styles.add(ParagraphStyle(
        name='DocBody',
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#27272A"),
        spaceAfter=8
    ))

    styles.add(ParagraphStyle(
        name='DocBullet',
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#27272A"),
        leftIndent=15,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        name='CodeSnippet',
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#F4F4F5"),
        spaceBefore=4,
        spaceAfter=4
    ))

    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    ))

    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#18181B")
    ))

    story = []

    # --- COVER PAGE ---
    story.append(Spacer(1, 40))
    story.append(Paragraph("TyProX Engine", styles['CoverTitle']))
    story.append(Paragraph("Full Technical Architecture, UI/UX Design & System Blueprint (A-Z)", styles['CoverSubtitle']))
    story.append(HRFlowable(width="100%", thickness=3, color=accent_color, spaceBefore=5, spaceAfter=20))
    
    meta_text = """
    <b>Document Version:</b> 1.0.0 (Production Blueprint)<br/>
    <b>Target Platform:</b> Next.js 16.2 (App Router) / React 19 / Supabase / TailwindCSS v4<br/>
    <b>Author:</b> TyProX Core Engineering Team<br/>
    <b>Scope:</b> Complete end-to-end breakdown from UI design system, Web Worker state engine, anti-cheat math, real-time database schema, to API endpoints and deployment.
    """
    story.append(Paragraph(meta_text, styles['CoverMeta']))
    story.append(Spacer(1, 20))

    # Executive Summary Box
    exec_summary = """
    <b>Executive Summary:</b><br/>
    TyProX is a state-of-the-art, high-frequency analytical typing platform and gamified ecosystem designed for hyper-speed text input, micro-second telemetry processing, and deep performance diagnostics. Unlike traditional web applications that calculate statistics in the main rendering thread, TyProX decouples user input capture from analytical evaluation using a dedicated Web Worker (<code>analytics.worker.ts</code>). Coupled with Supabase PostgreSQL Row-Level Security (RLS), real-time WebSocket subscriptions, dynamic collectible companion pets, and anti-cheat timing analysis, TyProX offers an uncompromised competitive environment.
    """
    exec_table = Table([[Paragraph(exec_summary, styles['DocBody'])]], colWidths=[504])
    exec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E4E4E7")),
        ('PADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(exec_table)
    story.append(Spacer(1, 30))

    # Table of Contents Summary
    story.append(Paragraph("Table of Contents", styles['DocHeading2']))
    toc_data = [
        ["Section 1", "Executive Overview & Architectural Philosophy"],
        ["Section 2", "System Architecture & Core Technology Stack"],
        ["Section 3", "UI/UX Design Engine & Component Architecture"],
        ["Section 4", "State Management & Decoupled Web Worker Telemetry"],
        ["Section 5", "Database Architecture & Full PostgreSQL Schema"],
        ["Section 6", "API Specifications & Server Security Matrix"],
        ["Section 7", "Anti-Cheat Mechanics & Mathematical Formulas"],
        ["Section 8", "Virtual Cat Companion Ecosystem"],
        ["Section 9", "Deployment, SEO & Performance Verification"]
    ]
    toc_table_rows = [[Paragraph(f"<b>{r[0]}</b>", styles['TableCell']), Paragraph(r[1], styles['TableCell'])] for r in toc_data]
    toc_table = Table(toc_table_rows, colWidths=[100, 404])
    toc_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#E4E4E7")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # --- SECTION 1 ---
    story.append(Paragraph("1. Executive Overview & Architectural Philosophy", styles['DocHeading1']))
    story.append(Paragraph(
        "TyProX was built to solve the modern performance issues found in web-based typing software. Traditional platforms suffer from input frame drops during long runs due to synchronous state recalculations on every single keypress. TyProX introduces three fundamental engineering tenets:", styles['DocBody']))
    
    story.append(Paragraph("• <b>Zero-Input Latency:</b> Keystroke events are captured in an un-lagged focus trap textarea, immediately echoed locally, and dispatched to background Web Workers.", styles['DocBullet']))
    story.append(Paragraph("• <b>Rich Modern Aesthetics:</b> Built using a cohesive Dark/Light glassmorphism design system with custom HSL tokens, dynamic radial ambient glows, and fluid Framer Motion transitions.", styles['DocBullet']))
    story.append(Paragraph("• <b>Comprehensive Gamification & Analytics:</b> Features collectibles (Virtual Cat Companions), multi-tier leaderboards (Grandmaster to Bronze), full replay playback, and detailed key/bigram bottleneck speed analysis.", styles['DocBullet']))

    # --- SECTION 2 ---
    story.append(Spacer(1, 10))
    story.append(Paragraph("2. System Architecture & Core Technology Stack", styles['DocHeading1']))
    
    stack_data = [
        [Paragraph("Layer", styles['TableHeader']), Paragraph("Technology", styles['TableHeader']), Paragraph("Role & Description", styles['TableHeader'])],
        [Paragraph("Framework", styles['TableCell']), Paragraph("Next.js 16.2.9 (App Router)", styles['TableCell']), Paragraph("Server Component rendering, API routes, SEO route generation", styles['TableCell'])],
        [Paragraph("UI Library", styles['TableCell']), Paragraph("React 19.2.4", styles['TableCell']), Paragraph("Concurrent mode UI components, hooks, ref management", styles['TableCell'])],
        [Paragraph("Language", styles['TableCell']), Paragraph("TypeScript 5.x", styles['TableCell']), Paragraph("End-to-end type safety, Zod validation models, strict mode", styles['TableCell'])],
        [Paragraph("Styling Engine", styles['TableCell']), Paragraph("TailwindCSS v4 + CSS Variables", styles['TableCell']), Paragraph("Design token system, glassmorphism utilities, dark/light themes", styles['TableCell'])],
        [Paragraph("State Engine", styles['TableCell']), Paragraph("Zustand v5", styles['TableCell']), Paragraph("Client-side reactive store with local persistence middleware", styles['TableCell'])],
        [Paragraph("Background Worker", styles['TableCell']), Paragraph("Web Worker API (Worker)", styles['TableCell']), Paragraph("High-frequency telemetry math, WPM/RSD calculation, timeline builder", styles['TableCell'])],
        [Paragraph("Database & Auth", styles['TableCell']), Paragraph("Supabase PostgreSQL + SSR", styles['TableCell']), Paragraph("Row-Level Security (RLS), OAuth (Google/GitHub), Realtime subscriptions", styles['TableCell'])],
        [Paragraph("Visualizations", styles['TableCell']), Paragraph("Recharts 3.8.1 + Framer Motion", styles['TableCell']), Paragraph("Second-by-second speed timeline graphs and layout animations", styles['TableCell'])]
    ]
    stack_table = Table(stack_data, colWidths=[90, 160, 254])
    stack_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D4D4D8")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(stack_table)

    # --- SECTION 3 ---
    story.append(Spacer(1, 10))
    story.append(Paragraph("3. UI/UX Design Engine & Component Architecture", styles['DocHeading1']))
    story.append(Paragraph(
        "The TyProX visual layer emphasizes high accessibility, low visual fatigue, and instant user feedback. Key components include:", styles['DocBody']))
    
    ui_components = [
        ("TypingContainer (components/typing/typing-container.tsx)", 
         "Main engine shell containing top configuration bar (mode/duration selectors), real-time glass statistics cards, transparent input focus-trap textarea, and ambient dynamic radial background glow scaling in size and opacity with user WPM."),
        ("TextDisplay (components/typing/text-display.tsx)", 
         "Viewport rendering target sentences broken down into tokenized words and individual character spans. Features smooth auto-scrolling to active lines, blinking vertical accent caret, and distinct styling states for untyped, correct, and wrong characters."),
        ("ResultScreen (components/typing/result-screen.tsx)", 
         "Post-test performance dashboard featuring animated metric counters, speed/accuracy timelines powered by Recharts, error key diagnostics, canvas confetti triggers, and shareable challenge lobby creation."),
        ("ReplayPlayer (components/typing/replay-player.tsx)", 
         "Interactive keystroke reproduction tool utilizing requestAnimationFrame to replay exact timing telemetry with progress scrubbing and 1x to 4x playback speed toggles."),
        ("CatCompanion (components/typing/cat-companion.tsx)", 
         "Dynamic virtual cat assistant featuring 12 unique collectible personalities, custom Framer Motion animations (tail wags, ear twitches, aura pulses), and contextual reactive dialogues based on typing metrics."),
        ("LeaderboardPage (app/leaderboard/page.tsx)", 
         "Global ranking leaderboard displaying user rank tiers (Grandmaster to Bronze), timeframe filters (all-time, weekly, daily), and real-time Supabase Postgres change listening.")
    ]

    for title, desc in ui_components:
        story.append(Paragraph(f"• <b>{title}</b>", styles['DocHeading3']))
        story.append(Paragraph(desc, styles['DocBody']))

    story.append(PageBreak())

    # --- SECTION 4 ---
    story.append(Paragraph("4. State Management & Decoupled Web Worker Telemetry", styles['DocHeading1']))
    story.append(Paragraph(
        "State management in TyProX is cleanly split across three specialized Zustand stores and a dedicated background Web Worker script:", styles['DocBody']))

    story.append(Paragraph("Store Architecture", styles['DocHeading2']))
    story.append(Paragraph("1. <b>useTypingStore (stores/typing-store.ts):</b> Manages test configuration (duration, mode, seed), current live status ('idle' | 'running' | 'completed' | 'paused'), real-time stats (WPM, accuracy, combo), and dispatches raw keystrokes to the worker.", styles['DocBullet']))
    story.append(Paragraph("2. <b>useUserStore (stores/user-store.ts):</b> Manages auth sessions, user profile data, local guest result history (up to 100 runs), and preference toggles (theme, mono fonts). Persisted via Zustand local storage middleware.", styles['DocBullet']))
    story.append(Paragraph("3. <b>useToastStore (stores/toast-store.ts):</b> Lightweight notification system for system alerts and unlock popups.", styles['DocBullet']))

    story.append(Paragraph("Web Worker Engine (workers/analytics.worker.ts)", styles['DocHeading2']))
    story.append(Paragraph(
        "During typing, every keypress dispatches an asynchronous message to the worker. The worker maintains an O(1) running position map (`Map<number, boolean>`) of character correctness. On every keystroke, it calculates instantaneous WPM and accuracy, returning a lightweight `TICK` message. Upon test completion, it executes a heavy `FINALIZE` pass:", styles['DocBody']))
    
    worker_box = """
    <b>FINALIZE Execution Pass:</b><br/>
    • <b>Keystroke Filter & Monotonicity Check:</b> Verifies timing array integrity.<br/>
    • <b>Relative Standard Deviation (RSD) Consistency:</b> Computes interval standard deviation across correct keypresses to rate typing consistency (0-100%).<br/>
    • <b>Second-by-Second Timeline Builder:</b> Generates precise point-in-time WPM graphs for rendering in Recharts.<br/>
    • <b>Performance Diagnostics:</b> Aggregates per-key speed averages, error key frequencies, and two-letter bigram transition speeds (e.g., 'th', 'in', 'er').
    """
    w_table = Table([[Paragraph(worker_box, styles['DocBody'])]], colWidths=[504])
    w_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#D4D4D8")),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(w_table)

    # --- SECTION 5 ---
    story.append(Spacer(1, 10))
    story.append(Paragraph("5. Database Architecture & Full PostgreSQL Schema", styles['DocHeading1']))
    story.append(Paragraph(
        "TyProX utilizes Supabase PostgreSQL with strict Row Level Security (RLS), triggers for user profile generation, and custom indexed views for instant leaderboard aggregation.", styles['DocBody']))

    schema_tables = [
        ("public.profiles", "Stores user profile data (id UUID REFERENCES auth.users, username VARCHAR(30) UNIQUE, display_name, avatar_url, theme, font_family). Auto-created on auth sign-up via trigger."),
        ("public.test_results", "Stores main test scores (id UUID, user_id UUID, wpm REAL, raw_wpm REAL, accuracy REAL, consistency REAL, error_count INT, backspace_count INT, mode, duration, seed, is_invalidated)."),
        ("public.replays", "Stores compressed JSONB keystroke telemetry payload linked 1:1 to test_results via test_result_id CASCADE."),
        ("public.streaks", "Tracks daily typing streaks per user (current_streak INT, longest_streak INT, last_active_date DATE)."),
        ("public.daily_challenges", "Contains daily scheduled challenges (challenge_date DATE UNIQUE, mode, duration, seed, text_content)."),
        ("public.challenge_links", "Custom multiplayer challenge lobbies (creator_id, creator_wpm, creator_accuracy, mode, duration, seed, expires_at)."),
        ("public.achievements", "System achievements dictionary (code VARCHAR UNIQUE, name, description, criteria JSONB, icon_path)."),
        ("public.user_achievements", "Pivot table mapping unlocked achievements to users (user_id, achievement_id, unlocked_at).")
    ]

    s_rows = [[Paragraph(f"<b>{t[0]}</b>", styles['TableCell']), Paragraph(t[1], styles['TableCell'])] for t in schema_tables]
    s_table = Table(s_rows, colWidths=[150, 354])
    s_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E4E4E7")),
        ('BACKGROUND', (0,0), (0,-1), bg_light),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(s_table)

    story.append(Spacer(1, 10))
    story.append(Paragraph("Leaderboard SQL View & Auto-Profile Trigger", styles['DocHeading2']))
    
    sql_code = """
-- PostgreSQL View: Highest WPM run per user, mode, and duration
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT DISTINCT ON (user_id, mode, duration)
  id, user_id, wpm, accuracy, consistency, mode, duration, is_invalidated, created_at
FROM public.test_results
WHERE is_invalidated = false
ORDER BY user_id, mode, duration, wpm DESC;

-- Auto-profile & streak generator trigger on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.streaks (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    """
    sql_table = Table([[Paragraph(f"<font color='#00FF66'>{sql_code.strip().replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>')}</font>", styles['CodeSnippet'])]], colWidths=[504])
    sql_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), code_bg),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(sql_table)

    story.append(PageBreak())

    # --- SECTION 6 ---
    story.append(Paragraph("6. API Specifications & Server Security Matrix", styles['DocHeading1']))
    story.append(Paragraph("TyProX enforces strict server-side validation using Next.js API route handlers and Zod schema parsing:", styles['DocBody']))

    story.append(Paragraph("POST /api/results Route Breakdown", styles['DocHeading2']))
    story.append(Paragraph("• <b>Schema Validation:</b> Incoming payload validated against Zod schema (WPM capped at 350, telemetry array capped at 10,000 events).", styles['DocBullet']))
    story.append(Paragraph("• <b>Anti-Cheat Engine:</b> Analyzes millisecond timestamps. Rejects scores if timeline anomalies are detected or if timing standard deviation is below 1.5ms (mechanical autotyper detection).", styles['DocBullet']))
    story.append(Paragraph("• <b>Streak Maintenance:</b> Calculates day difference between current date and `last_active_date`. Increments streak if exactly 1 day apart, resets to 1 if >1 day.", styles['DocBullet']))
    story.append(Paragraph("• <b>Achievement Evaluation:</b> Dynamically queries `achievements` table and unlocks criteria matching speed thresholds or streak milestones.", styles['DocBullet']))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Security & Row Level Security (RLS) Policy Matrix", styles['DocHeading2']))

    rls_data = [
        [Paragraph("Table", styles['TableHeader']), Paragraph("Operation", styles['TableHeader']), Paragraph("RLS Policy Rule", styles['TableHeader'])],
        [Paragraph("profiles", styles['TableCell']), Paragraph("SELECT / UPDATE", styles['TableCell']), Paragraph("Readable by everyone; update restricted to auth.uid() == id", styles['TableCell'])],
        [Paragraph("test_results", styles['TableCell']), Paragraph("INSERT", styles['TableCell']), Paragraph("With check (auth.uid() == user_id OR user_id IS NULL)", styles['TableCell'])],
        [Paragraph("replays", styles['TableCell']), Paragraph("INSERT", styles['TableCell']), Paragraph("Requires existing parent test_result owned by caller", styles['TableCell'])],
        [Paragraph("streaks", styles['TableCell']), Paragraph("UPDATE", styles['TableCell']), Paragraph("Restricted to auth.uid() == user_id", styles['TableCell'])],
        [Paragraph("challenge_links", styles['TableCell']), Paragraph("INSERT", styles['TableCell']), Paragraph("Authenticated users can create challenge link lobbies", styles['TableCell'])]
    ]
    rls_table = Table(rls_data, colWidths=[100, 110, 294])
    rls_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D4D4D8")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(rls_table)

    # --- SECTION 7 ---
    story.append(Spacer(1, 10))
    story.append(Paragraph("7. Anti-Cheat Mechanics & Mathematical Formulas", styles['DocHeading1']))
    story.append(Paragraph("TyProX uses rigorous standardized mathematical formulas to compute typing performance metrics:", styles['DocBody']))

    formulas = [
        ("Net Words Per Minute (WPM)", "WPM = ((Correct Characters) / 5) / (Time in Minutes)"),
        ("Raw Words Per Minute (Raw WPM)", "Raw WPM = ((Total Occupied Positions) / 5) / (Time in Minutes)"),
        ("Accuracy Percentage", "Accuracy = ((Correct Characters) / (Total Occupied Positions)) * 100%"),
        ("Consistency Score (RSD)", "RSD = StdDev(Inter-keystroke Intervals) / Mean(Intervals)\nConsistency = Max(0, Min(100, 100 * (1 - RSD)))"),
        ("Autotyper Anti-Cheat Detection", "Rejects submission if StdDev(Intervals) < 1.5ms (Mechanical Regularity)")
    ]

    for f_title, f_formula in formulas:
        story.append(Paragraph(f"• <b>{f_title}:</b>", styles['DocHeading3']))
        f_box = Table([[Paragraph(f"<code>{f_formula.replace('\n', '<br/>')}</code>", styles['DocBody'])]], colWidths=[504])
        f_box.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), bg_light),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#D4D4D8")),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(f_box)

    # --- SECTION 8 ---
    story.append(Spacer(1, 10))
    story.append(Paragraph("8. Virtual Cat Companion Ecosystem", styles['DocHeading1']))
    story.append(Paragraph(
        "The TyProX Virtual Cat Companion engine (`CatCompanion.tsx`) provides 12 collectible animated cat companions, each with distinct color palettes, accessories, personality traits, and contextual reactive dialogues:", styles['DocBody']))

    cats_data = [
        [Paragraph("Cat ID & Name", styles['TableHeader']), Paragraph("Personality & Color", styles['TableHeader']), Paragraph("Sample Dialogue", styles['TableHeader'])],
        [Paragraph("Silly Cheddar", styles['TableCell']), Paragraph("Playful Orange (#FF9F43)", styles['TableCell']), Paragraph("100%? That deserves a whole virtual tuna slice!", styles['TableCell'])],
        [Paragraph("Void Shadow", styles['TableCell']), Paragraph("Mysterious Dark (#1E1E24)", styles['TableCell']), Paragraph("Flawless. A glitch in the matrix, surely.", styles['TableCell'])],
        [Paragraph("Kind Marshmallow", styles['TableCell']), Paragraph("Sweet White (#F5F6FA)", styles['TableCell']), Paragraph("You did absolutely perfect! I am so proud of you!", styles['TableCell'])],
        [Paragraph("Coach Sergeant", styles['TableCell']), Paragraph("Strict Grey (#7F8C8D)", styles['TableCell']), Paragraph("Clean performance. Now hit the next test immediately!", styles['TableCell'])],
        [Paragraph("Cyber Punk", styles['TableCell']), Paragraph("Neon Cyan/Purple", styles['TableCell']), Paragraph("Overclocked typing speed detected! Clean sync!", styles['TableCell'])],
        [Paragraph("Golden Emperor", styles['TableCell']), Paragraph("Legendary Gold", styles['TableCell']), Paragraph("A performance worthy of the gold crown!", styles['TableCell'])]
    ]
    cats_table = Table(cats_data, colWidths=[110, 130, 264])
    cats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D4D4D8")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(cats_table)

    # --- SECTION 9 ---
    story.append(Spacer(1, 10))
    story.append(Paragraph("9. Deployment, SEO & Performance Verification", styles['DocHeading1']))
    story.append(Paragraph("TyProX is fully optimized for production deployment on Vercel or Node.js runtime environments:", styles['DocBody']))
    
    story.append(Paragraph("• <b>SEO Optimization:</b> Dynamic metadata, semantic HTML5 elements, automated XML sitemap generator (`app/sitemap.ts`), and crawler rules (`app/robots.ts`).", styles['DocBullet']))
    story.append(Paragraph("• <b>Bundle Splitting:</b> Heavy charting libraries (Recharts) are lazy-loaded via Next.js `dynamic()` imports to minimize initial JavaScript bundle size.", styles['DocBullet']))
    story.append(Paragraph("• <b>Production Build Verification:</b> Evaluated via Next.js build compiler without runtime or TypeScript errors.", styles['DocBullet']))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_color, spaceBefore=10, spaceAfter=15))
    story.append(Paragraph("<b>End of Official Specification Document — TyProX Engineering Blueprint</b>", ParagraphStyle(
        name='EndDoc',
        fontName='Helvetica-Bold',
        fontSize=10,
        alignment=1,
        textColor=accent_color
    )))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF: {filename}")

if __name__ == '__main__':
    out_pdf = os.path.join(os.getcwd(), "TyProX_Full_Architecture_and_System_Blueprint.pdf")
    build_pdf(out_pdf)
