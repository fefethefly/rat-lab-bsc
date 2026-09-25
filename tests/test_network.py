import unittest
from unittest.mock import AsyncMock, patch
import httpx
from server.network import read_request
from server.chain import rpc

class NetworkTests(unittest.IsolatedAsyncioTestCase):
    async def test_read_retries_transient_connection_error(self):
        response = httpx.Response(200, json={'ok': True})
        client = AsyncMock()
        client.request.side_effect = [httpx.ConnectError('offline'), response]
        with patch('server.network.asyncio.sleep', new_callable=AsyncMock):
            self.assertIs(await read_request(client, 'GET', 'https://example.com'), response)
        self.assertEqual(client.request.await_count, 2)

    async def test_read_stops_after_three_attempts(self):
        client = AsyncMock()
        client.request.side_effect = httpx.ConnectError('offline')
        with patch('server.network.asyncio.sleep', new_callable=AsyncMock):
            with self.assertRaises(httpx.ConnectError):
                await read_request(client, 'GET', 'https://example.com')
        self.assertEqual(client.request.await_count, 3)

    async def test_broadcast_never_retries(self):
        client = AsyncMock()
        client.post.side_effect = httpx.ConnectError('ambiguous submission')
        with patch('server.chain.httpx.AsyncClient') as factory:
            factory.return_value.__aenter__.return_value = client
            with self.assertRaises(httpx.ConnectError):
                await rpc('eth_sendRawTransaction', ['dummy-test-bytes'])
        client.post.assert_awaited_once()
        client.request.assert_not_awaited()
