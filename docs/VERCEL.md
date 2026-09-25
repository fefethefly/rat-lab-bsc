# Public website

The production website is https://rat-lab.fun. This public source release builds an original static mascot view. The hosted website currently contains an upstream 3D reference recording that is not redistributed through this repository. Both website variants show the confirmed BSC/Flap release record.

Run `npm ci && npm run build:public` to build the static site. To preview the launched state, copy the public https://rat-lab.fun/release.json response into `public/release.json` first. The publication code in `server/publish.py` requires a verified receipt and matching neural replay before publishing a release record. Local journals, keys, and operator API files do not belong in Vercel's static bundle.
