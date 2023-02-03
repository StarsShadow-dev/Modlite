import fs from "fs"
import ModliteRunTime from "./virtualMachine/modlite.js"
import * as readline from 'node:readline/promises';

// node run.js tests/return/program.cmodlite

const path = process.argv[2]

if (!path) throw "no path specified"

const runTime = new ModliteRunTime()

runTime.exposedFunctions.print = () => {
	console.log(runTime.stack.pop())
	// if (rl) rl.prompt();
}

var rl = undefined
var onInputI = undefined
runTime.exposedFunctions.createInput = () => {
	rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	onInputI = Number(runTime.stack.pop().charCodeAt(0).toString(10))
	rl.on('line', (line) => {
		runTime.stack.push(line)
		runTime.index = onInputI
		runTime.run()

		rl.prompt();
	});
	rl.prompt();
}

runTime.exposedFunctions.startsWith = () => {
	const startString = runTime.stack.pop()
	const string = runTime.stack.pop()
	runTime.stack.push(string.startsWith(startString) ? "1" : "0")
}

const opCode = fs.readFileSync(path, "utf8")

runTime.binary = opCode
runTime.run()