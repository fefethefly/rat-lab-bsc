# RAT LAB · BNB Chain / Flap

Original RAT LAB website, BSC/Flap launch integration, local approval and receipt checks, and release publisher. The public source build uses a static mascot illustration because the upstream Labrat neural model, replay files and adapted 3D viewer have no repository-wide redistribution license. See [THIRD_PARTY.md](THIRD_PARTY.md).

## Live release

- Website: https://rat-lab.fun
- Flap: https://flap.sh/bnb/0xC090F3c8825b1ca46ae85Cf5D809f191764B7777
- BSC transaction: https://bscscan.com/tx/0xeb45642bc52d7a2e71ee780fac9a13eff0e713fe22636d5445315326711525b7
- X: https://x.com/gouyi420

## Public website build

```sh
npm ci
npm run build:public
```

The source build expects `/release.json` for verified launch data. Fetch the public record from https://rat-lab.fun/release.json into `public/release.json` when previewing the live state. The build without it intentionally shows an unpublished state. Never copy the local signing journal or private key into the website.

## Local backend and neural-run dependency

```sh
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.lock
```

The backend neural runner imports `session` from `vendor/labrat`. The upstream source and weights are deliberately absent here. You must separately obtain permission and provide compatible components in that path before attempting a neural session or the launch pipeline. Read-only code inspection, the public static site build, and isolated unit tests that mock the neural runner do not need the weights. A production signer should never be operated from a GitHub checkout with imported secrets.

`config/mainnet-draft.json` is an example with public launch parameters, not an invitation to repeat the already completed RAT launch. The published contract is `0xC090F3c8825b1ca46ae85Cf5D809f191764B7777`.

## Architecture

The operator predetermines token metadata and the 0.02 BNB maximum. A locally run virtual rodent hits eight targets on a virtual control surface, not the Flap website. When the complete run and deterministic replay match the approved plan, the independent local signer submits a single Flap Portal transaction. The publisher verifies the BSC receipt before producing a static public bundle. The signer reads secrets only from an owner-only file outside the repository; the HTTP server never loads that key.

**This release does not include the upstream trained policies or the original 3D replay.** The website and Flap links above show the actual completed launch.

## License

Original RAT LAB code and artwork in this repository: MIT. Third-party dependencies and referenced research have separate terms; see [THIRD_PARTY.md](THIRD_PARTY.md).
