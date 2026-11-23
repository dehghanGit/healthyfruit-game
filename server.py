#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Health Battle (نبرد سلامت) - Python Backend Server & API
Provides:
- Static file serving (HTML, CSS, JS, Assets)
- SQLite database persistence
- Cookie-based authentication & profile management (30-day cookie)
- Leaderboard API (Top 10 overall & per educational stage, user rank)
- Score submission API
- Admin Dashboard API (Analytics, Player Management, Excel/CSV Export)
"""

import os
import json
import sqlite3
import secrets
import hmac
import time
import threading
import queue
import atexit
import socket
import csv
import io
from contextlib import contextmanager
from collections import OrderedDict
from flask import Flask, request, Response, send_from_directory
from werkzeug.exceptions import HTTPException, BadRequest
from datetime import datetime
from urllib.parse import parse_qs, urlparse
import http.cookies

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "health_battle.db"))
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(24)
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"
MAX_BODY = 16 * 1024
ADMIN_SESSION_AGE = 24 * 3600

# Cookie duration: 30 days
COOKIE_MAX_AGE = 30 * 24 * 3600

# Category labels in Persian
CATEGORY_MAP = {
    "elementary": "ابتدایی",
    "middle": "متوسطه اول",
    "high": "متوسطه دوم",
    "other": "سایر",
    "anonymous": "ناشناس"
}

class ConnectionPool:
    """Small fixed pool: a connection is exclusively borrowed by one request."""
    def __init__(self, path, size=8):
        self.path = path
        self.idle = queue.LifoQueue(maxsize=size)
        self.lock = threading.Lock()
        self.closed = False
        self.active = 0
        for _ in range(size):
            self.idle.put(None)  # Connections are opened lazily.

    def acquire(self):
        slot = self.idle.get(timeout=5)
        try:
            with self.lock:
                if self.closed:
                    raise sqlite3.OperationalError("Connection pool closed")
                if slot is None:
                    slot = sqlite3.connect(self.path, timeout=5, check_same_thread=False)
                    slot.row_factory = sqlite3.Row
                    slot.execute("PRAGMA foreign_keys = ON")
                    slot.execute("PRAGMA busy_timeout = 5000")
                    slot.execute("PRAGMA cache_size = -1024")
                    slot.execute("PRAGMA synchronous = NORMAL")
                self.active += 1
            return slot
        except Exception:
            if slot is not None:
                slot.close()
            self.idle.put(None)
            raise

    def release(self, conn):
        with self.lock:
            self.active -= 1
            if self.closed:
                conn.close()
            else:
                self.idle.put_nowait(conn)

    def close(self):
        with self.lock:
            self.closed = True
            while True:
                try:
                    conn = self.idle.get_nowait()
                except queue.Empty:
                    break
                if conn is not None:
                    conn.close()


_db_pool = None
_db_pool_lock = threading.Lock()


def close_db_pool():
    global _db_pool
    with _db_pool_lock:
        if _db_pool is not None:
            _db_pool.close()
            _db_pool = None


atexit.register(close_db_pool)


@contextmanager
def get_db():
    global _db_pool
    with _db_pool_lock:
        if _db_pool is None or _db_pool.path != DB_PATH:
            if _db_pool is not None:
                _db_pool.close()
            _db_pool = ConnectionPool(DB_PATH)
        pool = _db_pool
    try:
        conn = pool.acquire()
    except queue.Empty:
        raise sqlite3.OperationalError("Database connection pool busy") from None
    try:
        with conn:
            yield conn
    finally:
        pool.release(conn)


def init_db():
    with get_db() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                school TEXT DEFAULT '',
                grade_class TEXT DEFAULT '',
                best_score INTEGER DEFAULT 0,
                games_count INTEGER DEFAULT 0,
                is_anonymous INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                healthy_cuts INTEGER DEFAULT 0,
                bonus_years INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_sessions (
                token TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_players_token ON players(token);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_players_category_score ON players(category, best_score DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_players_best_score ON players(best_score DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_records_player ON game_records(player_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_official_overall ON players(best_score DESC, last_active ASC, id ASC) WHERE is_anonymous = 0 AND best_score > 0")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_official_category ON players(category, best_score DESC, last_active ASC, id ASC) WHERE is_anonymous = 0 AND best_score > 0")
        conn.commit()

def cookie_value(name, token, max_age=COOKIE_MAX_AGE):
    secure = "; Secure" if COOKIE_SECURE else ""
    return f"{name}={token}; Max-Age={max_age}; Path=/; SameSite=Lax; HttpOnly{secure}"


class APIController:
    def __init__(self):
        self.headers = request.headers
        self.path = request.full_path

    def parse_cookies(self):
        cookie_header = self.headers.get("Cookie", "")
        cookie = http.cookies.SimpleCookie()
        if cookie_header:
            try:
                cookie.load(cookie_header)
            except Exception:
                pass
        return {k: v.value for k, v in cookie.items()}

    def get_player_by_token(self, token):
        if not token:
            return None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM players WHERE token = ?", (token,))
            row = cursor.fetchone()
            if row:
                return dict(row)
        return None

    def calculate_ranks(self, player_id, category, best_score, last_active):
        """Calculate user's rank in their category and overall among non-anonymous players."""
        if not player_id or best_score <= 0 or category == "anonymous":
            return {"rank_category": None, "rank_overall": None, "total_category": 0, "total_overall": 0}

        with get_db() as conn:
            cursor = conn.cursor()
            # Category rank (ties broken by earlier last_active)
            cursor.execute("""
                SELECT COUNT(*) + 1 FROM players
                WHERE category = ? AND is_anonymous = 0 AND best_score > 0
                AND (best_score > ? OR (best_score = ? AND last_active < ?) OR (best_score = ? AND last_active = ? AND id < ?))
            """, (category, best_score, best_score, last_active, best_score, last_active, player_id))
            rank_cat = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM players WHERE category = ? AND is_anonymous = 0 AND best_score > 0", (category,))
            total_cat = cursor.fetchone()[0]

            # Overall rank
            cursor.execute("""
                SELECT COUNT(*) + 1 FROM players
                WHERE is_anonymous = 0 AND best_score > 0
                AND (best_score > ? OR (best_score = ? AND last_active < ?) OR (best_score = ? AND last_active = ? AND id < ?))
            """, (best_score, best_score, last_active, best_score, last_active, player_id))
            rank_ovr = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM players WHERE is_anonymous = 0 AND best_score > 0")
            total_ovr = cursor.fetchone()[0]

            return {
                "rank_category": rank_cat,
                "rank_overall": rank_ovr,
                "total_category": total_cat,
                "total_overall": total_ovr
            }

    def is_admin_authenticated(self):
        cookies = self.parse_cookies()
        session_token = cookies.get("admin_session")
        if not session_token:
            return False
        nonce, separator, signature = session_token.partition('.')
        expected = hmac.new(ADMIN_PASS.encode(), nonce.encode(), 'sha256').hexdigest()
        if not separator or not secrets.compare_digest(signature, expected):
            return False
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT token FROM admin_sessions WHERE token = ? AND created_at > datetime('now', '-1 day')", (session_token,))
            return cursor.fetchone() is not None

    def send_json(self, data, status=200, set_cookie=None):
        response = Response(json.dumps(data, ensure_ascii=False), status=status,
                            content_type="application/json; charset=utf-8")
        if set_cookie:
            for value in (set_cookie if isinstance(set_cookie, list) else [set_cookie]):
                response.headers.add("Set-Cookie", value)
        return response

    def read_json_body(self):
        if not request.is_json:
            raise BadRequest("Content-Type must be application/json")
        body = request.get_json()
        if not isinstance(body, dict):
            raise BadRequest("JSON body must be an object")
        return body

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # Redirect root aliases or /admin to admin.html
        if path == "/admin" or path == "/admin/":
            return serve_public("admin.html")

        # API Handlers
        if path == "/api/me":
            return self.handle_get_me()

        if path == "/api/leaderboard":
            return self.handle_get_leaderboard(query)

        if path == "/api/admin/check":
            return self.send_json({"authenticated": self.is_admin_authenticated()})

        if path == "/api/admin/stats":
            return self.handle_admin_stats()

        if path == "/api/admin/players":
            return self.handle_admin_players(query)

        if path == "/api/admin/export":
            return self.handle_admin_export(query)

        return serve_public(path.lstrip("/") or "index.html")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/register":
            return self.handle_register()

        if path == "/api/score":
            return self.handle_submit_score()

        if path == "/api/admin/login":
            return self.handle_admin_login()

        if path == "/api/admin/logout":
            return self.handle_admin_logout()

        if path == "/api/admin/players/delete":
            return self.handle_admin_delete_player()

        if path == "/api/admin/players/reset-score":
            return self.handle_admin_reset_score()

        if path == "/api/admin/players/update":
            return self.handle_admin_update_player()

        if path == "/api/admin/reset-all":
            return self.handle_admin_reset_all()

        return self.send_json({"error": "Endpoint not found"}, 404)

    # ---------------- API Implementations ---------------- #

    def handle_get_me(self):
        cookies = self.parse_cookies()
        token = cookies.get("player_token")
        player = self.get_player_by_token(token)

        if not player:
            return self.send_json({"success": False, "player": None})

        ranks = self.calculate_ranks(
            player["id"], player["category"], player["best_score"], player["last_active"]
        )

        player_data = {
            "id": player["id"],
            "name": player["name"],
            "category": player["category"],
            "category_fa": CATEGORY_MAP.get(player["category"], player["category"]),
            "school": player["school"],
            "grade_class": player["grade_class"],
            "best_score": player["best_score"],
            "games_count": player["games_count"],
            "is_anonymous": bool(player["is_anonymous"]),
            "created_at": player["created_at"],
            "last_active": player["last_active"],
            **ranks
        }
        return self.send_json({"success": True, "player": player_data})

    def handle_register(self):
        body = self.read_json_body()
        name = text_field(body, "name", "", 120)
        category = text_field(body, "category", "elementary", 24)
        school = text_field(body, "school", "", 160)
        grade_class = text_field(body, "grade_class", "", 60)
        if not isinstance(body.get("is_anonymous", False), bool):
            raise BadRequest("is_anonymous must be a boolean")
        is_anonymous = int(body.get("is_anonymous", False))

        # Validate category
        valid_cats = ["elementary", "middle", "high", "other", "anonymous"]
        if category not in valid_cats or (category == "anonymous" and not is_anonymous):
            raise BadRequest("Invalid category")

        if is_anonymous:
            if not name:
                name = "بازیکن ناشناس"
            category = "anonymous"
            school = ""
            grade_class = ""
        else:
            if not name:
                return self.send_json({"success": False, "error": "لطفاً نام و نام خانوادگی را وارد کنید."}, 400)
            if category in ["elementary", "middle", "high"] and not school:
                return self.send_json({"success": False, "error": "لطفاً نام مدرسه را وارد کنید."}, 400)
            if category == "elementary" and not grade_class:
                return self.send_json({"success": False, "error": "لطفاً کلاس / پایه تحصیلی را وارد کنید."}, 400)
            if category != "elementary":
                grade_class = ""
            if category == "other":
                school = ""

        cookies = self.parse_cookies()
        token = cookies.get("player_token")

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with get_db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            cursor = conn.cursor()
            existing_player = conn.execute("SELECT * FROM players WHERE token = ?", (token,)).fetchone()
            if existing_player:
                # Update existing profile
                cursor.execute("""
                    UPDATE players
                    SET name = ?, category = ?, school = ?, grade_class = ?, is_anonymous = ?, last_active = ?
                    WHERE token = ?
                """, (name, category, school, grade_class, is_anonymous, now, token))
                player_id = existing_player["id"]
                best_score = existing_player["best_score"]
                games_count = existing_player["games_count"]
            else:
                # Create brand new token & profile
                token = secrets.token_hex(16)
                cursor.execute("""
                    INSERT INTO players (token, name, category, school, grade_class, best_score, games_count, is_anonymous, created_at, last_active)
                    VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
                """, (token, name, category, school, grade_class, is_anonymous, now, now))
                player_id = cursor.lastrowid
                best_score = 0
                games_count = 0
            conn.commit()

        cookie_str = cookie_value("player_token", token)

        ranks = self.calculate_ranks(player_id, category, best_score, now)

        player_data = {
            "id": player_id,
            "name": name,
            "category": category,
            "category_fa": CATEGORY_MAP.get(category, category),
            "school": school,
            "grade_class": grade_class,
            "best_score": best_score,
            "games_count": games_count,
            "is_anonymous": bool(is_anonymous),
            "created_at": existing_player["created_at"] if existing_player else now,
            "last_active": now,
            **ranks
        }

        return self.send_json({"success": True, "player": player_data}, set_cookie=cookie_str)

    def handle_submit_score(self):
        body = self.read_json_body()
        score = integer_field(body, "score", maximum=1_000_000)
        healthy_cuts = integer_field(body, "healthy_cuts", maximum=1_000_000)
        bonus_years = integer_field(body, "bonus_years", maximum=1_000_000)
        if score > 10 + healthy_cuts + bonus_years:
            raise BadRequest("Score exceeds the supplied game totals")

        cookies = self.parse_cookies()
        token = cookies.get("player_token")

        new_cookie = None
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with get_db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            cursor = conn.cursor()
            player = conn.execute("SELECT * FROM players WHERE token = ?", (token,)).fetchone()
            if not player:
                # Create default anonymous player
                token = secrets.token_hex(16)
                cursor.execute("""
                    INSERT INTO players (token, name, category, school, grade_class, best_score, games_count, is_anonymous, created_at, last_active)
                    VALUES (?, 'بازیکن ناشناس', 'anonymous', '', '', ?, 1, 1, ?, ?)
                """, (token, score, now, now))
                player_id = cursor.lastrowid
                old_best = 0
                new_best = score
                is_new_record = score > 0
                new_cookie = cookie_value("player_token", token)
                category = "anonymous"
            else:
                player_id = player["id"]
                old_best = player["best_score"]
                new_best = max(old_best, score)
                is_new_record = score > old_best
                category = player["category"]

                cursor.execute("""
                    UPDATE players
                    SET best_score = ?, games_count = games_count + 1, last_active = ?
                    WHERE id = ?
                """, (new_best, now, player_id))

            # Record game round
            cursor.execute("""
                INSERT INTO game_records (player_id, score, healthy_cuts, bonus_years, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (player_id, score, healthy_cuts, bonus_years, now))
            conn.commit()

        ranks = self.calculate_ranks(player_id, category, new_best, now)

        return self.send_json({
            "success": True,
            "score": score,
            "best_score": new_best,
            "is_new_record": is_new_record,
            **ranks
        }, set_cookie=new_cookie)

    def handle_get_leaderboard(self, query):
        category = query.get("category", ["all"])[0]
        limit = 10

        cookies = self.parse_cookies()
        token = cookies.get("player_token")
        current_player = self.get_player_by_token(token)

        with get_db() as conn:
            cursor = conn.cursor()

            # Query for top 10 (exclude 0-score players and anonymous from official ranks)
            if category in ["elementary", "middle", "high", "other"]:
                cursor.execute("""
                    SELECT id, name, category, school, grade_class, best_score, last_active
                    FROM players
                    WHERE category = ? AND is_anonymous = 0 AND best_score > 0
                    ORDER BY best_score DESC, last_active ASC, id ASC
                    LIMIT ?
                """, (category, limit))
            else:
                cursor.execute("""
                    SELECT id, name, category, school, grade_class, best_score, last_active
                    FROM players
                    WHERE is_anonymous = 0 AND best_score > 0
                    ORDER BY best_score DESC, last_active ASC, id ASC
                    LIMIT ?
                """, (limit,))

            rows = cursor.fetchall()

            top_players = []
            for rank_idx, row in enumerate(rows, start=1):
                top_players.append({
                    "rank": rank_idx,
                    "id": row["id"],
                    "name": row["name"],
                    "category": row["category"],
                    "category_fa": CATEGORY_MAP.get(row["category"], row["category"]),
                    "school": row["school"],
                    "grade_class": row["grade_class"],
                    "best_score": row["best_score"],
                    "last_active": row["last_active"],
                    "is_current_user": bool(current_player and current_player["id"] == row["id"])
                })

            # Calculate user's rank
            user_rank_info = None
            if current_player:
                is_anon = bool(current_player["is_anonymous"])
                if is_anon:
                    user_rank_info = {
                        "id": current_player["id"],
                        "name": current_player["name"],
                        "is_anonymous": True,
                        "best_score": current_player["best_score"],
                        "rank": None,
                        "message": "برای محاسبه رتبه در جدول، نام و مقطع خود را انتخاب کنید."
                    }
                else:
                    user_cat = current_player["category"]
                    # If looking at specific category
                    target_cat = category if category in ["elementary", "middle", "high", "other"] else None

                    if target_cat:
                        if target_cat == user_cat:
                            cursor.execute("""
                                SELECT COUNT(*) + 1 FROM players
                                WHERE category = ? AND is_anonymous = 0 AND best_score > 0
                                AND (best_score > ? OR (best_score = ? AND last_active < ?) OR (best_score = ? AND last_active = ? AND id < ?))
                            """, (user_cat, current_player["best_score"], current_player["best_score"], current_player["last_active"], current_player["best_score"], current_player["last_active"], current_player["id"]))
                            rank = cursor.fetchone()[0]
                            cursor.execute("SELECT COUNT(*) FROM players WHERE category = ? AND is_anonymous = 0 AND best_score > 0", (user_cat,))
                            total = cursor.fetchone()[0]
                        else:
                            rank = None
                            total = 0
                    else:
                        cursor.execute("""
                            SELECT COUNT(*) + 1 FROM players
                            WHERE is_anonymous = 0 AND best_score > 0
                            AND (best_score > ? OR (best_score = ? AND last_active < ?) OR (best_score = ? AND last_active = ? AND id < ?))
                        """, (current_player["best_score"], current_player["best_score"], current_player["last_active"], current_player["best_score"], current_player["last_active"], current_player["id"]))
                        rank = cursor.fetchone()[0]
                        cursor.execute("SELECT COUNT(*) FROM players WHERE is_anonymous = 0 AND best_score > 0")
                        total = cursor.fetchone()[0]

                    in_top_10 = any(p["id"] == current_player["id"] for p in top_players)

                    user_rank_info = {
                        "id": current_player["id"],
                        "name": current_player["name"],
                        "category": user_cat,
                        "category_fa": CATEGORY_MAP.get(user_cat, user_cat),
                        "school": current_player["school"],
                        "grade_class": current_player["grade_class"],
                        "best_score": current_player["best_score"],
                        "rank": rank if current_player["best_score"] > 0 else None,
                        "total_in_pool": total,
                        "in_top_10": in_top_10,
                        "is_anonymous": False
                    }

            # Total players in this view
            if category in ["elementary", "middle", "high", "other"]:
                cursor.execute("SELECT COUNT(*) FROM players WHERE category = ? AND is_anonymous = 0 AND best_score > 0", (category,))
            else:
                cursor.execute("SELECT COUNT(*) FROM players WHERE is_anonymous = 0 AND best_score > 0")
            total_players = cursor.fetchone()[0]

        return self.send_json({
            "success": True,
            "category": category,
            "category_fa": CATEGORY_MAP.get(category, "همه رده‌ها"),
            "top_players": top_players,
            "user_rank": user_rank_info,
            "total_players": total_players
        })

    # ---------------- Admin APIs ---------------- #

    def handle_admin_login(self):
        body = self.read_json_body()
        user = text_field(body, "username", "", 120)
        pwd = text_field(body, "password", "", 256, strip=False)

        if secrets.compare_digest(user.encode(), ADMIN_USER.encode()) and secrets.compare_digest(pwd.encode(), ADMIN_PASS.encode()):
            nonce = secrets.token_hex(24)
            signature = hmac.new(ADMIN_PASS.encode(), nonce.encode(), 'sha256').hexdigest()
            session_token = f'{nonce}.{signature}'
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM admin_sessions WHERE created_at <= datetime('now', '-1 day')")
                cursor.execute("INSERT INTO admin_sessions (token) VALUES (?)", (session_token,))
                conn.commit()
            cookie_str = cookie_value("admin_session", session_token, ADMIN_SESSION_AGE)
            return self.send_json({"success": True, "message": "ورود با موفقیت انجام شد."}, set_cookie=cookie_str)

        return self.send_json({"success": False, "error": "نام کاربری یا رمز عبور اشتباه است."}, 401)

    def handle_admin_logout(self):
        cookies = self.parse_cookies()
        session_token = cookies.get("admin_session")
        if session_token:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM admin_sessions WHERE token = ?", (session_token,))
                conn.commit()
        cookie_str = cookie_value("admin_session", "", 0)
        return self.send_json({"success": True}, set_cookie=cookie_str)

    def handle_admin_stats(self):
        if not self.is_admin_authenticated():
            return self.send_json({"error": "Unauthorized"}, 401)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM players")
            total_players = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM players WHERE is_anonymous = 0")
            registered_players = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM players WHERE is_anonymous = 1")
            anon_players = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM game_records")
            total_games = cursor.fetchone()[0]

            cursor.execute("SELECT COALESCE(MAX(best_score), 0) FROM players")
            max_score = cursor.fetchone()[0]

            cursor.execute("SELECT COALESCE(AVG(score), 0) FROM game_records")
            avg_score = round(cursor.fetchone()[0], 1)

            # Stage counts
            category_counts = {}
            for cat_key in ["elementary", "middle", "high", "other", "anonymous"]:
                cursor.execute("SELECT COUNT(*) FROM players WHERE category = ?", (cat_key,))
                category_counts[cat_key] = cursor.fetchone()[0]

            # Top 5 schools by player count
            cursor.execute("""
                SELECT school, COUNT(*) as cnt, MAX(best_score) as top_score
                FROM players
                WHERE school != '' AND is_anonymous = 0
                GROUP BY school
                ORDER BY cnt DESC
                LIMIT 5
            """)
            top_schools = [{"school": r["school"], "count": r["cnt"], "top_score": r["top_score"]} for r in cursor.fetchall()]

        return self.send_json({
            "success": True,
            "total_players": total_players,
            "registered_players": registered_players,
            "anonymous_players": anon_players,
            "total_games": total_games,
            "max_score": max_score,
            "avg_score": avg_score,
            "category_counts": category_counts,
            "top_schools": top_schools
        })

    def handle_admin_players(self, query):
        if not self.is_admin_authenticated():
            return self.send_json({"error": "Unauthorized"}, 401)

        cat = query.get("category", ["all"])[0]
        search = query.get("search", [""])[0].strip()
        sort_by = query.get("sort_by", ["best_score"])[0]
        order = query.get("order", ["desc"])[0].upper()
        if order not in ["ASC", "DESC"]:
            order = "DESC"

        allowed_sort = {
            "best_score": "best_score",
            "games_count": "games_count",
            "created_at": "created_at",
            "last_active": "last_active",
            "name": "name"
        }
        sort_col = allowed_sort.get(sort_by, "best_score")

        sql = "SELECT * FROM players WHERE 1=1"
        params = []

        if cat != "all":
            sql += " AND category = ?"
            params.append(cat)

        if search:
            sql += " AND (name LIKE ? OR school LIKE ? OR grade_class LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term])

        try:
            page = int(query.get("page", ["1"])[0])
            if not 1 <= page <= 1_000_000:
                raise ValueError
        except (ValueError, TypeError):
            raise BadRequest("Invalid page")
        page_size = 100
        count_sql = "SELECT COUNT(*) FROM (" + sql + ")"
        sql += f" ORDER BY {sort_col} {order}, id DESC LIMIT ? OFFSET ?"

        with get_db() as conn:
            cursor = conn.cursor()
            total = cursor.execute(count_sql, params).fetchone()[0]
            cursor.execute(sql, params + [page_size, (page - 1) * page_size])
            rows = cursor.fetchall()

            players = []
            for r in rows:
                players.append({
                    "id": r["id"],
                    "name": r["name"],
                    "category": r["category"],
                    "category_fa": CATEGORY_MAP.get(r["category"], r["category"]),
                    "school": r["school"],
                    "grade_class": r["grade_class"],
                    "best_score": r["best_score"],
                    "games_count": r["games_count"],
                    "is_anonymous": bool(r["is_anonymous"]),
                    "created_at": r["created_at"],
                    "last_active": r["last_active"]
                })

        return self.send_json({"success": True, "players": players, "page": page, "page_size": page_size, "total": total})

    def handle_admin_delete_player(self):
        if not self.is_admin_authenticated():
            return self.send_json({"error": "Unauthorized"}, 401)
        body = self.read_json_body()
        player_id = integer_field(body, "player_id", minimum=1)
        if not player_id:
            return self.send_json({"error": "Missing player_id"}, 400)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM players WHERE id = ?", (player_id,))
            cursor.execute("DELETE FROM game_records WHERE player_id = ?", (player_id,))
            conn.commit()

        return self.send_json({"success": True})

    def handle_admin_reset_score(self):
        if not self.is_admin_authenticated():
            return self.send_json({"error": "Unauthorized"}, 401)
        body = self.read_json_body()
        player_id = integer_field(body, "player_id", minimum=1)
        if not player_id:
            return self.send_json({"error": "Missing player_id"}, 400)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE players SET best_score = 0, games_count = 0 WHERE id = ?", (player_id,))
            cursor.execute("DELETE FROM game_records WHERE player_id = ?", (player_id,))
            conn.commit()

        return self.send_json({"success": True})

    def handle_admin_update_player(self):
        if not self.is_admin_authenticated():
            return self.send_json({"error": "Unauthorized"}, 401)
        body = self.read_json_body()
        player_id = integer_field(body, "player_id", minimum=1)
        name = text_field(body, "name", "", 120)
        category = text_field(body, "category", "other", 24)
        school = text_field(body, "school", "", 160)
        grade_class = text_field(body, "grade_class", "", 60)
        best_score = integer_field(body, "best_score", maximum=1_000_000)

        if category not in CATEGORY_MAP:
            raise BadRequest("Invalid category")
        if not player_id or not name:
            return self.send_json({"error": "Invalid player data"}, 400)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE players
                SET name = ?, category = ?, school = ?, grade_class = ?, best_score = ?, is_anonymous = ?
                WHERE id = ?
            """, (name, category, school, grade_class, best_score, int(category == "anonymous"), player_id))
            conn.commit()

        return self.send_json({"success": True})

    def handle_admin_reset_all(self):
        if not self.is_admin_authenticated():
            return self.send_json({"error": "Unauthorized"}, 401)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM game_records")
            cursor.execute("DELETE FROM players")
            conn.commit()

        return self.send_json({"success": True, "message": "تمام داده‌ها با موفقیت پاک شدند."})

    def handle_admin_export(self, query):
        if not self.is_admin_authenticated():
            return self.send_json({"error": "Unauthorized"}, 401)

        # A keyset page closes the DB before yielding to slow clients; no long WAL snapshot.
        def chunks():
            yield "\ufeff".encode("utf-8")
            buffer = io.StringIO()
            writer = csv.writer(buffer)
            writer.writerow(["شناسه", "نام و نام خانوادگی", "دوره تحصیلی", "مدرسه", "کلاس / پایه", "بیشترین سال عمر (رکورد)", "تعداد بازی", "ناشناس", "تاریخ ثبت", "آخرین فعالیت"])
            yield buffer.getvalue().encode("utf-8")
            last_id = 0
            while True:
                with get_db() as conn:
                    rows = conn.execute("SELECT id, name, category, school, grade_class, best_score, games_count, is_anonymous, created_at, last_active FROM players WHERE id > ? ORDER BY id LIMIT 250", (last_id,)).fetchall()
                if not rows:
                    break
                buffer.seek(0)
                buffer.truncate()
                for row in rows:
                    values = [row["id"], row["name"], CATEGORY_MAP.get(row["category"], row["category"]), row["school"], row["grade_class"], row["best_score"], row["games_count"], "بله" if row["is_anonymous"] else "خیر", row["created_at"], row["last_active"]]
                    writer.writerow([csv_safe(value) for value in values])
                last_id = rows[-1]["id"]
                yield buffer.getvalue().encode("utf-8")

        filename = f"health_battle_players_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
        return Response(chunks(), content_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def text_field(body, key, default="", maximum=120, strip=True):
    value = body.get(key, default)
    if value is None:
        value = default
    if not isinstance(value, str) or len(value) > maximum:
        raise BadRequest(f"Invalid {key}")
    return value.strip() if strip else value


def integer_field(body, key, minimum=0, maximum=2_147_483_647):
    value = body.get(key, 0)
    if type(value) is not int or not minimum <= value <= maximum:
        raise BadRequest(f"Invalid {key}")
    return value


def csv_safe(value):
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r", "\n")):
        return "'" + value
    return value


def serve_public(path):
    # Never expose DB, source code, configuration, source assets or directory listings.
    from pathlib import Path
    root = Path(BASE_DIR).resolve()
    target = (root / path).resolve()
    allowed = path in {"index.html", "admin.html"} or (
        path.startswith(("css/", "js/", "assets/images/"))
        and target.suffix.lower() in {".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".woff", ".woff2"})
    if not allowed or not target.is_relative_to(root) or not target.is_file():
        return Response("Not found", status=404)
    return send_from_directory(root, path, max_age=3600 if path not in {"index.html", "admin.html"} else 0)


class RateLimiter:
    """Bounded, process-local token buckets; no per-IP background threads."""
    def __init__(self, capacity=4096):
        self.buckets = OrderedDict()
        self.capacity = capacity
        self.lock = threading.Lock()

    def allow(self, key, limit, period):
        now = time.monotonic()
        with self.lock:
            tokens, previous = self.buckets.pop(key, (float(limit), now))
            tokens = min(limit, tokens + (now - previous) * limit / period)
            allowed = tokens >= 1
            self.buckets[key] = (tokens - 1 if allowed else tokens, now)
            while len(self.buckets) > self.capacity:
                self.buckets.popitem(last=False)
            return allowed


def create_app(initialize=True):
    if initialize:
        init_db()
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=MAX_BODY, MAX_FORM_MEMORY_SIZE=MAX_BODY)
    if os.environ.get("TRUST_PROXY") == "1":
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=0, x_port=0, x_prefix=0)
    limiter = RateLimiter()
    app.extensions["rate_limiter"] = limiter

    @app.before_request
    def protect_request():
        if request.method == "POST":
            # Browser cross-site POSTs must not mutate cookie-authenticated data.
            origin = request.headers.get("Origin")
            if request.headers.get("Sec-Fetch-Site") == "cross-site" or (origin and origin.rstrip("/") != request.host_url.rstrip("/")):
                return APIController().send_json({"error": "Cross-origin request denied"}, 403)
            if request.path == "/api/admin/login":
                key, limit, period = ("login", request.remote_addr), 10, 60
            else:
                token = request.cookies.get("player_token")
                # Large allowance for shared school NAT; per-player scores have their own bucket.
                key, limit, period = ("write", request.remote_addr), 3000, 60
                if request.path == "/api/score" and token:
                    if not limiter.allow(("score", token), 20, 60):
                        return limited()
            if not limiter.allow(key, limit, period):
                return limited()

    def limited():
        response = APIController().send_json({"error": "Too many requests"}, 429)
        response.headers["Retry-After"] = "3"
        return response

    @app.after_request
    def response_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "same-origin"
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(HTTPException)
    def bad_request(error):
        return APIController().send_json({"success": False, "error": error.description}, error.code)

    @app.errorhandler(sqlite3.OperationalError)
    def database_error(error):
        app.logger.exception("Database operation failed")
        response = APIController().send_json({"success": False, "error": "Database temporarily unavailable"}, 503)
        response.headers["Retry-After"] = "1"
        return response

    @app.errorhandler(Exception)
    def unexpected_error(error):
        app.logger.exception("Unhandled request failure")
        return APIController().send_json({"success": False, "error": "Internal server error"}, 500)

    @app.route("/", defaults={"path": ""}, methods=["GET", "POST"])
    @app.route("/<path:path>", methods=["GET", "POST"])
    def dispatch(path):
        controller = APIController()
        return controller.do_POST() if request.method == "POST" else controller.do_GET()

    return app


def run_server():
    from waitress import serve
    production = os.environ.get("APP_ENV") == "production"
    if production and not os.environ.get("ADMIN_PASSWORD"):
        raise RuntimeError("Set ADMIN_PASSWORD before starting a production server")
    host = os.environ.get("HOST", "127.0.0.1" if production else "0.0.0.0")
    app = create_app()
    print(f"Health Battle: http://localhost:{PORT}")
    if not os.environ.get("ADMIN_PASSWORD"):
        print(f"Temporary local admin password: {ADMIN_PASS}")
    serve(app, host=host, port=PORT, threads=int(os.environ.get("WEB_THREADS", "8")),
          connection_limit=256, backlog=socket.SOMAXCONN if os.name == "nt" else 2048, channel_timeout=30, cleanup_interval=5,
          max_request_body_size=MAX_BODY, max_request_header_size=8192,
          outbuf_overflow=256 * 1024, outbuf_high_watermark=512 * 1024,
          asyncore_use_poll=hasattr(__import__("select"), "poll"),
          log_socket_errors=False, expose_tracebacks=False)


if __name__ == "__main__":
    run_server()
