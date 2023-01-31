import fs from "fs"
import ModliteRunTime from "./virtualMachine/modlite.js"

// node speedTest.js test/program.cmodlite

const path = process.argv[2]

if (!path) throw "no path specified"

const runTime = new ModliteRunTime()

runTime.exposedFunctions.print = () => {
	console.log("[print]", runTime.stack.pop())
}

const opCode = fs.readFileSync(path, "utf8")

// experimenting with the JavaScript just in time compiler

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")

console.time("opCode executed in")
runTime.run(opCode)
console.timeEnd("opCode executed in")