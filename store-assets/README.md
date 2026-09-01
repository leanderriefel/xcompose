# Store assets

`source/` contains the supplied listing artwork and screenshots. Run `pnpm run package` to create these upload-ready assets in the gitignored `packages/store-assets/` directory:

- `screenshot-compose-1280x800.png`
- `screenshot-settings-1280x800.png`
- `icon-128.png`
- `chrome-promo-440x280.png`

The source artwork also generates the extension icons in `icons/` before each package build.

The packaging command requires `ffmpeg` on `PATH` to resize the supplied PNGs.
