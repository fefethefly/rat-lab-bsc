import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch,AsyncMock
from server.publish import publish
class PublicationGateTests(unittest.IsolatedAsyncioTestCase):
    async def test_unconfirmed_launch_cannot_publish(self):
        for state in ('reserved','signed','submitted','reverted'):
            with tempfile.TemporaryDirectory() as d:
                p=Path(d)/'journal.json';p.write_text(json.dumps({'state':state}))
                with patch('server.publish.verify_receipt',new=AsyncMock()) as verify,patch('server.publish.subprocess.run') as command:
                    with self.assertRaisesRegex(ValueError,'confirmed launch'):await publish(p,True)
                    verify.assert_not_awaited();command.assert_not_called()
