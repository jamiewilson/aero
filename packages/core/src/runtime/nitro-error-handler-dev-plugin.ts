import errorHandler from './nitro-error-handler'

/** Wires Aero's error handler into Nitro dev (devErrorHandler must be a function, not a path). */
export default (nitro: { options: { devErrorHandler?: unknown } }) => {
	if (!nitro.options.devErrorHandler) {
		nitro.options.devErrorHandler = errorHandler
	}
}
