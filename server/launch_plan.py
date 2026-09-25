"""Reviewable launch inputs shared by the local UI and one-shot operator runner."""
import time
from typing import Literal
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from eth_utils import is_address, to_checksum_address
from .flap import FlapTax
from .chain import digest, validate_transaction, wei


class TaxConfig(BaseModel):
    model_config = ConfigDict(extra='forbid')
    feeRate: Literal[1, 3, 5, 10]
    burnRate: int = Field(ge=0, le=100)
    divideRate: int = Field(ge=0, le=100)
    liquidityRate: int = Field(ge=0, le=100)
    recipientRate: int = Field(ge=0, le=100)
    recipientAddress: str = ''
    minSharing: int = Field(default=100000, ge=100000, le=1000000000)

    @model_validator(mode='after')
    def allocations(self):
        if self.burnRate + self.divideRate + self.liquidityRate + self.recipientRate != 100:
            raise ValueError('Tax allocations must add up to 100%')
        if self.recipientRate:
            if not is_address(self.recipientAddress) or int(self.recipientAddress, 16) == 0:
                raise ValueError('A non-zero tax recipient address is required')
            self.recipientAddress = to_checksum_address(self.recipientAddress)
        elif self.recipientAddress:
            raise ValueError('Leave the recipient address empty when its allocation is zero')
        digits = str(self.minSharing)
        if any(c != '0' for c in digits[1:]):
            raise ValueError('Minimum dividend holding must be d × 10^n, n >= 5')
        return self


class Manifest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(default='RAT LAB', min_length=1, max_length=32, pattern=r'^\S(?:.*\S)?$')
    symbol: str = Field(default='RAT', min_length=1, max_length=10, pattern=r'^[A-Z0-9]+$')
    description: str = Field(default='A virtual rat. Two neural networks. One on-chain experiment.', min_length=10, max_length=400)
    seed: int = Field(default=2026, ge=0, le=2147483647)
    mode: Literal['dry', 'mainnet'] = 'dry'
    planId: str | None = None
    webUrl: str = ''
    twitterUrl: str = ''
    telegramUrl: str = ''
    preBuyBnb: str = '0'
    maxTotalBnb: str | None = None
    tax: TaxConfig | None = None
    flapTax: FlapTax | None = None

    @field_validator('webUrl', 'twitterUrl', 'telegramUrl')
    @classmethod
    def public_url(cls, value):
        if value:
            u = urlparse(value)
            if len(value) > 300 or u.scheme != 'https' or not u.hostname or u.username or u.password:
                raise ValueError('Use a public HTTPS link without credentials')
        return value

    @field_validator('preBuyBnb', 'maxTotalBnb')
    @classmethod
    def amount(cls, value):
        if value is not None: wei(value)
        return value

    def pinned(self):
        return self.model_dump(exclude={'mode', 'planId'})


def payload_for(m, image, brain_commit, preset, launch_time):
    payload = {'name': m.name, 'shortName': m.symbol,
               'desc': m.description + ' | brain sha256 ' + brain_commit,
               'imgUrl': image, 'launchTime': launch_time, 'label': 'AI', 'lpTradingFee': .0025,
               'preSale': m.preBuyBnb, 'feePlan': False, 'webUrl': m.webUrl,
               'twitterUrl': m.twitterUrl, 'telegramUrl': m.telegramUrl,
               'raisedAmount': preset['totalBAmount'], 'raisedToken': preset}
    if m.tax: payload['tokenTaxInfo'] = m.tax.model_dump()
    return payload


def approval_hash(plan):
    return digest({k: plan[k] for k in ('schemaVersion', 'transaction', 'payload', 'manifest', 'brainCommit', 'expires')})


def check_plan(plan, approved, address, *, allow_expired=False):
    if plan.get('schemaVersion') == 3:
        from .flap import check_plan as check_flap
        return check_flap(plan, approved, address, allow_expired)
    if plan.get('schemaVersion') != 2: raise ValueError('Prepare a fresh version-2 launch plan')
    if approval_hash(plan) != approved: raise ValueError('Approval digest does not match this plan')
    if not allow_expired and time.time() >= plan['expires']:
        raise ValueError('Four.meme plan expired; prepare a fresh plan')
    tx = plan['transaction']; validate_transaction(tx, tx)
    if digest(tx) != plan['transactionHash']: raise ValueError('Transaction digest changed')
    if tx['from'].lower() != address.lower(): raise ValueError('Creator differs from signer')
    m = Manifest(**plan['manifest'])
    if not m.maxTotalBnb or wei(m.maxTotalBnb) <= 0:
        raise ValueError('Set an explicit total BNB budget before preparing a plan')
    if int(tx['value'], 16) > wei(m.maxTotalBnb): raise ValueError('Creation value exceeds approved budget')
    if wei(m.preBuyBnb):
        raise ValueError('Pre-buy launch is not enabled: current platform payment requirements must be verified first')
    p = plan['payload']
    if p != payload_for(m, p['imgUrl'], plan['brainCommit'], p['raisedToken'], p['launchTime']):
        raise ValueError('Platform payload differs from the approved manifest')
    if int(tx['value'], 16) != wei(p['raisedToken']['deployCost']):
        raise ValueError('Creation value differs from published platform cost')
    return m
