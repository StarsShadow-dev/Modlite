#ifndef modlite_h
#define modlite_h

typedef struct {
	char *memory;
	uint32_t memorySize;
	
	char *registers;
	
	uint32_t instructionPointer;
} modlite_VMdata;

void modlite_init(modlite_VMdata *data);

uint32_t modlite_pop(modlite_VMdata *data);

void modlite_run(modlite_VMdata *data, void (*exposedFunctions[])(void));

#endif /* modlite_h */
