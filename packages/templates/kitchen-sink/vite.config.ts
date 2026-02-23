import { createViteConfig } from '@aero-ssg/config'
import aeroConfig from './aero.config'

export default createViteConfig(aeroConfig, {
	command: process.argv.includes('build') ? 'build' : 'dev',
	mode: (process.env.NODE_ENV as 'development' | 'production') || 'development',
})
