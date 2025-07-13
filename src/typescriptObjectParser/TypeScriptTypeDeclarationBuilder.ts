import { TypeScriptCodeBuilder, TokenGroup, TypeScriptTypeObjectBuilder } from "./ObjectParser";

/******************************************************
 * Type Declaration Builder
 ******************************************************/

export interface TypePropertyOptions {
	optional?: boolean;
	partial?: boolean;
	intersection?: string[];
	union?: string[];
}

/**
 * Provides methods for inspecting and modifying a specific type declaration.
 * Operates based on a TokenGroup of type 'TypeDeclaration'.
 */
export class TypeScriptTypeDeclarationBuilder {
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		public typeGroup: TokenGroup,
		private originalText: string
	) { }

	/**
	 * Gets the name of the type declaration.
	 */
	public getName(): string | undefined {
		return this.typeGroup.name;
	}

	/**
	 * Gets the type definition/annotation text from the original source.
	 * This method extracts the type definition from the original source code for better accuracy,
	 * falling back to metadata if source extraction is not possible.
	 */
	public getTypeDefinition(): string {
		// Extract from original source using the same logic as modification methods
		const typeStart = this.getTypeDefinitionStart();
		const typeEnd = this.getTypeDefinitionEnd();
		
		if (typeStart !== -1 && typeEnd !== -1 && typeStart < typeEnd) {
			const extracted = this.originalText.substring(typeStart, typeEnd).trim();
			if (extracted) {
				return extracted;
			}
		}
		
		// Fallback to metadata if extraction fails
		return this.typeGroup.metadata?.typeAnnotation || '';
	}

	/**
	 * Finds a nested type object within the type definition.
	 * Useful for complex types like: type MyType = { section: { nestedProp: string } }
	 */
	public findNestedTypeObject(
		path: string[],
		options: {
			onFound: (typeObjectBuilder: TypeScriptTypeObjectBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		if (path.length === 0) {
			// Return the root object
			const typeDefinitionStart = this.getTypeDefinitionStart();
			const typeDefinitionEnd = this.getTypeDefinitionEnd();

			if (typeDefinitionStart === -1) {
				options.onNotFound?.();
				return;
			}

			const fullTypeDefinition = this.originalText.substring(typeDefinitionStart, typeDefinitionEnd);

			// Check if it's an object type
			const trimmed = fullTypeDefinition.trim();
			if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
				options.onNotFound?.();
				return;
			}

			const typeObjectBuilder = new TypeScriptTypeObjectBuilder(
				this.parentBuilder,
				typeDefinitionStart + fullTypeDefinition.indexOf('{') + 1,
				typeDefinitionStart + fullTypeDefinition.lastIndexOf('}'),
				this.originalText
			);
			options.onFound(typeObjectBuilder);
			return;
		}

		// Get the actual type definition content from the source
		const typeDefinitionStart = this.getTypeDefinitionStart();
		const typeDefinitionEnd = this.getTypeDefinitionEnd();

		if (typeDefinitionStart === -1) {
			options.onNotFound?.();
			return;
		}

		const fullTypeDefinition = this.originalText.substring(typeDefinitionStart, typeDefinitionEnd);

		// Navigate through the path to find the target nested object
		const result = this.findNestedObjectInDefinition(fullTypeDefinition, path, typeDefinitionStart);

		if (result) {
			const typeObjectBuilder = new TypeScriptTypeObjectBuilder(
				this.parentBuilder,
				result.start,
				result.end,
				this.originalText
			);
			options.onFound(typeObjectBuilder);
		} else {
			options.onNotFound?.();
		}
	}

	/**
	 * Replaces the entire type definition.
	 */
	public setTypeDefinition(newDefinition: string): void {
		// Find the end of the type definition, right before the semicolon or end of the group.
		const typeEnd = this.getTypeDefinitionEnd();
		if (typeEnd === -1) return;

		// Find the position right after the equals sign. This will be the start of our edit.
		let editStart = -1;
		for (const token of this.typeGroup.tokens) {
			// Find the token for '=' to know where the definition begins.
			if (token.name === '=') {
				editStart = token.end;
				break;
			}
		}

		if (editStart === -1) {
			// This should not happen in a valid type declaration.
			console.warn(`Could not find '=' in type declaration: ${this.getName()}`);
			return;
		}

		// The replacement text should be a single space (for consistent formatting) 
		// followed by the new, clean type definition.
		const replacementText = ' ' + newDefinition;

		// Perform the edit, replacing everything from after the '=' to the end of the definition.
		// This replaces the old spacing and content with the new, correctly formatted version.
		this.parentBuilder.addEdit(editStart, typeEnd, replacementText);
	}

	/**
	 * Adds a property to the root level of the type definition (if it's an object type).
	 */
	public addProperty(propertyName: string, propertyType: string, options: TypePropertyOptions = {}): void {
		this.findNestedTypeObject([], {
			onFound: (typeObjectBuilder) => {
				typeObjectBuilder.addProperty(propertyName, propertyType, options);
			},
			onNotFound: () => {
				console.warn(`Cannot add property to non-object type: ${this.getName()}`);
			}
		});
	}

	/**
	 * Checks if the type definition is an object type.
	 */
	public isObjectType(): boolean {
		const typeDefinition = this.getTypeDefinition().trim();
		return typeDefinition.startsWith('{') && typeDefinition.endsWith('}');
	}

	/**
	 * Checks if the type definition is a union type.
	 */
	public isUnionType(): boolean {
		const typeDefinition = this.getTypeDefinition();
		// Simple check for union - look for | outside of braces/brackets/parens
		let depth = 0;
		let inString = false;
		let stringChar = '';

		for (let i = 0; i < typeDefinition.length; i++) {
			const char = typeDefinition[i];
			const prevChar = i > 0 ? typeDefinition[i - 1] : '';

			if ((char === '"' || char === "'") && prevChar !== '\\') {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
			}

			if (!inString) {
				if (char === '{' || char === '[' || char === '(') depth++;
				else if (char === '}' || char === ']' || char === ')') depth--;
				else if (char === '|' && depth === 0) return true;
			}
		}

		return false;
	}

	/**
	 * Gets union type members if this is a union type.
	 */
	public getUnionTypes(): string[] {
		if (!this.isUnionType()) {
			return [this.getTypeDefinition().trim()];
		}

		const typeDefinition = this.getTypeDefinition();
		const unionTypes: string[] = [];
		let currentType = '';
		let depth = 0;
		let inString = false;
		let stringChar = '';

		for (let i = 0; i < typeDefinition.length; i++) {
			const char = typeDefinition[i];
			const prevChar = i > 0 ? typeDefinition[i - 1] : '';

			if ((char === '"' || char === "'") && prevChar !== '\\') {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
			}

			if (!inString) {
				if (char === '{' || char === '[' || char === '(') depth++;
				else if (char === '}' || char === ']' || char === ')') depth--;
				else if (char === '|' && depth === 0) {
					unionTypes.push(currentType.trim());
					currentType = '';
					continue;
				}
			}

			currentType += char;
		}

		if (currentType.trim()) {
			unionTypes.push(currentType.trim());
		}

		return unionTypes;
	}

	/**
	 * Adds a type to a union type, or converts the type to a union if it isn't already.
	 */
	public addUnionType(newType: string): void {
		const currentTypes = this.getUnionTypes();
		const newTypeTrimmed = newType.trim();

		// Check if type already exists
		if (currentTypes.some(t => t.trim() === newTypeTrimmed)) {
			return;
		}
		
		const updatedUnion = [...currentTypes, newTypeTrimmed].join(' | ');
		this.setTypeDefinition(updatedUnion);
	}

	/**
	 * Removes a type from a union type.
	 */
	public removeUnionType(typeToRemove: string): boolean {
		const currentTypes = this.getUnionTypes();
		const typeToRemoveTrimmed = typeToRemove.trim();

		const filteredTypes = currentTypes.filter(type => type.trim() !== typeToRemoveTrimmed);

		if (filteredTypes.length === currentTypes.length) {
			return false; // Type not found
		}

		if (filteredTypes.length === 0) {
			console.warn('Cannot remove all types from union');
			return false;
		}

		const updatedUnion = filteredTypes.join(' | ');
		this.setTypeDefinition(updatedUnion);
		return true;
	}

	/**
	 * Private helper to find the start position of the type definition (after the = sign).
	 */
	private getTypeDefinitionStart(): number {
		// Prefer metadata if available
		if (this.typeGroup.metadata?.typeDefinitionStart !== undefined && this.typeGroup.metadata?.typeDefinitionStart >= 0) {
			return this.typeGroup.metadata.typeDefinitionStart;
		}
		if (!this.typeGroup.tokens || this.typeGroup.tokens.length === 0) {
			return -1;
		}
		// Find the '=' token that marks the start of the type definition
		for (let i = 0; i < this.typeGroup.tokens.length; i++) {
			const token = this.typeGroup.tokens[i];
			const tokenText = token.name ?? this.originalText.substring(token.start, token.end);
			if (tokenText === '=') {
				// Start after the '=' token, skipping any whitespace
				let start = token.end;
				while (start < this.originalText.length && /\s/.test(this.originalText[start])) {
					start++;
				}
				return start;
			}
		}
		return -1;
	}

	/**
	 * Private helper to find the end position of the type definition.
	 */
	private getTypeDefinitionEnd(): number {
		// Prefer metadata if available
		if (this.typeGroup.metadata?.typeDefinitionEnd !== undefined && this.typeGroup.metadata?.typeDefinitionEnd >= 0) {
			return this.typeGroup.metadata.typeDefinitionEnd;
		}
		if (!this.typeGroup.tokens || this.typeGroup.tokens.length === 0) {
			return -1;
		}
		// Find the ';' token that marks the end of the type definition
		for (let i = this.typeGroup.tokens.length - 1; i >= 0; i--) {
			const token = this.typeGroup.tokens[i];
			const tokenText = token.name ?? this.originalText.substring(token.start, token.end);
			if (tokenText === ';') {
				// The end position should be before the semicolon.
				return token.start;
			}
		}
		// If no semicolon found, use the end of the type group
		return this.typeGroup.end;
	}

	/**
	 * Private helper to find nested objects within a type definition.
	 */
	private findNestedObjectInDefinition(
		definition: string,
		path: string[],
		baseOffset: number
	): { start: number; end: number; } | null {
		let currentDefinition = definition.trim();
		let currentOffset = baseOffset;

		// Skip to the first opening brace if we're starting from the root
		const firstBraceIndex = currentDefinition.indexOf('{');
		if(firstBraceIndex === -1) return null;
		currentOffset += firstBraceIndex;
		currentDefinition = currentDefinition.substring(firstBraceIndex);


		// Navigate through each segment of the path
		for (const segment of path) {
			const segmentResult = this.findPropertyInDefinition(currentDefinition, segment, currentOffset);
			if (!segmentResult) return null;

			// Update the current definition to be the content of the found property
			currentDefinition = segmentResult.content;
			currentOffset = segmentResult.contentStart;
		}

		// After iterating through the path, currentDefinition is the text of the target object
		const openBraceIndex = currentDefinition.indexOf('{');
		const closeBraceIndex = this.findMatchingBrace(currentDefinition, openBraceIndex);
		
		if (openBraceIndex === -1 || closeBraceIndex === -1) return null;

		return {
			start: currentOffset + openBraceIndex + 1,
			end: currentOffset + closeBraceIndex
		};
	}

	/**
	 * Private helper to find a property within a type definition.
	 */
	private findPropertyInDefinition(
		definition: string,
		propertyName: string,
		baseOffset: number
	): { content: string; contentStart: number; } | null {
		// Find the property pattern: propertyName: { ... }
		const propertyPattern = new RegExp(`\\b${propertyName}\\s*:\\s*`);
		const match = definition.match(propertyPattern);

		if (!match || match.index === undefined) return null;

		const contentStartIndex = match.index + match[0].length;

		const firstChar = definition.substring(contentStartIndex).trim().charAt(0);
		
		let endIndex = -1;
		if(firstChar === '{') {
			endIndex = this.findMatchingBrace(definition, contentStartIndex + definition.substring(contentStartIndex).indexOf('{'));
		}
		// Extend this for other types if needed (e.g., arrays, primitives)
		
		if(endIndex === -1) {
			// Fallback for non-object types, just find the end by semicolon or newline
			let tempEnd = contentStartIndex;
			while(tempEnd < definition.length && definition[tempEnd] !== ';' && definition[tempEnd] !== '\n') {
				tempEnd++;
			}
			endIndex = tempEnd;
		}


		return {
			content: definition.substring(contentStartIndex, endIndex + 1),
			contentStart: baseOffset + contentStartIndex
		};
	}

	/**
	 * Private helper to find the matching closing brace for an opening brace.
	 */
	private findMatchingBrace(text: string, openBraceIndex: number): number {
		let depth = 1;
		let inString = false;
		let stringChar = '';

		for (let i = openBraceIndex + 1; i < text.length; i++) {
			const char = text[i];
			const prevChar = i > 0 ? text[i - 1] : '';

			if ((char === '"' || char === "'") && prevChar !== '\\') {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
			}

			if (!inString) {
				if (char === '{') depth++;
				else if (char === '}') {
					depth--;
					if (depth === 0) return i;
				}
			}
		}

		return -1; // No matching brace found
	}
}