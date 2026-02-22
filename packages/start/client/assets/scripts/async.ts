import { allCaps } from '~/client/assets/scripts/utils/transform'
const message = allCaps('[aero]') + ' <script async>...'

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
