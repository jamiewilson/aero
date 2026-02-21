import { allCaps } from '~/client/assets/scripts/utils/transform'
const code = crypto.randomUUID().slice(0, 6)
const message = allCaps('[aero] ') + '<script async> ' + code

function simulateAsync() {
	return new Promise(resolve => {
		console.debug(message)
		setTimeout(() => {
			resolve(`${message} resolved`)
		}, 1000)
	})
}

simulateAsync().then(message => {
	console.debug(message)
})
