import os
import tempfile
import unittest
from pathlib import Path
from eth_account import Account
from server.signer_env import load_env_wallet

class EnvSignerTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.path=Path(self.folder.name)/'mainnet.env'
        self.account=Account.create() # Disposable test key; never the operator's configuration.
        self.values={'RAT_BSC_PRIVATE_KEY':'0x'+self.account.key.hex().removeprefix('0x'),
                     'RAT_EXPECTED_ADDRESS':self.account.address,'RAT_LIVE':'1','RAT_MAX_TOTAL_BNB':'0.005'}
    def tearDown(self):self.folder.cleanup()
    def write(self):
        self.path.write_text('\n'.join(k+'='+v for k,v in self.values.items()))
        os.chmod(self.path,0o600)
    def test_load_only_explicit_address_and_budget(self):
        self.write()
        self.assertEqual(load_env_wallet(self.path,self.account.address,'0.005').address,self.account.address)
        with self.assertRaises(ValueError):load_env_wallet(self.path,self.account.address,'0.006')
        with self.assertRaises(ValueError):load_env_wallet(self.path,Account.create().address,'0.005')
    def test_disabled_and_permissions_fail_closed(self):
        self.values['RAT_LIVE']='0';self.write()
        with self.assertRaises(ValueError):load_env_wallet(self.path,self.account.address,'0.005')
        self.values['RAT_LIVE']='1';self.write();os.chmod(self.path,0o644)
        with self.assertRaises(ValueError):load_env_wallet(self.path,self.account.address,'0.005')
    def test_never_evaluates_shell_code_or_echoes_secret(self):
        marker=Path(self.folder.name)/'should-not-exist'
        self.values['RAT_BSC_PRIVATE_KEY']='$(touch '+str(marker)+')';self.write()
        with self.assertRaises(ValueError) as error:load_env_wallet(self.path,self.account.address,'0.005')
        self.assertFalse(marker.exists())
        self.assertNotIn('touch',str(error.exception))
    def test_duplicate_and_symlink_rejected(self):
        self.write()
        with self.path.open('a') as f:f.write('\nRAT_LIVE=1')
        with self.assertRaises(ValueError):load_env_wallet(self.path,self.account.address,'0.005')
        self.write();link=Path(self.folder.name)/'link.env';link.symlink_to(self.path)
        with self.assertRaises(OSError):load_env_wallet(link,self.account.address,'0.005')

if __name__=='__main__':unittest.main()
