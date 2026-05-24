import { defineConfig } from 'unocss'

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm cursor-pointer transition'],
    ['btn-primary', 'px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm cursor-pointer transition'],
    ['input', 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-400'],
    ['label', 'block text-sm font-medium mb-1'],
  ],
})
