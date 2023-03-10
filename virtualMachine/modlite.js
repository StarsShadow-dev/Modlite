/*
	RunTime version 20

	For JavaScript.
	Can run a web browser or node.
*/

const binaryCodes = [
	"jump",
	"conditionalJump",
	"notConditionalJump",
	"externalJump",

	"transfer",

	// The location register
	"loadR0",
	"storeR0",

	// value 1 register
	"transferToR1",
	"transferFromR1",

	// value 2 register
	"transferToR2",
	"transferFromR2",

	"add",
	"subtract",
	"multiply",
	"divide",

	"equivalent",
	"greaterThan",
]

class ModliteRunTime {
	exposedFunctions = {}

	instructionPointer

	size
	data

	registers

	constructor(size) {
		this.instructionPointer = 0

		this.size = size
		this.data = new DataView(new ArrayBuffer(size))

		this.registers = new DataView(new ArrayBuffer(12))
	}

	deepReset() {
		this.instructionPointer = 0
		this.data = new DataView(new ArrayBuffer(this.size))

		this.registers = new DataView(new ArrayBuffer(12))
	}

	logData() {
		console.log("logData:")

		let i = 0
		let argCounter = 0

		while (i < this.data.byteLength) {
			const byte = this.data.getUint8(i)

			if (argCounter > 0) {
				console.log(`|    [${byteToHex(byte)}]`)
				argCounter--
			} else {
				if (binaryCodes[byte]) {
					console.log(`[${byteToHex(byte)}] - ${binaryCodes[byte]}`)
					if (binaryCodes[byte] == "loadR0") {
						argCounter = 4
					}
				} else {
					console.log(`[${byteToHex(byte)}] - ???`)
				}
			}

			i++
		}
	}

	run() {
		while (this.instructionPointer < this.data.byteLength) {
			const byte = this.data.getUint8(this.instructionPointer)

			console.log(`[${byteToHex(byte)}] - ${binaryCodes[byte]}`)

			if (binaryCodes[byte] == "jump") {
				const location = this.registers.getUint32(0)

				console.log("jump", location)

				if (location == 4294967295) return

				this.instructionPointer = location
				continue
			}
			else if (binaryCodes[byte] == "conditionalJump") {
				const location = this.registers.getUint32(0)
				const condition = this.registers.getUint32(4) == 1

				console.log("conditionalJump", location, condition)

				if (condition) {
					if (location == 4294967295) return

					this.instructionPointer = location
					continue
				}
			}
			else if (binaryCodes[byte] == "notConditionalJump") {
				const location = this.registers.getUint32(0)
				const condition = this.registers.getUint32(4) == 1

				console.log("notNonditionalJump", location, condition)

				console.log("register is", this.registers.getUint32(4))

				if (!condition) {
					if (location == 4294967295) return

					this.instructionPointer = location
					continue
				}
			}
			else if (binaryCodes[byte] == "externalJump") {
				console.log("yay an externalJump")
			}

			else if (binaryCodes[byte] == "transfer") {
				
			}
			else if (binaryCodes[byte] == "loadR0") {
				this.registers.setUint32(0, this.data.getUint32(++this.instructionPointer))
				this.instructionPointer += 3

				console.log("loadR0", this.registers.getUint32(0))
			}
			// else if (binaryCodes[byte] == "storeR0") {
			// }

			else if (binaryCodes[byte] == "transferToR1") {
				const location = this.registers.getUint32(0)
				console.log("before transfer to R1, location: ", location)

				this.registers.setUint32(4, this.data.getUint32(location))

				console.log("transferToR1", this.registers.getUint32(4))
			}
			else if (binaryCodes[byte] == "transferFromR1") {

			}
			
			else if (binaryCodes[byte] == "transferToR2") {
				const location = this.registers.getUint32(0)

				this.registers.setUint32(8, this.data.getUint32(location))

				console.log("transferToR2", this.R1.getUint32(4))
			}
			else if (binaryCodes[byte] == "transferFromR2") {
			}

			else if (binaryCodes[byte] == "add") {
			}
			else if (binaryCodes[byte] == "subtract") {
			}
			else if (binaryCodes[byte] == "multiply") {
			}
			else if (binaryCodes[byte] == "divide") {
			}

			else if (binaryCodes[byte] == "equivalent") {
			}
			else if (binaryCodes[byte] == "greaterThan") {

			}

			else {
				throw `unknown instruction ${byteToHex(byte)}`
			}

			this.instructionPointer++
		}
	}
}

function getNumberFrom4ByteCharacters(a, b, c, d) {
	return a << 24 + b << 16 + c << 8 + d
}

function byteToHex(byte) {
	let hex = byte.toString(16)

	if (hex.length < 2) {
		hex = hex + "0"
	}

	return "0x" + hex
}

// uncomment this when using node
export default ModliteRunTime