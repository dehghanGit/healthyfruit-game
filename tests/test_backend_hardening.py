import concurrent.futures
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class BackendHardeningTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.original_db = server.DB_PATH
        self.original_password = server.ADMIN_PASS
        server.DB_PATH = str(Path(self.directory.name) / 'test.db')
        server.ADMIN_PASS = 'integration-test-password'
        self.app = server.create_app()
        self.client = self.app.test_client()

    def tearDown(self):
        server.close_db_pool()
        server.DB_PATH = self.original_db
        server.ADMIN_PASS = self.original_password
        self.directory.cleanup()

    def register(self, client=None, name='Test player'):
        return (client or self.client).post('/api/register', json={
            'name': name, 'category': 'other', 'is_anonymous': False})

    def login(self, client=None):
        response = (client or self.client).post('/api/admin/login', json={
            'username': server.ADMIN_USER, 'password': server.ADMIN_PASS})
        self.assertEqual(response.status_code, 200)

    def test_private_files_and_traversal_are_not_public(self):
        for path in ['/health_battle.db', '/server.py', '/tests/', '/assets/source/',
                     '/requirements.txt', '/css/../server.py', '/js/%2e%2e/server.py',
                     '/assets/images/food-sources.json', '/.env']:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)
                self.assertEqual(self.client.head(path).status_code, 404)
        for path in ['/', '/admin', '/css/style.css', '/js/game-app.js', '/assets/images/apple.png']:
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)

    def test_invalid_json_and_types_return_400(self):
        for value in [None, [], 'string', 3]:
            response = self.client.post('/api/register', data=__import__('json').dumps(value),
                                        content_type='application/json')
            self.assertEqual(response.status_code, 400)
        for payload in [{'name': []}, {'name': 1}, {'name': 'x' * 121},
                        {'name': 'x', 'is_anonymous': 'false'},
                        {'name': 'x', 'category': 'anonymous'},
                        {'name': 'x', 'school': {}}, {'name': 'x', 'category': '<script>'}]:
            self.assertEqual(self.client.post('/api/register', json=payload).status_code, 400)
        self.assertEqual(self.client.post('/api/register', data='{broken',
                                         content_type='application/json').status_code, 400)

    def test_request_size_and_unknown_endpoint(self):
        self.assertEqual(self.client.post('/api/register', data='x' * (server.MAX_BODY + 1),
                                         content_type='application/json').status_code, 413)
        self.assertEqual(self.client.post('/api/missing', json={}).status_code, 404)

    def test_score_validation_has_no_partial_writes(self):
        self.register()
        for key in ['score', 'healthy_cuts', 'bonus_years']:
            self.app.extensions['rate_limiter'].buckets.clear()
            for bad in [-1, True, 1.5, '20', None, [], 2**80]:
                payload = {'score': 10, 'healthy_cuts': 0, 'bonus_years': 0, key: bad}
                self.assertEqual(self.client.post('/api/score', json=payload).status_code, 400)
        self.assertEqual(self.client.post('/api/score', json={'score': 999}).status_code, 400)
        with server.get_db() as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM game_records').fetchone()[0], 0)

    def test_concurrent_scores_preserve_maximum_and_all_rounds(self):
        self.register()
        token = self.client.get_cookie('player_token').value
        scores = [200, 10, 90, 20, 40, 50, 60, 80, 70, 100, 30, 120, 110, 130, 140, 150]
        def submit(score):
            with self.app.test_client() as client:
                client.set_cookie('player_token', token)
                return client.post('/api/score', json={
                    'score': score, 'healthy_cuts': score, 'bonus_years': 0}).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            self.assertEqual(list(pool.map(submit, scores)), [200] * len(scores))
        with server.get_db() as conn:
            row = conn.execute('SELECT best_score, games_count FROM players').fetchone()
            self.assertEqual(tuple(row), (max(scores), len(scores)))
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM game_records').fetchone()[0], len(scores))
            self.assertEqual(conn.execute('PRAGMA integrity_check').fetchone()[0], 'ok')

    def test_wal_foreign_keys_and_pool_release(self):
        with server.get_db() as conn:
            self.assertEqual(conn.execute('PRAGMA journal_mode').fetchone()[0], 'wal')
            self.assertEqual(conn.execute('PRAGMA foreign_keys').fetchone()[0], 1)
        self.assertEqual(server._db_pool.active, 0)
        self.assertEqual(server._db_pool.idle.qsize(), 8)
        self.assertFalse(conn.in_transaction)
        server.close_db_pool()
        with self.assertRaises(sqlite3.ProgrammingError):
            conn.execute('SELECT 1')
        self.register()
        self.client.post('/api/score', json={'score': 10})
        with server.get_db() as conn:
            conn.execute('DELETE FROM players')
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM game_records').fetchone()[0], 0)

    def test_failed_transaction_rolls_back_and_releases_connection(self):
        with self.assertRaises(RuntimeError):
            with server.get_db() as conn:
                conn.execute("INSERT INTO players(token, name, category) VALUES ('rollback', 'Name', 'other')")
                raise RuntimeError('abort transaction')
        self.assertEqual(server._db_pool.active, 0)
        with server.get_db() as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM players').fetchone()[0], 0)

    def test_rank_ties_match_top_ten_and_anonymous_has_no_rank(self):
        clients = [self.app.test_client() for _ in range(3)]
        for index, client in enumerate(clients):
            self.register(client, name=f'Player {index}')
            client.post('/api/score', json={'score': 10})
        with server.get_db() as conn:
            conn.execute("UPDATE players SET last_active = '2026-01-01 00:00:00'")
        board = clients[2].get('/api/leaderboard').get_json()
        self.assertEqual(board['user_rank']['rank'], 3)
        self.assertEqual([p['rank'] for p in board['top_players']], [1, 2, 3])
        self.assertEqual(clients[2].get('/api/me').get_json()['player']['rank_overall'], 3)
        anonymous = self.app.test_client()
        result = anonymous.post('/api/score', json={'score': 10}).get_json()
        self.assertIsNone(result['rank_overall'])
        self.assertIsNone(anonymous.get('/api/me').get_json()['player']['rank_category'])

    def test_admin_auth_expiry_logout_and_rate_limit(self):
        self.assertEqual(self.client.get('/api/admin/players').status_code, 401)
        self.login()
        self.assertEqual(self.client.get('/api/admin/stats').status_code, 200)
        with server.get_db() as conn:
            conn.execute("UPDATE admin_sessions SET created_at = datetime('now', '-2 days')")
        self.assertEqual(self.client.get('/api/admin/stats').status_code, 401)
        self.login()
        self.client.post('/api/admin/logout', json={})
        self.assertEqual(self.client.get('/api/admin/stats').status_code, 401)
        for _ in range(8):
            self.client.post('/api/admin/login', json={'username': 'admin', 'password': 'wrong'})
        response = self.client.post('/api/admin/login', json={'username': 'admin', 'password': 'wrong'})
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response.headers)

    def test_cross_origin_posts_rejected_and_cookies_httponly(self):
        response = self.register()
        self.assertIn('HttpOnly', response.headers['Set-Cookie'])
        for headers in [{'Origin': 'https://evil.example'}, {'Sec-Fetch-Site': 'cross-site'}]:
            self.assertEqual(self.client.post('/api/score', json={'score': 10}, headers=headers).status_code, 403)
        response = self.client.get('/api/me')
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertNotIn('Access-Control-Allow-Origin', response.headers)

    def test_admin_pagination_token_secrecy_and_csv_safety(self):
        with server.get_db() as conn:
            conn.executemany("INSERT INTO players(token, name, category) VALUES (?, ?, 'other')",
                             [(f'token-{i}', '=1+1' if i == 0 else f'Name {i}') for i in range(205)])
        self.login()
        first = self.client.get('/api/admin/players').get_json()
        third = self.client.get('/api/admin/players?page=3').get_json()
        self.assertEqual(first['total'], 205)
        self.assertEqual(len(first['players']), 100)
        self.assertEqual(len(third['players']), 5)
        self.assertNotIn('token', first['players'][0])
        response = self.client.get('/api/admin/export')
        self.assertIn("'=1+1", response.data.decode('utf-8-sig'))
        self.assertEqual(self.client.get('/api/admin/players?page=oops').status_code, 400)

    def test_limiter_memory_is_bounded(self):
        limiter = server.RateLimiter(capacity=10)
        for i in range(1000):
            limiter.allow(str(i), 1, 60)
        self.assertEqual(len(limiter.buckets), 10)

    def test_admin_password_rotation_revokes_sessions(self):
        self.login()
        server.ADMIN_PASS = 'changed-integration-test-password'
        self.assertEqual(self.client.get('/api/admin/stats').status_code, 401)

    def test_large_page_and_admin_invalid_numbers_are_rejected(self):
        self.login()
        for page in ['-1', '0', '99999999999999999999999999']:
            self.assertEqual(self.client.get('/api/admin/players?page=' + page).status_code, 400)
        self.assertEqual(self.client.post('/api/admin/players/update', json={
            'player_id': 1, 'name': 'Name', 'best_score': 'bad'}).status_code, 400)


if __name__ == '__main__':
    unittest.main()
