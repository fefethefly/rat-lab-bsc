"""Explicit operator-only env-file loader. Never imported by the HTTP control plane."""
import os
import re
import stat
from pathlib import Path
from eth_account import Account
from .chain import wei

PROJECT = Path(__file__).resolve().parents[1]
ALLOWED = {'RAT_BSC_PRIVATE_KEY', 'RAT_EXPECTED_ADDRESS', 'RAT_LIVE', 'RAT_MAX_TOTAL_BNB'}


class SignerConfigError(ValueError):
    """Safe, fixed diagnostic text; never includes configuration values."""


def load_env_wallet(path, expected, budget):
    source = Path(path).expanduser()
    if source.resolve().is_relative_to(PROJECT):
        raise SignerConfigError('Signer configuration must be outside the repository')
    fd = os.open(source, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.getuid():
            raise SignerConfigError('Signer configuration must be an owner-only regular file (mode 600)')
        with os.fdopen(fd, 'r', encoding='utf-8') as f:
            fd = None
            text = f.read(8193)
        if len(text) > 8192: raise SignerConfigError('Signer configuration is too large')
        values = {}
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith('#'): continue
            key, separator, value = line.partition('=')
            key, value = key.strip(), value.strip()
            if not separator or key not in ALLOWED or key in values:
                raise SignerConfigError('Signer configuration has an unknown, duplicate or malformed entry')
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            values[key] = value
        if values.get('RAT_LIVE') != '1': raise SignerConfigError('Local mainnet signing is disabled')
        if values.get('RAT_EXPECTED_ADDRESS', '').lower() != expected.lower():
            raise SignerConfigError('Configured public address differs from the approved creator')
        try:
            configured_budget = wei(values.get('RAT_MAX_TOTAL_BNB', ''))
        except ValueError:
            raise SignerConfigError('RAT_MAX_TOTAL_BNB must be a valid BNB amount') from None
        if not values.get('RAT_MAX_TOTAL_BNB') or configured_budget != wei(budget):
            raise SignerConfigError('Local spending limit must match the approved plan')
        key = values.get('RAT_BSC_PRIVATE_KEY', '')
        if not re.fullmatch(r'(?:0x)?[0-9a-fA-F]{64}', key):
            raise SignerConfigError('Configure a valid private key locally')
        try: account = Account.from_key(key)
        except Exception: raise SignerConfigError('Unable to load the locally configured signer') from None
        if account.address.lower() != expected.lower():
            raise SignerConfigError('Local signer differs from the approved creator')
        return account
    finally:
        if fd is not None: os.close(fd)
