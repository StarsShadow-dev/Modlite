import fs from "fs"
import ModliteRunTime from "./virtualMachine/modlite.js"
import * as readline from 'node:readline/promises';

// node run.js tests/program.cmodlite

const path = process.argv[2]

if (!path) throw "no path specified"

const runTime = new ModliteRunTime()

var rl = undefined
var onInputI = undefined
runTime.exposedFunctions["Node:createInput"] = () => {
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

runTime.exposedFunctions["Node:writeToInput"] = () => {
	if (!rl) throw "no readline for Node:writeToInput"

	const text = runTime.stack.pop()

	if (text.includes("\n")) throw "line breaks cannot be in Node:writeToInput"

	rl.write(null, { ctrl: true, name: 'u' })
	rl.write(text)
}

const opCode = fs.readFileSync(path, "utf8")

runTime.binary = opCode
runTime.run()