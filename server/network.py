"""Bounded retries for explicitly read-only requests; never for transaction broadcast."""
import asyncio
import httpx

async def read_request(client, method, url, **kwargs):
    for attempt in range(3):
        try:
            return await client.request(method, url, **kwargs)
        except httpx.TransportError:
            if attempt == 2:
                raise
            await asyncio.sleep(0.5 * (attempt + 1))
