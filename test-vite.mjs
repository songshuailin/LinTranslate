
import { createServer } from 'vite'

async function main() {
  try {
    const server = await createServer({
      root: '/Users/huiteng/Sllen/LinTranslate',
      port: 1420,
      logLevel: 'error'
    })
    await server.listen()
    console.log('Vite started on port 1420')
  } catch (e) {
    console.error('Vite error:', e.message || String(e))
  }
}

main()
