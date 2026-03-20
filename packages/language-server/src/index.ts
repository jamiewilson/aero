import {
	createConnection,
	createServer,
	createTypeScriptProject,
	loadTsdkByPath,
} from '@volar/language-server/node'
import { create as createCssService } from 'volar-service-css'
import { create as createHtmlService } from 'volar-service-html'
import { create as createTypeScriptServices } from 'volar-service-typescript'
import { aeroLanguagePlugin } from './languagePlugin'

const connection = createConnection()
const server = createServer(connection)

connection.listen()

connection.onInitialize(params => {
	const tsdk = loadTsdkByPath(params.initializationOptions?.typescript?.tsdk ?? '', params.locale)

	return server.initialize(
		params,
		createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
			languagePlugins: [aeroLanguagePlugin],
		})),
		[createHtmlService(), createCssService(), ...createTypeScriptServices(tsdk.typescript)]
	)
})

connection.onInitialized(server.initialized)
connection.onShutdown(server.shutdown)
