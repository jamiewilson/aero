import path from 'node:path'
import type { ViteDevServer } from 'vite'
import { ComponentLivePropMetadataCache } from '@aero-js/compiler'
import type { resolveDirs } from './defaults'

export function createDevComponentLivePropsCache(): ComponentLivePropMetadataCache {
	return new ComponentLivePropMetadataCache()
}

export function collectDevComponentLivePropMetadata(
	cache: ComponentLivePropMetadataCache,
	root: string,
	dirs: ReturnType<typeof resolveDirs>
): ReturnType<ComponentLivePropMetadataCache['collect']> {
	return cache.collect([
		path.join(root, dirs.client, 'components'),
		path.join(root, dirs.client, 'layouts'),
	])
}

export function watchComponentLivePropsCache(
	server: ViteDevServer,
	cache: ComponentLivePropMetadataCache,
	root: string,
	dirs: ReturnType<typeof resolveDirs>
): void {
	const clientRoot = path.resolve(root, dirs.client)
	const watchRoots = [
		path.join(clientRoot, 'components'),
		path.join(clientRoot, 'layouts'),
	]

	const invalidateIfRelevant = (file: string): void => {
		if (!file.endsWith('.html')) return
		const abs = path.resolve(file)
		if (!watchRoots.some(watchRoot => abs === watchRoot || abs.startsWith(watchRoot + path.sep))) {
			return
		}
		cache.invalidate(abs)
	}

	server.watcher.on('change', invalidateIfRelevant)
	server.watcher.on('add', invalidateIfRelevant)
	server.watcher.on('unlink', invalidateIfRelevant)
}
