const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Perkecil foreground adaptive icon Android via <inset>.
 * inset 15% per sisi → logo tampil ~70% dari viewport, centered, bg hitam.
 * withDangerousMod jalan tiap prebuild SETELAH generator icon default,
 * jadi overwrite-nya permanen (gak ke-reset).
 */
const withIconInset = (config, { inset = '15%' } = {}) => {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res', 'mipmap-anydpi-v26'
      )
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground"/>
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="${inset}"/>
    </foreground>
</adaptive-icon>`

      for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
        const file = path.join(dir, name)
        if (fs.existsSync(file)) fs.writeFileSync(file, xml)
      }
      return cfg
    },
  ])
}

module.exports = withIconInset
