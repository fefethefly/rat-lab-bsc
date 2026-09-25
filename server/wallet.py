"""Import an existing dedicated wallet into an encrypted file. Run in your own terminal."""
import argparse
import getpass
import json
import os
from pathlib import Path
from eth_account import Account
from eth_utils import is_address


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--address', required=True, help='Expected public creator address')
    p.add_argument('--out', required=True, help='New keystore path outside the repository')
    args = p.parse_args()
    if not is_address(args.address): raise SystemExit('Invalid public address')
    path = Path(args.out).expanduser().resolve()
    root = Path(__file__).resolve().parents[1]
    if path.is_relative_to(root): raise SystemExit('Choose a keystore path outside this repository')
    if path.exists(): raise SystemExit('Refusing to overwrite an existing file')
    secret = getpass.getpass('Existing dedicated wallet private key (hidden; never paste into chat): ')
    try: account = Account.from_key(secret)
    except Exception: raise SystemExit('Invalid key') from None
    finally: del secret
    if account.address.lower() != args.address.lower(): raise SystemExit('Key does not match the expected address')
    password = getpass.getpass('New keystore password (at least 12 characters): ')
    if len(password) < 12 or password != getpass.getpass('Repeat password: '): raise SystemExit('Password is too short or differs')
    encrypted = Account.encrypt(account.key, password)
    del password, account
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(encrypted, f); f.flush(); os.fsync(f.fileno())
    print('Encrypted keystore saved. Public address: ' + args.address)


if __name__ == '__main__': main()
