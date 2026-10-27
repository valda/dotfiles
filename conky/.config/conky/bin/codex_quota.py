#!/usr/bin/env python3
"""Read subscription quotas via the documented Codex app-server protocol.

No credential-file parsing, inference requests, raw RPC logging, or Conky writes.
"""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import math


def timestamp(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        return datetime.fromtimestamp(value, timezone.utc).isoformat().replace('+00:00', 'Z')
    except (ValueError, OverflowError, OSError):
        return None


def number(value, minimum, maximum):
    return (not isinstance(value, bool) and isinstance(value, (int, float))
            and minimum <= value <= maximum and math.isfinite(value))


def window(identifier, kind, duration=None, raw=None, slot=None):
    raw = raw if isinstance(raw, dict) else {}
    used = raw.get('usedPercent')
    remaining = 100 - used if number(used, 0, 100) else None
    reset = timestamp(raw.get('resetsAt'))
    valid_duration = duration is not None
    status = 'ok' if remaining is not None and valid_duration else 'error'
    if not raw:
        status = 'unsupported'
    names = {'weekly': '週間枠', 'short_term': '短期枠', 'other': 'その他の利用枠'}
    label = names[kind]
    if duration is not None:
        label += f' ({duration:g}分)'
    return {'id': identifier, 'display_name': label, 'kind': kind,
            'status': status, 'remaining_percent': remaining,
            'reset_at': reset, 'window_minutes': duration, 'source_slot': slot,
            'reason': ('window_not_reported' if not raw else
                       'invalid_window_data' if status == 'error' else None)}


def empty(status, reason, plan=None, auth=None):
    result = {'schema_version': 1, 'provider': 'codex',
              'fetched_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
              'status': status, 'reason': reason, 'plan_type': plan, 'auth_type': auth,
              'source': 'codex_app_server/account/rateLimits/read', 'windows': []}
    for kind in ('short_term', 'weekly'):
        w = window(f'codex:{kind}', kind)
        w.update(status=status, reason=reason)
        result['windows'].append(w)
    return result


def normalize(result, plan=None, auth='chatgpt'):
    """Classify by measured duration, NOT primary/secondary position."""
    out = empty('unsupported', 'window_not_reported', plan, auth)
    if not isinstance(result, dict):
        return empty('error', 'invalid_response', plan, auth)
    buckets = result.get('rateLimitsByLimitId')
    if not isinstance(buckets, dict) or not buckets:
        legacy = result.get('rateLimits')
        buckets = {legacy.get('limitId') or 'codex': legacy} if isinstance(legacy, dict) else {}
    windows = []
    for bucket_id, bucket in buckets.items():
        if not isinstance(bucket_id, str) or not isinstance(bucket, dict):
            continue
        if bucket_id == 'codex' and isinstance(bucket.get('planType'), str):
            out['plan_type'] = bucket['planType']
        seen = set()
        for slot in ('primary', 'secondary'):
            raw = bucket.get(slot)
            if not isinstance(raw, dict):
                continue
            duration = raw.get('windowDurationMins')
            duration = duration if number(duration, 1, 5256000) else None
            kind = ('weekly' if duration == 10080 else
                    'short_term' if duration is not None and duration < 1440 else 'other')
            identifier = f'{bucket_id}:{kind}'
            if kind in seen or kind == 'other':
                identifier += f':{slot}'
            seen.add(kind)
            w = window(identifier, kind, duration, raw, slot)
            w['bucket_id'] = bucket_id
            windows.append(w)
        if bucket_id == 'codex':
            for kind in ('short_term', 'weekly'):
                if kind not in seen:
                    w = window(f'codex:{kind}', kind)
                    w['bucket_id'] = 'codex'
                    windows.append(w)
    if not windows:
        return out
    if 'codex' not in buckets:
        for kind in ('short_term', 'weekly'):
            w = window(f'codex:{kind}', kind)
            w['bucket_id'] = 'codex'
            windows.append(w)
    out['windows'] = windows
    states = {w['status'] for w in windows}
    out['status'] = 'ok' if states == {'ok'} else 'partial' if 'ok' in states else 'error' if 'error' in states else 'unsupported'
    out['reason'] = None if out['status'] == 'ok' else 'some_windows_unavailable'
    return out


class FetchError(Exception):
    def __init__(self, status, reason):
        self.status, self.reason = status, reason


def rpc_error(error):
    """Inspect only for classification; never expose server error messages."""
    code = error.get('code')
    message = str(error.get('message', '')).lower()
    if code in (401, 403) or any(s in message for s in
            ('unauthorized', 'authentication', 'not authenticated', 'not logged in',
             'log in', 'sign in', 'token expired', 'refresh token')):
        return FetchError('unauthenticated', 'authentication_required')
    if code == -32601:
        return FetchError('unsupported', 'method_not_supported')
    return FetchError('error', 'rpc_failed')


async def read_rpc(process, request_id):
    while True:
        line = await process.stdout.readline()
        if not line:
            raise FetchError('error', 'server_closed')
        response = json.loads(line)
        if not isinstance(response, dict):
            raise FetchError('error', 'invalid_response')
        if response.get('id') != request_id:
            continue
        if 'error' in response:
            if not isinstance(response['error'], dict):
                raise FetchError('error', 'invalid_response')
            raise rpc_error(response['error'])
        result = response.get('result')
        if not isinstance(result, dict):
            raise FetchError('error', 'invalid_response')
        return result


async def send_rpc(process, request_id, method, params=None):
    obj = {'id': request_id, 'method': method}
    if params is not None:
        obj['params'] = params
    process.stdin.write((json.dumps(obj) + '\n').encode())
    await process.stdin.drain()
    return await read_rpc(process, request_id)


async def collect(process):
    await send_rpc(process, 0, 'initialize', {
        'clientInfo': {'name': 'codex_quota_monitor', 'version': '1.0.0'}})
    process.stdin.write(b'{"method":"initialized"}\n')
    await process.stdin.drain()
    account_result = await send_rpc(process, 1, 'account/read', {'refreshToken': False})
    account = account_result.get('account')
    if account is None:
        return empty('unauthenticated', 'authentication_required')
    if not isinstance(account, dict):
        return empty('error', 'invalid_response')
    auth = account.get('type')
    # API credits are NOT subscription allowance. Never fall back to API billing.
    if auth != 'chatgpt':
        return empty('unsupported', 'chatgpt_subscription_required', auth=auth if isinstance(auth, str) else None)
    plan = account.get('planType')
    plan = plan if isinstance(plan, str) else None
    try:
        result = await send_rpc(process, 2, 'account/rateLimits/read')
    except FetchError as exc:
        return empty(exc.status, exc.reason, plan, auth)
    return normalize(result, plan, auth)


async def fetch(timeout=20, codex='codex'):
    process = None
    try:
        # stdio only: no listening socket, no shell, no model/thread/turn requests.
        process = await asyncio.create_subprocess_exec(
            codex, 'app-server', '--listen', 'stdio://',
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL, limit=1024*1024)
        return await asyncio.wait_for(collect(process), timeout=timeout)
    except FileNotFoundError:
        return empty('unsupported', 'codex_cli_not_found')
    except TimeoutError:
        return empty('error', 'timeout')
    except FetchError as exc:
        return empty(exc.status, exc.reason)
    except (OSError, ValueError, TypeError, RecursionError):
        return empty('error', 'transport_or_protocol_error')
    finally:
        if process is not None:
            if process.returncode is None:
                try:
                    process.terminate()
                except ProcessLookupError:
                    pass
            try:
                await asyncio.wait_for(process.wait(), timeout=2)
            except TimeoutError:
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
                await process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--timeout', type=float, default=20, help='RPC deadline in seconds (default 20)')
    parser.add_argument('--codex', default='codex', help='Codex executable path')
    args = parser.parse_args()
    if not math.isfinite(args.timeout) or not 0 < args.timeout <= 120:
        parser.error('--timeout must be greater than 0 and at most 120 seconds')
    result = asyncio.run(fetch(args.timeout, args.codex))
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    return 0 if result['status'] in ('ok', 'partial') else 1


if __name__ == '__main__':
    raise SystemExit(main())
