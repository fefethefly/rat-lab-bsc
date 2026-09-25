# Mainnet operation

The RAT LAB launch has already completed. Token: `0xC090F3c8825b1ca46ae85Cf5D809f191764B7777`; transaction: https://bscscan.com/tx/0xeb45642bc52d7a2e71ee780fac9a13eff0e713fe22636d5445315326711525b7. Do not rerun the RAT launch configuration.

This repository publishes the original RAT LAB Flap planning, signing, receipt validation, and static publishing implementation for inspection. It omits the upstream neural source and trained policies because that repository has no redistribution license. Therefore the full end-to-end neural-run launch is intentionally unavailable in this checkout.

For a different launch, obtain rights to the neural dependencies, create a new reviewed manifest, use a dedicated funded wallet and a new token symbol, and review the current Flap contract interface and budget before any signing. The HTTP server must remain loopback-only. The signer reads a key solely from an owner-only file outside this repository; never place private keys, signed raw transactions, or local journals in Git.
