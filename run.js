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
	// process.stdin.on('keypress', (char, k) => {
	// 	console.log(char, k)
	// 	runTime.stack.push(char)
	// 	runTime.index = onInputI
	// 	runTime.run()
	// });
	rl.on('line', (line) => {
		runTime.stack.push(line)
		runTime.index = onInputI
		runTime.run()
	});
	rl.prompt();
}

runTime.exposedFunctions["Node:removeInput"] = () => {
	// rl.write(null, { ctrl: true, name: 'c' })
	process.stdin.unref()
}

runTime.exposedFunctions["Node:writeToInput"] = () => {
	if (!rl) throw "no readline for Node:writeToInput"

	const text = runTime.stack.pop()

	if (text.includes("\n")) throw "line breaks cannot be in Node:writeToInput"

	rl.write(text)
}

runTime.exposedFunctions["Node:promptInput"] = () => {
	if (!rl) throw "no readline for Node:promptInput"

	rl.prompt();
}

runTime.exposedFunctions["Node:clearInput"] = () => {
	if (!rl) throw "no readline for Node:clearInput"

	rl.write(null, { ctrl: true, name: 'u' })
}

runTime.exposedFunctions["Node:setTimeout"] = () => {
	const time = Number(runTime.stack.pop())
	const functionToRun = Number(runTime.stack.pop().charCodeAt(0).toString(10))

	setTimeout(() => {
		runTime.index = functionToRun
		runTime.run()
	}, time);
}

const opCode = fs.readFileSync(path, "utf8")

runTime.binary = opCode
runTime.run()