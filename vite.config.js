import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import viteCompression from 'vite-plugin-compression';
import lightningcss from 'vite-plugin-lightningcss';

export default defineConfig({
  root: 'src/client',
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    sourcemap: true,
  },
  publicDir: path.resolve(__dirname, 'src/client/assets'),
  optimizeDeps: {
    exclude: ['pg'],
  },
  server: {
    port: 666, // Default Vite port
    proxy: {
      '/api': {
        target: 'http://localhost:3003', // Use HTTP instead of HTTPS
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vue(),
    viteCompression(),
    lightningcss({
      browsers: 'defaults', // Target default browsers
      drafts: {
        nesting: true, // Enable CSS nesting
        customMedia: true, // Enable custom media queries
      },
    }),
    {
      name: 'inject-recaptcha',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace('<script>window.onJackInClickCaptcha = () => false</script></head>', `
          <script>
            window.onJackInClickCaptcha = () => {
              const recaptchaRef = document.querySelector('.g-recaptcha');
              if (window.grecaptcha && recaptchaRef) {
                try {
                  console.log('[FRONTEND] Executing reCAPTCHA...');
                  window.grecaptcha.execute();
                } catch (err) {
                  console.error('[FRONTEND] Error executing reCAPTCHA:', err);
                }
              } else {
                console.error('[FRONTEND] reCAPTCHA not loaded or initialized');
              }
              return true;
            };
          </script>
          <script src="https://www.google.com/recaptcha/api.js" async defer></script>
        </head>`).replace('</body>', `
          <div class="g-recaptcha" 
            ref="recaptchaRef" 
            data-callback="onRecaptchaSuccess"
            data-sitekey="6LeVkDQrAAAAAIctvDRx25iDdNjx3k6_ipkfND5H" 
            data-size="invisible">
          </div>
          <style>
            * {
              -webkit-user-drag: none;
              -webkit-user-select: none; 
              -ms-user-select: none; 
              user-select: none; 
              -webkit-touch-callout: none;
              -webkit-tap-highlight-color: transparent;
            }
          </style>
        </body>`);
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});