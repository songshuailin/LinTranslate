import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from '@unocss/vite'
import presetMini from '@unocss/preset-mini'
import presetUno from '@unocss/preset-uno'

export default defineConfig({
  server: {
    port: 1420,
  },
  plugins: [vue(), UnoCSS({ presets: [presetMini(), presetUno()] })],
})
