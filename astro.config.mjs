import { defineConfig } from 'astro/config';

// فاز اول یک سایت استاتیک است؛ برای این مرحله به سرور یا دیتابیس نیاز نداریم.
export default defineConfig({
  output: 'static'
});
