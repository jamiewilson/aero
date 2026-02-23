import { defineNitroConfig } from 'nitro/config'
import { redirectsToRouteRules } from '@aero-ssg/config'
import type { RedirectRule } from '@aero-ssg/core/types'

const redirects: RedirectRule[] = process.env.AERO_REDIRECTS
	? JSON.parse(process.env.AERO_REDIRECTS)
	: []

export default defineNitroConfig({
	scanDirs: ['server'],
	routeRules: { ...redirectsToRouteRules(redirects) },
})
