#!/usr/bin/env python3
"""
Simple JWT issuer (RS256) for admin access tokens.
Requires PyJWT with cryptography: pip install pyjwt[crypto]

Usage:
  python3 scripts/make_jwt.py --private private.pem --exp 300

This prints a short-lived JWT signed with private.pem. Do NOT commit private.pem to the repo.
"""
import argparse
import time
import jwt

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--private', required=True, help='Path to RSA private key PEM')
    p.add_argument('--exp', type=int, default=300, help='Seconds until expiration')
    p.add_argument('--aud', default='admin', help='JWT audience')
    args = p.parse_args()

    with open(args.private, 'rb') as f:
        priv = f.read()

    now = int(time.time())
    payload = {
        'iat': now,
        'exp': now + args.exp,
        'aud': args.aud,
        'sub': 'admin-access',
    }
    token = jwt.encode(payload, priv, algorithm='RS256')
    if isinstance(token, bytes): token = token.decode()
    print(token)

if __name__ == '__main__':
    main()
