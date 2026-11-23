"""Isolated real-HTTP benchmark. Never writes to the application's live database.

python tests/load_backend.py --users 1000 --rounds 3 --output artifacts/backend-load.json
Requires psutil for memory measurements: python -m pip install psutil
"""
import argparse
import asyncio
import collections
import json
import logging
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

import psutil

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server


async def request_once(port, path, token=None, payload=None):
    started = time.perf_counter()
    writer = None
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection('127.0.0.1', port), 45)
        body = json.dumps(payload).encode() if payload is not None else b''
        headers = [f'{"POST" if payload is not None else "GET"} {path} HTTP/1.0',
                   f'Host: 127.0.0.1:{port}', 'Connection: close']
        if token:
            headers.append(f'Cookie: player_token={token}')
        if payload is not None:
            headers += ['Content-Type: application/json', f'Content-Length: {len(body)}']
        writer.write(('\r\n'.join(headers) + '\r\n\r\n').encode() + body)
        await writer.drain()
        raw = await asyncio.wait_for(reader.read(), 45)
        head, data = raw.split(b'\r\n\r\n', 1)
        status = int(head.split(b'\r\n', 1)[0].split()[1])
        if status == 200 and path.startswith('/api/'):
            parsed = json.loads(data)
            if not parsed.get('success'):
                status = 'invalid_response'
        return status, (time.perf_counter() - started) * 1000
    except Exception as error:
        return type(error).__name__, (time.perf_counter() - started) * 1000
    finally:
        if writer:
            writer.close()
            await writer.wait_closed()


def summarize(results, elapsed):
    latencies = sorted(ms for _, ms in results)
    return {
        'requests': len(results), 'seconds': round(elapsed, 3),
        'requests_per_second': round(len(results) / elapsed, 1),
        'statuses': dict(collections.Counter(str(status) for status, _ in results)),
        'latency_ms': {name: round(latencies[min(len(latencies) - 1, int(len(latencies) * q))], 1)
                       for name, q in [('p50', .5), ('p95', .95), ('p99', .99), ('max', 1)]},
    }


