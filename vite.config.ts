import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Base must match the GitHub repo name (askbingbong/worldbook) for Pages.
export default defineConfig({
  base: '/worldbook/',
  plugins: [react()],
})
