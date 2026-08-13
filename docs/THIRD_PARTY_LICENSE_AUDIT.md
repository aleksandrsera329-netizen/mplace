# Third-party license audit

Generated from the committed `package-lock.json` metadata. This is a release checklist, not legal advice.

## API

- Packages with license metadata: **1014**
- Packages with missing license metadata: **5**
- Non-MIT/ISC/BSD/Apache/MPL/common licenses detected: **25**

### Missing metadata

- `busboy@1.6.0` — license metadata missing from lockfile
- `passport-strategy@1.0.0` — license metadata missing from lockfile
- `pause@0.0.1` — license metadata missing from lockfile
- `png-js@1.1.0` — license metadata missing from lockfile
- `streamsearch@1.1.0` — license metadata missing from lockfile

### Notable non-permissive / special licenses

- `glob@13.0.6` — `BlueOak-1.0.0`
- `jackspeak@3.4.3` — `BlueOak-1.0.0`
- `lru-cache@11.5.2` — `BlueOak-1.0.0`
- `minimatch@10.2.5` — `BlueOak-1.0.0`
- `minipass@7.1.3` — `BlueOak-1.0.0`
- `package-json-from-dist@1.0.1` — `BlueOak-1.0.0`
- `path-scurry@2.0.2` — `BlueOak-1.0.0`
- `path-scurry@1.11.1` — `BlueOak-1.0.0`
- `caniuse-lite@1.0.30001806` — `CC-BY-4.0`
- `@img/sharp-libvips-darwin-arm64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-darwin-x64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-arm@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-arm64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-ppc64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-riscv64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-s390x@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-x64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linuxmusl-arm64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linuxmusl-x64@1.3.2` — `LGPL-3.0-or-later`
- `argparse@2.0.1` — `Python-2.0`
- `fs-monkey@1.1.0` — `Unlicense`
- `memfs@3.5.3` — `Unlicense`

## Web

- Packages with license metadata: **546**
- Packages with missing license metadata: **0**
- Non-MIT/ISC/BSD/Apache/MPL/common licenses detected: **14**

### Notable non-permissive / special licenses

- `lru-cache@11.5.2` — `BlueOak-1.0.0`
- `minimatch@10.2.6` — `BlueOak-1.0.0`
- `caniuse-lite@1.0.30001806` — `CC-BY-4.0`
- `@img/sharp-libvips-darwin-arm64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-darwin-x64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-arm@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-arm64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-ppc64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-riscv64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-s390x@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linux-x64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linuxmusl-arm64@1.3.2` — `LGPL-3.0-or-later`
- `@img/sharp-libvips-linuxmusl-x64@1.3.2` — `LGPL-3.0-or-later`
- `argparse@2.0.1` — `Python-2.0`

## Release decision

No GPL/AGPL package was detected from the lockfile license metadata. LGPL, CC-BY, Python-2.0, Unlicense and BlueOak packages require retaining their respective notices/terms where applicable.

Before a commercial IP transfer, run a dedicated SCA/license scanner in the target CI environment and archive its report with the release.
