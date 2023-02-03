import fs from "fs"
import ModliteRunTime from "./virtualMachine/modlite.js"
import * as readline from 'node:readline/promises';

// node run.js tests/program.cmodlite

const path = process.argv[2]

if (!path) throw "no path specified"

const runTime = new ModliteRunTime()

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

const opCode = fs.readFileSync(path, "utf8")

runTime.binary = opCode
runTime.run()