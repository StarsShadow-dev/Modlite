import fs from "fs"
import ModliteRunTime from "./virtualMachine/modlite.js"

const runTime = new ModliteRunTime()

runTime.exposedFunctions.print = () => {
	console.log("[print]", runTime.stack.pop())
}

const opCode = fs.readFileSync("test/program.cmodlite", "utf8")

runTime.run(opCode)