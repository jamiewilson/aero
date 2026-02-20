import type { UserConfig } from 'vite'
import type { AeroContentOptions } from '@aero-ssg/content/vite'

export interface AeroConfig {
	/** Enable content collections (default: false) */
	content?: boolean | AeroContentOptions

	/** Enable Nitro server integration (default: false) */
	server?: boolean

	/** Directory overrides */
	dirs?: {
		/** Site source directory; pages live at `<client>/pages` (default: 'client') */
		client?: string
		/** Nitro server directory (default: 'server') */
		serverDir?: string
		/** Build output directory (default: 'dist') */
		dist?: string
	}

	/** Vite configuration (merged with Aero defaults) */
	vite?: UserConfig
}

export interface AeroConfigWithEnv {
	/** Static configuration */
	config: AeroConfig
	/** Environment info */
	command: 'dev' | 'build'
	mode: 'development' | 'production'
}

export type AeroConfigFunction = (env: {
	command: 'dev' | 'build'
	mode: 'development' | 'production'
}) => AeroConfig

export type AeroUserConfig = AeroConfig | AeroConfigFunction
