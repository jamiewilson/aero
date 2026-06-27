import { allCaps } from './utils/transform'
const message = allCaps('[aero] <script async>')

function simulateAsync() {
	return new Promise(resolve => {
		console.debug(message)
		setTimeout(() => {
			resolve(`${message} resolved`)
		}, 500)
	})
}

simulateAsync().then(message => {
	console.debug(message)
})
