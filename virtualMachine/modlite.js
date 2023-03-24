/*
	ModliteRunTime version 22

	For JavaScript.
	Can run a web browser or node.
*/

const binaryCodes = [
	"jump",
	"conditionalJump",
	"notConditionalJump",
	"externalJump",

	"load",
	"staticTransfer",
	"dynamicTransfer",

	// "push",
	// "pop",

	"add",
	"subtract",
	"multiply",
	"divide",

	"equivalent",
	"greaterThan",
]

class ModliteRunTime {
	exposedFunctions = [
		() => {
			const location = this.pop()

			// console.log("location", location)

			const value = this.readString(location)

			// console.log("value", value)

			console.log("[print]", value)
		},
	]

	instructionPointer

	size
	data

	registers

	constructor(size) {
		this.instructionPointer = 0

		this.size = size
		this.data = new DataView(new ArrayBuffer(size))

		this.registers = new DataView(new ArrayBuffer(40))
		this.registers.setUint32(9*4, size - 4)
	}

	deepReset() {
		this.instructionPointer = 0

		this.data = new DataView(new ArrayBuffer(this.size))

		this.registers = new DataView(new ArrayBuffer(40))
		this.registers.setUint32(9*4, size - 4)
	}

	pop() {
		const stackPointer = this.registers.getUint32(9*4)+4
		this.registers.setUint32(9*4, stackPointer)

		// console.log("pop", stackPointer)

		return this.data.getUint32(stackPointer)
	}

	readString(location) {
		let i = location
		let string = ""
		while(true) {
			// console.log(i)
			const byte = this.data.getUint8(i++)
			if (byte == 0) {
				return string
			}
			string += String.fromCharCode(byte)
		}
	}

