import fs from "fs"
import ModliteRunTime from "./virtualMachine/modlite.js"

// node run.js tests/program.cmodlite

const path = process.argv[2]

if (!path) throw "no path specified"

const size = 1024

const runTime = new ModliteRunTime(size)

const binary = fs.readFileSync(path, "binary")

if (binary.length > size) throw "binary too big"

// slow...
for (let i = 0; i < binary.length; i++) {
	const character = binary[i]
	// console.log(`loading character: ${character}(${character.charCodeAt(0)})`)
	runTime.data.setUint8(i, character.charCodeAt(0))
}

// runTime.logData()

runTime.run()