/*
	ModliteRunTime version 22

	For c.
*/

#include <stdio.h>
#include "modlite.h"

void modlite_init(modlite_VMdata *data) {
	printf("modlite_init\n");
}

void modlite_run(modlite_VMdata *data, void (*exposedFunctions[])(void)) {
	printf("modlite_run\n");
	
	// (*exposedFunctions[0])();
	
	while (data->instructionPointer < data->memorySize) {
		uint8_t byte = data->memory[data->instructionPointer];
		
		uint8_t instruction = byte >> 2;
		
		printf("byte = %u\n", instruction);
		
		// jump
		if (instruction == 0) {
			uint32_t location = data->registers[0];
			
			// a jump to 0xFFFFFFFF ends the program
			if (location == 4294967295) return;
			
			data->instructionPointer = location;
			continue;
		}
		
		// conditionalJump
		else if (instruction == 1) {
			uint32_t location = data->registers[0];
			uint8_t condition = data->registers[1*4] == 1;
			
			if (condition) {
				// a jump to 0xFFFFFFFF ends the program
				if (location == 4294967295) return;
				
				data->instructionPointer = location;
				continue;
			}
		}
		
		// notConditionalJump
		else if (instruction == 2) {
		}
		
		// externalJump
		else if (instruction == 3) {
		}
		
		// load
		else if (instruction == 4) {
			
		}
		
		// staticTransfer
		else if (instruction == 4) {
			
		}
		
		// dynamicTransfer
		else if (instruction == 4) {
			
		}
		
		// add
		else if (instruction == 4) {
			
		}
		
		// subtract
		else if (instruction == 4) {
			
		}
		
		// multiply
		else if (instruction == 4) {
			
		}
		
		// divide
		else if (instruction == 4) {
			
		}
		
		// equivalent
		else if (instruction == 4) {
			
		}
		
		// greaterThan
		else if (instruction == 4) {
			
		} else {
			printf("unknown byte");
			return;
		}
		
		data->instructionPointer += 1;
	}
}