	logData() {
		console.log("logData:")

		let i = 0
		let argCounter = 0

		while (i < this.data.byteLength) {
			const byte = this.data.getUint8(i)

			const instruction = byte >> 2

			if (argCounter > 0) {
				console.log(`|    [${byteToHex(byte)}]`)
				argCounter--
			} else {
				if (binaryCodes[byte]) {
					console.log(`[${byteToHex(byte)}] - ${binaryCodes[instruction]} {${(byte & 0b00000010) != 0} | ${(byte & 0b00000001) != 0}}`)
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

			const instruction = byte >> 2
			
			// console.log(`${this.instructionPointer} - [${byteToHex(byte)}] - ${binaryCodes[instruction]} {${(byte & 0b00000010) != 0} | ${(byte & 0b00000001) != 0}}`)

			if (binaryCodes[instruction] == "jump") {
				const location = this.registers.getUint32(0)

				// console.log("jump", location)

				// a jump to 0xFFFFFFFF ends the program
				if (location == 4294967295) return

				this.instructionPointer = location
				continue
			}
			else if (binaryCodes[instruction] == "conditionalJump") {
				const location = this.registers.getUint32(0)
				const condition = this.registers.getUint32(1*4) == 1

				// console.log("conditionalJump", location, this.registers.getUint32(1*4))

				if (condition) {
					// a jump to 0xFFFFFFFF ends the program
					if (location == 4294967295) return

					this.instructionPointer = location
					continue
				}
			}
			else if (binaryCodes[instruction] == "notConditionalJump") {
				const location = this.registers.getUint32(0)
				const condition = this.registers.getUint32(1*4) == 1

				// console.log("notConditionalJump", location, this.registers.getUint32(1*4))

				if (!condition) {
					// a jump to 0xFFFFFFFF ends the program
					if (location == 4294967295) return

					this.instructionPointer = location
					continue
				}
			}
			else if (binaryCodes[instruction] == "externalJump") {
				const ID = this.registers.getUint32(0)
				// console.log("externalJump ID", ID)

				this.exposedFunctions[ID]()
			}

			else if (binaryCodes[instruction] == "load") {
				const value = this.data.getUint32(++this.instructionPointer)
				this.instructionPointer += 3

				const register = this.data.getUint8(++this.instructionPointer)*4

				// console.log("load", value, register)

				this.registers.setUint32(register, value)
			}
			else if (binaryCodes[instruction] == "staticTransfer") {
				let value
				
				if ((byte & 0b00000010) != 0) {
					// from memory
					const location = this.data.getUint32(++this.instructionPointer)
					this.instructionPointer += 3

					value = this.data.getUint32(location)
				} else {
					// from register
					const register = this.data.getUint8(++this.instructionPointer)*4

					// console.log(this.registers.byteLength, register)

					value = this.registers.getUint32(register)
				}

				if ((byte & 0b00000001) != 0) {
					// to memory
					const location = this.registers.getUint32(4)

					this.registers.setUint32(location, value)
				} else {
					// to register
					let register = this.data.getUint8(++this.instructionPointer)*4

					this.registers.setUint32(register, value)
				}
			}
			else if (binaryCodes[instruction] == "dynamicTransfer") {
				let value

				const register1 = this.data.getUint8(++this.instructionPointer)*4

				// get value
				if ((byte & 0b00000010) != 0) {
					// from memory specified by the register
					const location = this.registers.getUint32(register1)

					value = this.data.getUint32(location)
				} else {
					// from register
					value = this.registers.getUint32(register1)
				}

				// console.log("dynamicTransfer value", value)

				const register2 = this.data.getUint8(++this.instructionPointer)*4

				// console.log("dynamicTransfer register2", register2)

				// set value
				if ((byte & 0b00000001) != 0) {
					// to memory specified by the register
					const location = this.registers.getUint32(register2)

					// console.log("dynamicTransfer location", location)

					this.data.setUint32(location, value)
				} else {
					// to register
					this.registers.setUint32(register2, value)
				}
			}

			// else if (binaryCodes[instruction] == "push") {

			// }
			// else if (binaryCodes[instruction] == "pop") {

			// }

			else if (binaryCodes[instruction] == "add") {
				const register1 = this.data.getUint8(++this.instructionPointer)*4
				const register1value = this.registers.getUint32(register1)

				const register2 = this.data.getUint8(++this.instructionPointer)*4
				const register2value = this.registers.getUint32(register2)

				this.registers.setUint32(register1, register1value + register2value)
			}
			else if (binaryCodes[instruction] == "subtract") {
				const register1 = this.data.getUint8(++this.instructionPointer)*4
				const register1value = this.registers.getUint32(register1)

				const register2 = this.data.getUint8(++this.instructionPointer)*4
				const register2value = this.registers.getUint32(register2)

				this.registers.setUint32(register1, register1value - register2value)
			}
			else if (binaryCodes[instruction] == "multiply") {
				const register1 = this.data.getUint8(++this.instructionPointer)*4
				const register1value = this.registers.getUint32(register1)

				const register2 = this.data.getUint8(++this.instructionPointer)*4
				const register2value = this.registers.getUint32(register2)

				this.registers.setUint32(register1, register1value * register2value)
			}
			else if (binaryCodes[instruction] == "divide") {
				const register1 = this.data.getUint8(++this.instructionPointer)*4
				const register1value = this.registers.getUint32(register1)

				const register2 = this.data.getUint8(++this.instructionPointer)*4
				const register2value = this.registers.getUint32(register2)

				this.registers.setUint32(register1, register1value / register2value)
			}

			else if (binaryCodes[instruction] == "equivalent") {
				const register1 = this.data.getUint8(++this.instructionPointer)*4
				const register1value = this.registers.getUint32(register1)

				const register2 = this.data.getUint8(++this.instructionPointer)*4
				const register2value = this.registers.getUint32(register2)

				this.registers.setUint32(register1, register1value == register2value)
			}
			else if (binaryCodes[instruction] == "greaterThan") {
				const register1 = this.data.getUint8(++this.instructionPointer)*4
				const register1value = this.registers.getUint32(register1)

				const register2 = this.data.getUint8(++this.instructionPointer)*4
				const register2value = this.registers.getUint32(register2)

				this.registers.setUint32(register1, register1value > register2value)
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