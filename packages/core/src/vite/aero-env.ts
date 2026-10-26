/** Whether Nitro build/serve plugins should run (`server: true` and `AERO_SERVER` not disabled). */
export function isAeroNitroEnabled(server: boolean | undefined): boolean {
	return server === true && process.env.AERO_SERVER !== 'false'
}
