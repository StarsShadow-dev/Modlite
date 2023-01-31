import fs from "fs"
import ModliteRunTime from "./virtualMachine/modlite.js"

// node run.js tests/return/program.cmodlite

const path = process.argv[2]

if (!path) throw "no path specified"

const runTime = new ModliteRunTime()

runTime.exposedFunctions.print = () => {
	console.log("[print]", runTime.stack.pop())
}

runTime.exposedFunctions.getString = () => {
	runTime.stack.push("a string")
}

const opCode = fs.readFileSync(path, "utf8")

runTime.run(opCode)