async def benchmark(port, users, rounds, concurrency, pace_rps):
    reports = {}
    gate = asyncio.Semaphore(concurrency)
    async def limited_request(*args):
        async with gate:
            return await request_once(*args)
    phases = {
        'profile_burst': lambda i: ('/api/me', f'load-{i}', None),
        'leaderboard_burst': lambda i: ('/api/leaderboard?category=all', f'load-{i}', None),
        'score_burst': lambda i: ('/api/score', f'load-{i}', {'score': 50, 'healthy_cuts': 40, 'bonus_years': 10}),
        'mixed': lambda i: (
            ('/api/me', f'load-{i}', None) if i % 4 == 0 else
            ('/api/leaderboard?category=all', f'load-{i}', None) if i % 4 == 1 else
            ('/api/score', f'load-{i}', {'score': 30, 'healthy_cuts': 20, 'bonus_years': 0}) if i % 4 == 2 else
            ('/js/game-app.js', None, None)),
    }
    for name, make_request in phases.items():
        results = []
        started = time.perf_counter()
        for _ in range(rounds):
            results.extend(await asyncio.gather(*[
                limited_request(port, *make_request(i)) for i in range(users)]))
        reports[name] = summarize(results, time.perf_counter() - started)
        print(name, json.dumps(reports[name]), flush=True)
    if pace_rps:
        async def paced(index):
            await asyncio.sleep(index / pace_rps)
            return await limited_request(port, *phases['mixed'](index))
        started = time.perf_counter()
        results = await asyncio.gather(*[paced(i) for i in range(users)])
        reports['paced_mixed'] = summarize(results, time.perf_counter() - started)
        print('paced_mixed', json.dumps(reports['paced_mixed']), flush=True)
    return reports


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--users', type=int, default=1000)
    parser.add_argument('--rounds', type=int, default=3)
    parser.add_argument('--concurrency', type=int, default=128)
    parser.add_argument('--pace-rps', type=int, default=50)
    parser.add_argument('--output', default='artifacts/backend-load.json')
    args = parser.parse_args()
    if not 1 <= args.users <= 1000 or not 1 <= args.rounds <= 3:
        parser.error('users must be 1..1000, rounds 1..3 (rate limits stay enabled)')
    if not 1 <= args.concurrency <= 1000:
        parser.error('concurrency must be 1..1000')
    if not 0 <= args.pace_rps <= 1000:
        parser.error('pace-rps must be 0..1000')
    with tempfile.TemporaryDirectory(prefix='halosi-load-') as directory:
        server.DB_PATH = str(Path(directory) / 'load.db')
        server.init_db()
        with server.get_db() as conn:
            conn.executemany("INSERT INTO players(token, name, category, best_score) VALUES (?, ?, 'other', 10)",
                             [(f'load-{i}', f'Load player {i}') for i in range(args.users)])
        server.close_db_pool()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        env = dict(os.environ, DB_PATH=server.DB_PATH, PORT=str(port), HOST='127.0.0.1',
                   ADMIN_PASSWORD='benchmark-only-password', APP_ENV='production', TRUST_PROXY='0')
        with open(Path(directory) / 'server.log', 'w+', encoding='utf-8') as log:
            child = subprocess.Popen([sys.executable, str(ROOT / 'server.py')], cwd=ROOT,
                                     env=env, stdout=log, stderr=log)
            stop = threading.Event()
            samples = []
            process = psutil.Process(child.pid)
            def sample():
                while not stop.wait(.05):
                    try:
                        samples.append({'rss': process.memory_info().rss, 'threads': process.num_threads()})
                    except psutil.NoSuchProcess:
                        break
            monitor = threading.Thread(target=sample, daemon=True)
            monitor.start()
            try:
                for attempt in range(100):
                    try:
                        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/me', timeout=.5):
                            break
                    except OSError:
                        if child.poll() is not None:
                            raise RuntimeError('Benchmark server failed to start')
                        time.sleep(.1)
                else:
                    raise RuntimeError('Benchmark server startup timed out')
                baseline = process.memory_info().rss
                cpu_before = sum(process.cpu_times()[:2])
                reports = asyncio.run(benchmark(port, args.users, args.rounds, args.concurrency, args.pace_rps))
                cpu_seconds = sum(process.cpu_times()[:2]) - cpu_before
                with server.get_db() as conn:
                    actual = conn.execute('SELECT COUNT(*) FROM game_records').fetchone()[0]
                    integrity = conn.execute('PRAGMA integrity_check').fetchone()[0]
                    lost_records = conn.execute('SELECT COUNT(*) FROM players WHERE games_count != (SELECT COUNT(*) FROM game_records WHERE player_id = players.id)').fetchone()[0]
                report = {'environment': {'platform': sys.platform, 'python': sys.version.split()[0],
                           'users_per_burst': args.users, 'rounds_per_phase': args.rounds,
                           'max_simultaneous_http_requests': args.concurrency,
                           'paced_mixed_target_rps': args.pace_rps,
                           'server_threads': 8, 'note': 'Local machine, client and server share CPU; not a 1 GB VPS certification.'},
                          'phases': reports, 'memory_mb': {'baseline_rss': round(baseline / 2**20, 1),
                          'peak_rss': round(max(s['rss'] for s in samples) / 2**20, 1)},
                          'peak_process_threads': max(s['threads'] for s in samples),
                          'server_cpu_seconds': round(cpu_seconds, 2),
                          'database': {'game_records': actual, 'integrity_check': integrity, 'players_with_incorrect_game_count': lost_records}}
                output = ROOT / args.output
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
                print(json.dumps({key: value for key, value in report.items() if key != 'phases'}, indent=2))
                failures = any(any(status != '200' for status in phase['statuses']) for phase in reports.values())
                expected = args.rounds * (args.users + len(range(2, args.users, 4)))
                if args.pace_rps:
                    expected += len(range(2, args.users, 4))
                return int(failures or actual != expected or integrity != 'ok' or lost_records != 0)
            finally:
                stop.set()
                monitor.join(timeout=1)
                child.terminate()
                child.wait(timeout=10)
                server.close_db_pool()
                log.seek(0)
                errors = [line for line in log if 'ERROR' in line or 'Traceback' in line]
                if errors:
                    print('Server errors:', ''.join(errors[:10]))


if __name__ == '__main__':
    raise SystemExit(main())
