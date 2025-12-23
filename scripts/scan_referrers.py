#!/usr/bin/env python3
"""
Scan referrers for all posts from the command line.

Usage:
  python3 scripts/scan_referrers.py --worker https://admin-proxy.9ohnny.workers.dev --hosts google.com,twitter.com,reddit.com [--ns guohaoqiang_github_io]

This script fetches /posts/posts.json from the worker URL and queries CountAPI for keys
formatted as: {slug}-ref-{host-with-dots-replaced-by-dashes}

Output: prints a per-post sorted list of host:count pairs.
"""
import sys
import argparse
import urllib.request
import urllib.parse
import json


def fetch_json(url, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": "scan-referrers-script/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as f:
        return json.load(f)


def get_count(ns, key):
    url = f"https://api.countapi.xyz/get/{urllib.parse.quote(ns)}/{urllib.parse.quote(key)}"
    try:
        j = fetch_json(url)
        return int(j.get('value', 0))
    except Exception:
        return 0


def slug_ref(slug, host):
    return f"{slug}-ref-{host.replace('.', '-') }"


def main():
    p = argparse.ArgumentParser(description='Scan referrers for all posts via CountAPI')
    p.add_argument('--worker', required=True, help='Worker base URL (e.g. https://admin-proxy.9ohnny.workers.dev)')
    p.add_argument('--hosts', required=True, help='Comma-separated hostnames to scan (e.g. google.com,reddit.com)')
    p.add_argument('--ns', default='guohaoqiang_github_io', help='CountAPI namespace (default from admin page)')
    args = p.parse_args()

    worker = args.worker.rstrip('/')
    hosts = [h.strip() for h in args.hosts.split(',') if h.strip()]
    ns = args.ns

    posts_url = f"{worker}/posts/posts.json"
    try:
        posts = fetch_json(posts_url)
    except Exception as e:
        print(f"Failed to fetch posts.json from {posts_url}: {e}")
        sys.exit(2)

    if not isinstance(posts, list) or len(posts) == 0:
        print("No posts found in posts.json")
        sys.exit(0)

    print(f"Scanning {len(posts)} posts for hosts: {', '.join(hosts)} (ns={ns})")
    for p in posts:
        slug = p.get('slug')
        title = p.get('title') or slug
        results = []
        for h in hosts:
            key = slug_ref(slug, h)
            cnt = get_count(ns, key)
            results.append((h, cnt))
        results.sort(key=lambda x: x[1], reverse=True)
        line = ' · '.join([f"{h}: {c}" for h, c in results])
        print(f"{title} — {line}")


if __name__ == '__main__':
    main()
