import fs from "fs"
import ModliteRunTime from "./virtualMachine/modlite.js"

// node run.js tests/program.cmodlite

const path = process.argv[2]

let size = process.argv[3]

if (size) {
	size = Number(size)
} else {
	size = 2048
}

if (!path) throw "no path specified"

const binary = fs.readFileSync(path, "binary")

if (binary.length > size) {
	console.log("error binary too big")
	process.exit(1)
}

const runTime = new ModliteRunTime(size)

for (let i = 0; i < binary.length; i++) {
	const character = binary[i]
	// console.log(`loading character: ${character}(${character.charCodeAt(0)})`)
	runTime.data.setUint8(i, character.charCodeAt(0))
}

runTime.exposedFunctions.push(() => {
	const stackPointer = runTime.registers.getUint32(9*4)

	process.stdout.write(String.fromCharCode(runTime.data.getUint32(stackPointer+4)))

	runTime.registers.setUint32(9*4, stackPointer + 4)
})

runTime.exposedFunctions.push(() => {
	const stackPointer = runTime.registers.getUint32(9*4)+4
	runTime.registers.setUint32(9*4, stackPointer)

	let location = runTime.data.getUint32(stackPointer)

	while(true) {
		const byte = runTime.data.getUint8(location)
		if (byte == 0) {
			return
		}
		process.stdout.write(String.fromCharCode(byte))

		location += 1
	}
})

// console.time("runTime")

runTime.run()

// console.timeEnd("runTime")

// runTime.logData()