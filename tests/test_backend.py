#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automated Integration Tests for Health Battle Python Backend & Leaderboard API
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import http.cookiejar
import unittest
import threading

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import server

class HealthBattleBackendTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use an isolated test database
        cls.test_db = os.path.join(os.path.dirname(__file__), "test_health_battle.db")
        if os.path.exists(cls.test_db):
            try:
                os.remove(cls.test_db)
            except Exception:
                pass
        server.DB_PATH = cls.test_db
        server.init_db()

        # Run test server on a free port chosen by OS
        from waitress import create_server
        server.ADMIN_PASS = "test-admin-password"
        cls.app = server.create_app(initialize=False)
        cls.httpd = create_server(cls.app, host="127.0.0.1", port=0, threads=8, map={}, asyncore_loop_timeout=0.1)
        cls.port = cls.httpd.effective_port
        cls.stop_event = threading.Event()
        def serve():
            while not cls.stop_event.is_set():
                cls.httpd.asyncore.loop(timeout=0.05, count=1, map=cls.httpd._map)
        cls.server_thread = threading.Thread(target=serve, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)

        # Persistent cookie jar for player 1
        cls.cj = http.cookiejar.CookieJar()
        cls.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cls.cj))

    @classmethod
    def tearDownClass(cls):
        cls.stop_event.set()
        cls.server_thread.join(timeout=3)
        cls.httpd.task_dispatcher.shutdown()
        cls.httpd.asyncore.close_all(map=cls.httpd._map)
        time.sleep(0.3)
        server.close_db_pool()
        try:
            if os.path.exists(cls.test_db):
                os.remove(cls.test_db)
        except Exception:
            pass

    def make_request(self, path, method="GET", data=None, opener=None):
        url = f"http://127.0.0.1:{self.port}{path}"
        req_data = json.dumps(data).encode("utf-8") if data is not None else None
        headers = {"Content-Type": "application/json"} if data is not None else {}
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        active_opener = opener or self.opener
        try:
            with active_opener.open(req) as resp:
                body = resp.read().decode("utf-8")
                return resp.status, json.loads(body) if resp.headers.get_content_type() == "application/json" else body, resp.headers
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            try:
                parsed = json.loads(body)
            except Exception:
                parsed = body
            return e.code, parsed, e.headers

    def test_01_static_pages(self):
        # Test index.html and admin.html serving
        status, body, _ = self.make_request("/")
        self.assertEqual(status, 200)
        self.assertIn("نبرد سلامت", body)

        status, body, _ = self.make_request("/admin")
        self.assertEqual(status, 200)
        self.assertIn("پنل مدیریت", body)

    def test_02_register_elementary_player_and_cookie(self):
        # Register an elementary student
        payload = {
            "name": "علی رضایی",
            "category": "elementary",
            "school": "دبستان پیام دانش",
            "grade_class": "ششم ۲"
        }
        status, data, headers = self.make_request("/api/register", method="POST", data=payload)
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertEqual(data["player"]["name"], "علی رضایی")
        self.assertEqual(data["player"]["category"], "elementary")
        self.assertEqual(data["player"]["school"], "دبستان پیام دانش")
        self.assertEqual(data["player"]["grade_class"], "ششم ۲")

        # Verify 30-day cookie was set
        cookies = {c.name: c.value for c in self.cj}
        self.assertIn("player_token", cookies)

        # Check /api/me loads automatically via cookie
        status, me_data, _ = self.make_request("/api/me")
        self.assertEqual(status, 200)
        self.assertTrue(me_data.get("success"))
        self.assertEqual(me_data["player"]["name"], "علی رضایی")

    def test_03_submit_score_and_ranks(self):
        # Submit a score
        score_payload = {"score": 45, "healthy_cuts": 25, "bonus_years": 10}
        status, res, _ = self.make_request("/api/score", method="POST", data=score_payload)
        self.assertEqual(status, 200)
        self.assertTrue(res.get("success"))
        self.assertEqual(res["best_score"], 45)
        self.assertEqual(res["rank_category"], 1)

        # Submit lower score; best score should remain 45
        score_payload2 = {"score": 30, "healthy_cuts": 15, "bonus_years": 5}
        status, res2, _ = self.make_request("/api/score", method="POST", data=score_payload2)
        self.assertEqual(res2["best_score"], 45)
        self.assertFalse(res2["is_new_record"])

    def test_04_leaderboard_category_filtering(self):
        # Register a second student in Middle school
        client2 = http.cookiejar.CookieJar()
        opener2 = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(client2))

        reg_data = json.dumps({
            "name": "سارا محمدی",
            "category": "middle",
            "school": "دبیرستان نمونه بهشتی"
        }).encode("utf-8")
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/register", data=reg_data, headers={"Content-Type": "application/json"}, method="POST")
        with opener2.open(req) as resp:
            pass

        # Submit score 50 for Sara
        score_data = json.dumps({"score": 50, "healthy_cuts": 30, "bonus_years": 10}).encode("utf-8")
        req2 = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/score", data=score_data, headers={"Content-Type": "application/json"}, method="POST")
        with opener2.open(req2) as resp:
            pass

        # Query elementary leaderboard -> Ali should be #1 with 45
        status, elem_board, _ = self.make_request("/api/leaderboard?category=elementary")
        self.assertEqual(status, 200)
        self.assertEqual(len(elem_board["top_players"]), 1)
        self.assertEqual(elem_board["top_players"][0]["name"], "علی رضایی")

        # Query middle leaderboard -> Sara should be #1 with 50
        status, denied, _ = self.make_request("/api/leaderboard?category=middle")
        self.assertEqual(status, 403)
        self.assertNotIn('top_players', denied)
        status, mid_board, _ = self.make_request("/api/leaderboard?category=middle", opener=opener2)
        self.assertEqual(status, 200)
        self.assertEqual(len(mid_board["top_players"]), 1)
        self.assertEqual(mid_board["top_players"][0]["name"], "سارا محمدی")

        # Overall rankings are unavailable to players.
        status, all_board, _ = self.make_request("/api/leaderboard?category=all")
        self.assertEqual(status, 403)
        self.assertNotIn('top_players', all_board)

    def test_05_admin_panel_api(self):
        # Unauthorized check
        status, _, _ = self.make_request("/api/admin/stats")
        self.assertEqual(status, 401)

        # Login with correct credentials
        status, login_res, _ = self.make_request("/api/admin/login", method="POST", data={"username": "admin", "password": "test-admin-password"})
        self.assertEqual(status, 200)
        self.assertTrue(login_res["success"])

        # Fetch stats
        status, stats, _ = self.make_request("/api/admin/stats")
        self.assertEqual(status, 200)
        self.assertEqual(stats["registered_players"], 2)
        self.assertEqual(stats["max_score"], 50)

        # Fetch players
        status, players_data, _ = self.make_request("/api/admin/players")
        self.assertEqual(status, 200)
        self.assertEqual(len(players_data["players"]), 2)

        # Export CSV
        status, csv_data, headers = self.make_request("/api/admin/export")
        self.assertEqual(status, 200)
        self.assertIn("علی رضایی", csv_data)
        self.assertIn("سارا محمدی", csv_data)

if __name__ == "__main__":
    unittest.main()
