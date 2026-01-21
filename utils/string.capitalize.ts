// Example Usage:
// const anotherSentence = 'this is a test string'
// console.log(anotherSentence.capitalize())
// Output: "This Is A Test String"

if (!String.prototype.capitalize) {
	String.prototype.capitalize = function (): string {
		return this.toLowerCase().replace(/(?:^|\s)\w/g, match => {
			return match.toUpperCase()
		})
	}
}
