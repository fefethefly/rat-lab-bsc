import { createPublicClient, http, parseAbi, hexToBytes } from "viem";
import { sha256, unpackEvents, renderWav } from "./firstTakesCore.js";
const abi = parseAbi([
  "function playerHTML(uint256 id) view returns (bytes)",
  "function scoreData(uint256 id) view returns (bytes)",
]);
export async function recoverTake(
  address: string,
  tokenId: number,
  expected: { playerSha256: string; scoreSha256: string; wavSha256: string },
) {
  if (
    !/^0x[a-fA-F0-9]{40}$/.test(address) ||
    !Number.isInteger(tokenId) ||
    tokenId < 1 ||
    tokenId > 16
  )
    throw Error("Invalid test archive.");
  const client = createPublicClient({
    transport: http("https://bsc-testnet-rpc.publicnode.com", {
      timeout: 15000,
      retryCount: 1,
    }),
  });
  if ((await client.getChainId()) !== 97) throw Error("Wrong network.");
  const [htmlHex, scoreHex] = await Promise.all([
    client.readContract({
      address: address as `0x${string}`,
      abi,
      functionName: "playerHTML",
      args: [BigInt(tokenId)],
    }),
    client.readContract({
      address: address as `0x${string}`,
      abi,
      functionName: "scoreData",
      args: [BigInt(tokenId)],
    }),
  ]);
  const html = hexToBytes(htmlHex),
    score = hexToBytes(scoreHex);
  if (
    (await sha256(html)) !== expected.playerSha256 ||
    (await sha256(score)) !== expected.scoreSha256 ||
    (await sha256(renderWav(unpackEvents(score)))) !== expected.wavSha256
  )
    throw Error("On-chain fingerprints do not match.");
  return new Blob([new Uint8Array(html)], { type: "text/html" });
}
