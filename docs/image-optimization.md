# Native Image Optimization

Modern web frameworks should optimize static assets natively during the build step. Aero integrates a powerful image compression pipeline automatically, powered by `vite-plugin-image-optimizer`.

## Configuration & Usage

Zero configuration is required for image optimization. The integration depends on `sharp` for raster graphics (JPEG, PNG, WebP) and `svgo` for vector graphics (SVG).

When you run `pnpm build`, Aero automatically scans both your project's static directories and manually imported images:

```html
<script is:build>
	// This image will be intercepted and hashed by Vite,
	// then passed through the optimization pipeline on build!
	import AboutImage from '@assets/images/about.jpg'
</script>

<img src="{ AboutImage }" alt="About Us" />
```

Assets imported anywhere in `client/assets/images` are automatically collected as Rollup entry points even if they are only loaded during server-side template generation (`<script is:build>`).

## Expected Results

During the build, the pipeline reports compression savings for every processed image:

```bash
[vite-plugin-image-optimizer] - optimized images successfully:
dist/assets/about.jpg-[hash].jpg  -18%    525.59 kB ->  435.32 kB
dist/favicon.svg                  -19%    0.28 kB ->  0.23 kB
dist/aero.png                     -63%    20.88 kB ->  7.90 kB

total savings = 103.30kB/546.75kB (~19%)
```

## Supported Formats

The pipeline optimally compresses the following static asset extensions:

- `.jpeg` / `.jpg`
- `.png`
- `.webp`
- `.avif`
- `.svg`
- `.gif`

Empty static files (0 bytes) are gracefully bypassed with a minor warning during the compilation step to prevent hard build failures.
