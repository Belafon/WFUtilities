import { TypeScriptCodeBuilder, TokenGroup, TypeScriptArrayBuilder } from "./ObjectParser";

/******************************************************
 * Object Literal Builder
 ******************************************************/
/**
 * Provides methods for inspecting and modifying a specific object literal ({ ... }).
 */

export class TypeScriptObjectBuilder {
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		public objectGroup: TokenGroup,
		private originalText: string
	) { }

	public setPropertyValue(propertyName: string, newValue: string): void {
		const property = this.findPropertyByName(propertyName);
		if (property) {
			// Property exists - replace its value
			this.parentBuilder.addEdit(property.valueStart, property.valueEnd, newValue);
		} else {
			// Property doesn't exist - add it
			const properties = this.parseProperties();
			const contentStart = this.objectGroup.start + 1;
			const contentEnd = this.objectGroup.end - 1;
			const currentContent = this.originalText.substring(contentStart, contentEnd);

			if (properties.length === 0) {
				// Empty object case
				this.handleEmptyObjectAddition(propertyName, newValue, currentContent, contentStart, contentEnd);
			} else {
				// Object with existing properties
				this.handleExistingPropertiesAddition(propertyName, newValue, properties, currentContent);
			}
		}
	}

	private handleEmptyObjectAddition(propertyName: string, newValue: string, currentContent: string, contentStart: number, contentEnd: number): void {
		const originalHadNewline = currentContent.includes('\n');
		const newPropertySegment = `${propertyName}: ${newValue}`;

		let newPropertyFullText: string;

		if (originalHadNewline) {
			const indentation = this.detectIndentation(); 
			const baseIndentation = this.detectBaseIndentation(); 
			const propertyLine = `${indentation}${newPropertySegment}`;
			
			if (currentContent.trim() === '') { 
				// currentContent was purely whitespace (newlines, spaces)
				newPropertyFullText = `\n${propertyLine}\n${baseIndentation}`;
			} else {
				// currentContent has comments or other non-whitespace content.
				// We want to preserve this content, ensure it ends with a newline,
				// then add the new property, then add the base indentation for the closing brace.

				let effectiveCurrentContent = currentContent;

				// Trim trailing spaces/tabs from the very end of currentContent, 
				// but be careful to keep essential newlines that separate content from the closing brace.
				effectiveCurrentContent = currentContent.trimEnd(); // Removes trailing spaces/tabs/newlines from the very end.

				// If trimEnd() removed everything because currentContent was e.g. "\n   \n",
				// but currentContent.trim() was NOT empty (e.g. it had comments like "\n //c \n"),
				// then trimEnd() was too aggressive. We must preserve the comments.
				if (effectiveCurrentContent === '' && currentContent.trim() !== '') {
					// This implies currentContent had comments but they were surrounded by enough whitespace
					// that trimEnd() removed them. Revert to a less aggressive trim.
					// Find the last non-whitespace character and take everything up to it, then add a newline.
					let lastCharIndex = -1;
					for(let k=currentContent.length -1; k >=0; k--) {
						if (currentContent[k].trim() !== '') {
							lastCharIndex = k;
							break;
						}
					}
					if (lastCharIndex !== -1) {
						effectiveCurrentContent = currentContent.substring(0, lastCharIndex + 1);
					} else {
						// Should not happen if currentContent.trim() !== ''
						effectiveCurrentContent = currentContent; // fallback
					}
				}

				// Ensure the (potentially comment-filled) content ends with a newline.
				if (effectiveCurrentContent.length > 0 && !effectiveCurrentContent.endsWith('\n')) {
					effectiveCurrentContent += '\n';
				}
				// If effectiveCurrentContent is empty now (e.g. original was "\n \n"), we still want a leading newline for propertyLine.
				if (effectiveCurrentContent.length === 0 && currentContent.length > 0 && currentContent.includes('\n')) {
					effectiveCurrentContent = "\n";
				}

				newPropertyFullText = `${effectiveCurrentContent}${propertyLine}\n${baseIndentation}`;
			}

		} else if (this.originalText.substring(this.objectGroup.start, this.objectGroup.end) === '{}') {
			// Exactly "{}" - no spaces
			newPropertyFullText = `${newPropertySegment}`; 
		} else {
			// Single-line object, possibly with spaces like "{ }" or "{   }" but no newlines in currentContent
			// currentContent might be " " or "   "
			newPropertyFullText = ` ${newPropertySegment} `; // Default to adding with surrounding spaces
		}

		this.parentBuilder.addEdit(contentStart, contentEnd, newPropertyFullText);
	}

	private handleExistingPropertiesAddition(propertyName: string, newValue: string, properties: Array<any>, currentContent: string): void {
		const lastProperty = properties[properties.length - 1];
		const isMultiLine = currentContent.includes('\n');
		const newPropSegment = `${propertyName}: ${newValue}`;

		if (isMultiLine) {
			this.handleMultiLineAddition(newPropSegment, lastProperty, currentContent);
		} else {
			this.handleSingleLineAddition(newPropSegment, lastProperty);
		}
	}

	private handleMultiLineAddition(newPropSegment: string, lastProperty: any, currentContent: string): void {
		const indentation = this.detectIndentation();
		const baseIndentation = this.detectBaseIndentation();
		
		// Find the actual end of the property value (excluding comments and excessive whitespace)
		const propertyValueText = this.originalText.substring(lastProperty.valueStart, lastProperty.valueEnd);
		let actualValueEnd = lastProperty.valueStart;
		
		// Parse the property value to find where it actually ends
		let pos = 0;
		let inString = false;
		let stringChar = '';
		let braceDepth = 0;
		let bracketDepth = 0;
		let parenDepth = 0;
		
		while (pos < propertyValueText.length) {
			const char = propertyValueText[pos];
			
			if ((char === '"' || char === "'") && (pos === 0 || propertyValueText[pos - 1] !== '\\')) {
				if (!inString) { 
					inString = true; 
					stringChar = char; 
				} else if (char === stringChar) {
					inString = false;
				}
			}
			
			if (!inString) {
				if (char === '{') braceDepth++;
				else if (char === '}') braceDepth--;
				else if (char === '[') bracketDepth++;
				else if (char === ']') bracketDepth--;
				else if (char === '(') parenDepth++;
				else if (char === ')') parenDepth--;
				
				// If we hit a comment and we're at depth 0, stop here
				if (char === '/' && pos + 1 < propertyValueText.length && 
					propertyValueText[pos + 1] === '/' && 
					braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
					actualValueEnd = lastProperty.valueStart + pos; // Set to position just before comment
					break;
				}
			}
			
			// Update the actual value end to the current position + 1 (if we're not in a comment)
			if (braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
				actualValueEnd = lastProperty.valueStart + pos + 1;
			}
			
			pos++;
		}
		
		// If we didn't find any structure, just trim whitespace from the end
		if (actualValueEnd === lastProperty.valueStart) {
			const trimmed = propertyValueText.trimEnd();
			actualValueEnd = lastProperty.valueStart + trimmed.length;
		} else {
			// Trim any trailing whitespace from the actual value
			while (actualValueEnd > lastProperty.valueStart && 
				   /\s/.test(this.originalText[actualValueEnd - 1])) {
				actualValueEnd--;
			}
		}
		
		// Check if there's a trailing comma after the actual value
		const contentAfterActualValue = this.originalText.substring(actualValueEnd, this.objectGroup.end - 1);
		const hasTrailingComma = contentAfterActualValue.trim().startsWith(',');

		let newPropertyFullText: string;
		let editStart: number;
		let editEnd: number;

		if (hasTrailingComma) {
			// There's already a comma, we need to add the new property after it
			const commaMatch = contentAfterActualValue.match(/^(\s*,)(\s*)/);
			if (commaMatch) {
				const commaAndImmediateSpace = commaMatch[1];
				const whitespaceAfterComma = commaMatch[2];
				
				const hasNewlineAfterComma = whitespaceAfterComma.includes('\n');
				
				if (hasNewlineAfterComma) {
					newPropertyFullText = `${indentation}${newPropSegment}`;
					const afterCommaContent = contentAfterActualValue.substring(commaAndImmediateSpace.length);
					const newlineMatch = afterCommaContent.match(/^(\s*\n\s*)/);
					
					if (newlineMatch) {
						editStart = actualValueEnd + commaAndImmediateSpace.length + newlineMatch[1].length;
					} else {
						editStart = actualValueEnd + commaAndImmediateSpace.length + whitespaceAfterComma.length;
					}
				} else {
					newPropertyFullText = `\n${indentation}${newPropSegment}`;
					editStart = actualValueEnd + commaAndImmediateSpace.length + whitespaceAfterComma.length;
				}
				
				const remainingContent = this.originalText.substring(editStart, this.objectGroup.end - 1);
				const closingBraceMatch = remainingContent.match(/^(.*?)(\n\s*)?$/s);
				
				if (closingBraceMatch) {
					const contentBeforeClosing = closingBraceMatch[1];
					const closingIndentation = closingBraceMatch[2] || '';
					
					if (contentBeforeClosing.trim()) {
						newPropertyFullText += contentBeforeClosing;
					}
					
					if (closingIndentation) {
						newPropertyFullText += closingIndentation;
					} else if (!contentBeforeClosing.trim()) {
						newPropertyFullText += `\n${baseIndentation}`;
					}
				}
				
				editEnd = this.objectGroup.end - 1;
			} else {
				newPropertyFullText = `\n${indentation}${newPropSegment}\n${baseIndentation}`;
				editStart = actualValueEnd;
				editEnd = this.objectGroup.end - 1;
			}
		} else {
			// No comma, add comma and new property
			// Add comma immediately after the actual property value,
			// then preserve any content (comments, etc.), then add the new property
			const afterValueContent = this.originalText.substring(actualValueEnd, this.objectGroup.end - 1);
			
			// Check if there are comments or other content after the value
			const hasContentAfterValue = afterValueContent.trim() && !afterValueContent.trim().startsWith('}');
			
			if (hasContentAfterValue) {
				// Add comma immediately after the actual property value,
				// then preserve the content (comments, etc.), then add the new property
				newPropertyFullText = `,${afterValueContent}${indentation}${newPropSegment}`;
				
				// Always add newline and base indentation for closing brace
				newPropertyFullText += `\n${baseIndentation}`;
			} else {
				// Simple case: just add comma and new property
				newPropertyFullText = `,\n${indentation}${newPropSegment}`;
				
				// Check if the closing brace is on its own line
				const endsWithNewlineBeforeBrace = /\n\s*$/.test(afterValueContent);
				if (endsWithNewlineBeforeBrace) {
					newPropertyFullText += `\n${baseIndentation}`;
				}
			}
			
			editStart = actualValueEnd;
			editEnd = this.objectGroup.end - 1;
		}

		this.parentBuilder.addEdit(editStart, editEnd, newPropertyFullText);
	}

	private handleSingleLineAddition(newPropSegment: string, lastProperty: any): void {
		// For single-line objects, we need to be very careful about spacing
		const contentAfterLastValue = this.originalText.substring(lastProperty.valueEnd, this.objectGroup.end - 1);
		
		// Check for existing trailing comma
		const trailingCommaMatch = contentAfterLastValue.match(/^(\s*,\s*)/);
		const hasSpaceBeforeClosingBrace = contentAfterLastValue.endsWith(' ');
		
		let newPropertyFullText: string;
		let editStart: number;
		let editEnd: number;

		if (trailingCommaMatch) {
			// Replace trailing comma and any whitespace with new property
			newPropertyFullText = `, ${newPropSegment}`;
			if (hasSpaceBeforeClosingBrace) {
				newPropertyFullText += ' ';
			}
			editStart = lastProperty.valueEnd;
			editEnd = this.objectGroup.end - 1; // Replace everything up to closing brace
		} else {
			// No trailing comma, add comma and new property
			newPropertyFullText = `, ${newPropSegment}`;
			if (hasSpaceBeforeClosingBrace) {
				newPropertyFullText += ' ';
			}
			editStart = lastProperty.valueEnd;
			editEnd = this.objectGroup.end - 1; // Replace everything up to closing brace
		}

		this.parentBuilder.addEdit(editStart, editEnd, newPropertyFullText);
	}

	/**
	 * Helper to detect the indentation pattern used in the object
	 */
	private detectIndentation(): string {
		// First, try to detect indentation from existing properties
		const properties = this.parseProperties();
		if (properties.length > 0) {
			// Get the indentation of each property by looking at the line it starts on
			const contentStart = this.objectGroup.start + 1;
			const fullContent = this.originalText.substring(contentStart, this.objectGroup.end - 1);
			
			for (const prop of properties) {
				// Find the line containing this property
				const propRelativeStart = prop.start - contentStart;
				const textBeforeProperty = fullContent.substring(0, propRelativeStart);
				const lastNewlineIndex = textBeforeProperty.lastIndexOf('\n');
				
				if (lastNewlineIndex !== -1) {
					// Extract text from the last newline to the property start
					const lineStartToProperty = fullContent.substring(lastNewlineIndex + 1, propRelativeStart);
					if (/^\s+$/.test(lineStartToProperty)) {
						// This line contains only whitespace before the property, so it's the indentation
						return lineStartToProperty;
					}
				}
			}
		}

		// Fallback to content-based detection
		const contentStart = this.objectGroup.start + 1;
		const contentEnd = this.objectGroup.end - 1;
		const content = this.originalText.substring(contentStart, contentEnd);

		// Look for lines with actual content that have indentation
		const lines = content.split('\n');
		for (let line of lines) {
			if (line.trim() && /^\s+/.test(line)) {
				const match = line.match(/^(\s+)/);
				if (match) {
					return match[1];
				}
			}
		}

		// If no content lines found, look for whitespace-only lines (like in empty formatted objects)
		// For cases like {   \n  \n}, we want to use the shorter indentation that's likely intended for content
		const whitespaceLines = lines.filter(line => !line.trim() && line.length > 0);
		if (whitespaceLines.length > 0) {
			// Find the shortest non-zero indentation, as it's likely the intended content indentation
			const indentations = whitespaceLines.map(line => line.length).filter(len => len > 0);
			if (indentations.length > 0) {
				const minIndentation = Math.min(...indentations);
				return ' '.repeat(minIndentation);
			}
		}

		// Last resort: look for any indentation pattern after newlines
		const match = content.match(/\n(\s+)/);
		if (match) {
			return match[1];
		}

		// Default to 4 spaces
		return '    ';
	}

	/**
	 * Helper to detect the base indentation (for closing braces)
	 */
	private detectBaseIndentation(): string {
		// Look at the line containing the opening brace to determine base indentation
		const objectStart = this.objectGroup.start;
		
		// Find the start of the line that contains the opening brace
		let lineStart = objectStart;
		while (lineStart > 0 && this.originalText[lineStart - 1] !== '\n') {
			lineStart--;
		}
		
		// Extract indentation from that line
		let lineContent = '';
		let pos = lineStart;
		while (pos < objectStart && this.originalText[pos] !== '\n') {
			if (this.originalText[pos] === ' ' || this.originalText[pos] === '\t') {
				lineContent += this.originalText[pos];
			} else {
				// Hit non-whitespace, this is the base indentation
				break;
			}
			pos++;
		}
		
		return lineContent;
	}

	/**
	 * Adds a property if it doesn't already exist.
	 * @param propertyName The name of the property.
	 * @param value The value of the property.
	 * @returns True if the property was added, false if it already existed.
	 */
	public addPropertyIfMissing(propertyName: string, value: string): boolean {
		const property = this.findPropertyByName(propertyName);
		if (!property) {
			this.setPropertyValue(propertyName, value); // setPropertyValue handles addition
			return true;
		}
		return false;
	}

	/**
	 * Finds a nested property or element using a path string.
	 * Example path: "data.items[0].name"
	 * @param objectPath The path string.
	 * @param options Callbacks for handling success or failure.
	 *                `onFound` receives an object with either a `builder` (for nested objects/arrays)
	 *                or `value`, `start`, `end` (for primitive values).
	 */
	public findNestedProperty(
		objectPath: string,
		options: {
			onFound: (result: {
				builder?: TypeScriptObjectBuilder | TypeScriptArrayBuilder;
				value?: string; // The text of the primitive value
				start?: number; // Absolute start of the primitive value in originalText
				end?: number; // Absolute end of the primitive value in originalText
			}) => void;
			onNotFound?: () => void;
		}
	): void {
		const segments = this._parsePath(objectPath);
		if (segments.length === 0) {
			options.onNotFound?.();
			return;
		}

		let currentContext: TypeScriptObjectBuilder | TypeScriptArrayBuilder | undefined = this;

		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			const isLastSegment = i === segments.length - 1;

			if (!currentContext) {
				options.onNotFound?.();
				return;
			}

			if (currentContext instanceof TypeScriptObjectBuilder) {
				const propInfo = currentContext.findPropertyByName(segment); // segment here is property name
				if (!propInfo) {
					options.onNotFound?.();
					return;
				}

				const valueText = this.originalText.substring(propInfo.valueStart, propInfo.valueEnd).trim();
				if (isLastSegment) {
					// If it's the last segment, decide if it's a primitive or a structure
					if (valueText.startsWith('{') && valueText.endsWith('}')) {
						const tempGroup: TokenGroup = { type: 'ObjectLiteral', start: propInfo.valueStart, end: propInfo.valueEnd, tokens: [], children: [], metadata: {} };
						currentContext = new TypeScriptObjectBuilder(this.parentBuilder, tempGroup, this.originalText);
						options.onFound({ builder: currentContext });
					} else if (valueText.startsWith('[') && valueText.endsWith(']')) {
						const tempGroup: TokenGroup = { type: 'ArrayLiteral', start: propInfo.valueStart, end: propInfo.valueEnd, tokens: [], children: [], metadata: {} };
						currentContext = new TypeScriptArrayBuilder(this.parentBuilder, tempGroup, this.originalText);
						options.onFound({ builder: currentContext });
					} else {
						options.onFound({ value: valueText, start: propInfo.valueStart, end: propInfo.valueEnd });
					}
					return;
				}

				// Not the last segment, so we expect a structure to continue
				if (valueText.startsWith('{') && valueText.endsWith('}')) {
					const tempGroup: TokenGroup = { type: 'ObjectLiteral', start: propInfo.valueStart, end: propInfo.valueEnd, tokens: [], children: [], metadata: {} };
					currentContext = new TypeScriptObjectBuilder(this.parentBuilder, tempGroup, this.originalText);
				} else if (valueText.startsWith('[') && valueText.endsWith(']')) {
					const tempGroup: TokenGroup = { type: 'ArrayLiteral', start: propInfo.valueStart, end: propInfo.valueEnd, tokens: [], children: [], metadata: {} };
					currentContext = new TypeScriptArrayBuilder(this.parentBuilder, tempGroup, this.originalText);
				} else {
					options.onNotFound?.(); // Path requires deeper structure but found primitive
					return;
				}
			} else if (currentContext instanceof TypeScriptArrayBuilder) {
				const indexMatch = segment.match(/^\[(\d+)\]$/); // segment here is like "[0]"
				if (!indexMatch) {
					// This case might occur if the path is like "array.property" instead of "array[0]"
					// Or if the segment is just a number without brackets, which _parsePath might produce.
					// For robustness, try parsing segment as a plain number if indexMatch fails.
					const plainIndex = parseInt(segment, 10);
					if (isNaN(plainIndex)) {
						options.onNotFound?.(); // Expected array index format like "[0]" or "0"
						return;
					}
					// If we're here, segment was a plain number, treat it as an index.
					const items = (currentContext as any).parseItems(); // Access private for structured items
					if (plainIndex >= items.length) {
						options.onNotFound?.();
						return;
					}
					const itemInfo = items[plainIndex];
					const itemValueText = itemInfo.value.trim();

					if (isLastSegment) {
						if (itemValueText.startsWith('{') && itemValueText.endsWith('}')) {
							const tempGroup: TokenGroup = { type: 'ObjectLiteral', start: itemInfo.start, end: itemInfo.end, tokens: [], children: [], metadata: {} };
							currentContext = new TypeScriptObjectBuilder(this.parentBuilder, tempGroup, this.originalText);
							options.onFound({ builder: currentContext });
						} else if (itemValueText.startsWith('[') && itemValueText.endsWith(']')) {
							const tempGroup: TokenGroup = { type: 'ArrayLiteral', start: itemInfo.start, end: itemInfo.end, tokens: [], children: [], metadata: {} };
							currentContext = new TypeScriptArrayBuilder(this.parentBuilder, tempGroup, this.originalText);
							options.onFound({ builder: currentContext });
						} else {
							options.onFound({ value: itemValueText, start: itemInfo.start, end: itemInfo.end });
						}
						return;
					}
					// Not last segment
					if (itemValueText.startsWith('{') && itemValueText.endsWith('}')) {
						const tempGroup: TokenGroup = { type: 'ObjectLiteral', start: itemInfo.start, end: itemInfo.end, tokens: [], children: [], metadata: {} };
						currentContext = new TypeScriptObjectBuilder(this.parentBuilder, tempGroup, this.originalText);
					} else if (itemValueText.startsWith('[') && itemValueText.endsWith(']')) {
						const tempGroup: TokenGroup = { type: 'ArrayLiteral', start: itemInfo.start, end: itemInfo.end, tokens: [], children: [], metadata: {} };
						currentContext = new TypeScriptArrayBuilder(this.parentBuilder, tempGroup, this.originalText);
					} else {
						options.onNotFound?.(); // Path requires deeper structure but found primitive
						return;
					}

				} else { // indexMatch was successful for "[index]"
					const index = parseInt(indexMatch[1], 10);
					const items = (currentContext as any).parseItems(); // Access private for structured items
					if (index >= items.length) {
						options.onNotFound?.();
						return;
					}

					const itemInfo = items[index];
					const itemValueText = itemInfo.value.trim();

					if (isLastSegment) {
						if (itemValueText.startsWith('{') && itemValueText.endsWith('}')) {
							const tempGroup: TokenGroup = { type: 'ObjectLiteral', start: itemInfo.start, end: itemInfo.end, tokens: [], children: [], metadata: {} };
							currentContext = new TypeScriptObjectBuilder(this.parentBuilder, tempGroup, this.originalText);
							options.onFound({ builder: currentContext });
						} else if (itemValueText.startsWith('[') && itemValueText.endsWith(']')) {
							const tempGroup: TokenGroup = { type: 'ArrayLiteral', start: itemInfo.start, end: itemInfo.end, tokens: [], children: [], metadata: {} };
							currentContext = new TypeScriptArrayBuilder(this.parentBuilder, tempGroup, this.originalText);
							options.onFound({ builder: currentContext });
						} else {
							options.onFound({ value: itemValueText, start: itemInfo.start, end: itemInfo.end });
						}
						return;
					}

					// Not last segment
					if (itemValueText.startsWith('{') && itemValueText.endsWith('}')) {
						const tempGroup: TokenGroup = { type: 'ObjectLiteral', start: itemInfo.start, end: itemInfo.end, tokens: [], children: [], metadata: {} };
						currentContext = new TypeScriptObjectBuilder(this.parentBuilder, tempGroup, this.originalText);
					} else if (itemValueText.startsWith('[') && itemValueText.endsWith(']')) {
						const tempGroup: TokenGroup = { type: 'ArrayLiteral', start: itemInfo.start, end: itemInfo.end, tokens: [], children: [], metadata: {} };
						currentContext = new TypeScriptArrayBuilder(this.parentBuilder, tempGroup, this.originalText);
					} else {
						options.onNotFound?.(); // Path requires deeper structure but found primitive
						return;
					}
				}
			}
		}
		// This case should ideally not be reached if `isLastSegment` logic is correct.
		// If the loop finishes, it means the entire path was consumed and the final `currentContext` is a builder.
		if (currentContext && (currentContext instanceof TypeScriptObjectBuilder || currentContext instanceof TypeScriptArrayBuilder)) {
			options.onFound({ builder: currentContext });
		} else {
			options.onNotFound?.();
		}
	}

	/**
	 * Traverses the object tree, calling callbacks for different element types.
	 * @param callbacks Callbacks to execute for properties, objects, arrays, and primitives.
	 * @param currentPath Internal: Used for recursive calls to track the path.
	 */
	// In TypeScriptObjectBuilder
	public traverseObjectTree(
		callbacks: {
			onProperty?: (path: string, name: string, valueText: string, valueType: 'object' | 'array' | 'primitive') => void;
			onObjectEnter?: (path: string, name?: string) => void; // name is the name of the object itself
			onObjectLeave?: (path: string, name?: string) => void;
			onArrayEnter?: (path: string, name: string) => void; // name is the property name holding the array
			onArrayLeave?: (path: string, name: string) => void;
			onArrayItem?: (path: string, index: number, itemText: string, itemType: 'object' | 'array' | 'primitive') => void; // path is to the array
			onPrimitive?: (path: string, name: string, valueText: string) => void; // path is to the parent object
		},
		// currentObjectPath is the path TO THIS OBJECT.
		// For the first call, this might be the variable name if known, or empty.
		currentObjectPath: string = ''
	): void {
		// The "name" of this object being traversed.
		// If currentObjectPath is "data.config", its name is "config".
		// If currentObjectPath is "data", its name is "data".
		// If currentObjectPath is "", it means it's the root object from the initial call,
		// and its name isn't derived from a path segment but is implicitly the object itself.
		// The test's logging `name || 'C'` handles this by defaulting to 'C'.
		const nameOfThisObject = currentObjectPath.split('.').pop() || (currentObjectPath === '' ? (this.objectGroup.name || '') : '');


		if (callbacks.onObjectEnter) {
			callbacks.onObjectEnter(currentObjectPath, nameOfThisObject);
		}

		const properties = this.parseProperties();
		for (const prop of properties) {
			// pathForProperty is the full path leading to this specific property.
			// If currentObjectPath is "data.config" and prop.name is "settings",
			// then pathForProperty becomes "data.config.settings".
			const pathForProperty = currentObjectPath ? `${currentObjectPath}.${prop.name}` : prop.name;
			const valueText = this.originalText.substring(prop.valueStart, prop.valueEnd).trim();
			let valueType: 'object' | 'array' | 'primitive' = 'primitive';

			if (valueText.startsWith('{') && valueText.endsWith('}')) {
				valueType = 'object';
			} else if (valueText.startsWith('[') && valueText.endsWith(']')) {
				valueType = 'array';
			}

			if (callbacks.onProperty) {
				// The 'path' for onProperty is the path to the object containing this property.
				callbacks.onProperty(currentObjectPath, prop.name, valueText, valueType);
			}

			if (valueType === 'object') {
				const tempGroup: TokenGroup = { type: 'ObjectLiteral', start: prop.valueStart, end: prop.valueEnd, tokens: [], children: [], metadata: {} };
				// Pass the actual name of the property as the group name for the nested object.
				tempGroup.name = prop.name;
				const nestedObjectBuilder = new TypeScriptObjectBuilder(this.parentBuilder, tempGroup, this.originalText);
				// When recursing, pathForProperty (path to this nested object) is passed.
				nestedObjectBuilder.traverseObjectTree(callbacks, pathForProperty);
			} else if (valueType === 'array') {
				// pathForProperty is the path to this array property. prop.name is the name of this array property.
				if (callbacks.onArrayEnter) callbacks.onArrayEnter(pathForProperty, prop.name);

				const tempGroup: TokenGroup = { type: 'ArrayLiteral', start: prop.valueStart, end: prop.valueEnd, tokens: [], children: [], metadata: {} };
				tempGroup.name = prop.name; // Name of the array property
				const nestedArrayBuilder = new TypeScriptArrayBuilder(this.parentBuilder, tempGroup, this.originalText);

				const items = (nestedArrayBuilder as any).parseItems() as Array<{ value: string; start: number; end: number; }>;
				items.forEach((item, index) => {
					const itemText = item.value.trim();
					let itemType: 'object' | 'array' | 'primitive' = 'primitive';
					if (itemText.startsWith('{') && itemText.endsWith('}')) itemType = 'object';
					else if (itemText.startsWith('[') && itemText.endsWith(']')) itemType = 'array';

					if (callbacks.onArrayItem) {
						// The 'path' for onArrayItem is the path to the array itself.
						callbacks.onArrayItem(pathForProperty, index, itemText, itemType);
					}
					// No deeper recursion for items in arrays as per test expectation.
				});
				if (callbacks.onArrayLeave) callbacks.onArrayLeave(pathForProperty, prop.name);

			} else { // Primitive
				if (callbacks.onPrimitive) {
					// The 'path' for onPrimitive is the path to the object containing this primitive.
					callbacks.onPrimitive(currentObjectPath, prop.name, valueText);
				}
			}
		}
		if (callbacks.onObjectLeave) {
			callbacks.onObjectLeave(currentObjectPath, nameOfThisObject);
		}
	}


	/**
	 * Helper to parse a property path string.
	 * e.g., "data.items[0].name" -> ["data", "items", "[0]", "name"]
	 */
	private _parsePath(path: string): string[] {
		// Regex to split by '.' or by '[' (keeping '[' in the segment)
		// and then filter out empty strings from consecutive delimiters.
		// Matches property names or array accessors like [0] or plain numbers for indices
		const rawSegments = path.match(/[^.\[\]]+|\[\d+\]/g);
		if (rawSegments) {
			return rawSegments.map(seg => {
				// If segment is like "[0]", keep it. Otherwise, it's a property name.
				if (seg.startsWith('[') && seg.endsWith(']')) {
					return seg;
				}
				// If segment is a plain number, it's an index for an array.
				if (/^\d+$/.test(seg)) {
					return seg; // Keep as string, parseInt later
				}
				return seg; // Property name
			});
		}
		return [];
	}

	// ... (rest of TypeScriptObjectBuilder methods: removeProperty, addPropertyAtIndex, addPropertyAfterItem, etc. from original)
	// ... (including findArray, findObject, getContentText, getFullText, parseProperties, findPropertyByName, isWhitespace, trimQuotes)
	// The following methods are assumed to exist from the problem description, ensure they are present or re-add if missing
	public removeProperty(propertyName: string): boolean {
		const property = this.findPropertyByName(propertyName);
		if (!property) return false;
		const properties = this.parseProperties();
		const propertyIndex = properties.findIndex(p => p.name === propertyName);
		if (properties.length === 1) {
			this.parentBuilder.addEdit(this.objectGroup.start + 1, this.objectGroup.end - 1, ''); // Remove content
		} else if (propertyIndex === 0) {
			const nextPropertyStart = properties[1].start;
			this.parentBuilder.addEdit(property.start, nextPropertyStart, '');
		} else {
			const prevPropertyEnd = properties[propertyIndex - 1].end;
			this.parentBuilder.addEdit(prevPropertyEnd, property.end, '');
		}
		return true;
	}

	public addPropertyAtIndex(index: number, propertyName: string, value: string): void {
		const properties = this.parseProperties();
		if (index < 0 || index > properties.length) {
			throw new Error(`Invalid index ${index}. Valid range is 0 to ${properties.length}`);
		}
		const contentStart = this.objectGroup.start + 1;
		const propertyText = `${propertyName}: ${value}`;
		if (properties.length === 0) {
			const newProperty = `\n  ${propertyText}\n`;
			this.parentBuilder.addEdit(contentStart, this.objectGroup.end - 1, newProperty);
		} else if (index === 0) {
			const firstProperty = properties[0];
			// Check if object content is on a single line or multiline for formatting
			const objContent = this.originalText.substring(contentStart, this.objectGroup.end - 1).trim();
			const isSingleLine = !objContent.includes('\n');
			const newProperty = isSingleLine ? `${propertyText}, ` : `\n  ${propertyText},\n  `;
			const insertionPoint = isSingleLine ? contentStart : firstProperty.start; // If single line, insert at very start of content.
			const existingContentToShift = isSingleLine ? this.originalText.substring(contentStart, firstProperty.start) : "";

			if (isSingleLine) {
				this.parentBuilder.addEdit(insertionPoint, insertionPoint, newProperty);
			} else {
				this.parentBuilder.addEdit(insertionPoint, insertionPoint, newProperty.substring(0, newProperty.length - (isSingleLine ? 0 : "  ".length))); // Avoid double indent if multiline
			}

		} else if (index === properties.length) {
			const lastProperty = properties[properties.length - 1];
			const newProperty = `,\n  ${propertyText}\n`;
			this.parentBuilder.addEdit(lastProperty.end, lastProperty.end, newProperty);
		} else {
			const prevProperty = properties[index - 1];
			const newProperty = `,\n  ${propertyText}`;
			this.parentBuilder.addEdit(prevProperty.end, prevProperty.end, newProperty);
		}
	}

	public addPropertyAfterItem(itemName: string, newPropertyName: string, value: string): void {
		const properties = this.parseProperties();
		const propertyIndex = properties.findIndex(p => p.name === itemName);
		if (propertyIndex === -1) throw new Error(`Property "${itemName}" not found`);
		const property = properties[propertyIndex];
		const isLast = propertyIndex === properties.length - 1;
		const newProperty = isLast ? `,\n  ${newPropertyName}: ${value}\n` : `,\n  ${newPropertyName}: ${value}`;
		this.parentBuilder.addEdit(property.end, property.end, newProperty);
	}

	public addObjectAtIndex(index: number, propertyName: string, value: string): void {
		this.addPropertyAtIndex(index, propertyName, value);
	}
	public addObjectAfterItem(itemName: string, newPropertyName: string, value: string): void {
		this.addPropertyAfterItem(itemName, newPropertyName, value);
	}
	public addArrayAtIndex(index: number, propertyName: string, value: string): void {
		this.addPropertyAtIndex(index, propertyName, value);
	}
	public addArrayAfterItem(itemName: string, newPropertyName: string, value: string): void {
		this.addPropertyAfterItem(itemName, newPropertyName, value);
	}

	public findArray(
		propertyName: string,
		options: {
			onFound: (arrayBuilder: TypeScriptArrayBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		const property = this.findPropertyByName(propertyName);
		if (!property) { options.onNotFound?.(); return; }
		const value = this.originalText.substring(property.valueStart, property.valueEnd).trim();
		if (!value.startsWith('[') || !value.endsWith(']')) {
			options.onNotFound?.(); return;
		}
		const arrayGroup: TokenGroup = {
			type: 'ArrayLiteral', start: property.valueStart, end: property.valueEnd,
			tokens: [], children: [], metadata: {}
		};
		const arrayBuilder = new TypeScriptArrayBuilder(this.parentBuilder, arrayGroup, this.originalText);
		options.onFound(arrayBuilder);
	}

	public findObject(
		propertyName: string,
		options: {
			onFound: (objectBuilder: TypeScriptObjectBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		const property = this.findPropertyByName(propertyName);
		if (!property) { options.onNotFound?.(); return; }
		const value = this.originalText.substring(property.valueStart, property.valueEnd).trim();
		if (!value.startsWith('{') || !value.endsWith('}')) {
			options.onNotFound?.(); return;
		}
		const objectGroup: TokenGroup = {
			type: 'ObjectLiteral', start: property.valueStart, end: property.valueEnd,
			tokens: [], children: [], metadata: {}
		};
		const objectBuilder = new TypeScriptObjectBuilder(this.parentBuilder, objectGroup, this.originalText);
		options.onFound(objectBuilder);
	}

	public getContentText(): string {
		return this.originalText.substring(this.objectGroup.start + 1, this.objectGroup.end - 1);
	}
	public getFullText(): string {
		return this.originalText.substring(this.objectGroup.start, this.objectGroup.end);
	}

	private parseProperties(): Array<{ name: string; nameStart: number; nameEnd: number; valueStart: number; valueEnd: number; start: number; end: number; }> {
		const contentStart = this.objectGroup.start + 1;
		const contentEnd = this.objectGroup.end - 1;
		if (contentStart >= contentEnd) return [];
		const content = this.originalText.substring(contentStart, contentEnd);
		const properties: Array<{ name: string; nameStart: number; nameEnd: number; valueStart: number; valueEnd: number; start: number; end: number; }> = [];
		let pos = 0; let inString = false; let stringChar = '';
		let inLineComment = false; let inBlockComment = false;
		let braceDepth = 0; let bracketDepth = 0; let parenDepth = 0;
		let propertyFullStart = -1; let nameStart = -1; let nameEnd = -1; let colonPos = -1;

		while (pos < content.length) {
			const char = content[pos];
			const nextChar = pos + 1 < content.length ? content[pos + 1] : '';
			const prevChar = pos > 0 ? content[pos - 1] : '';

			// Handle comments
			if (inLineComment) {
				if (char === '\n') {
					inLineComment = false;
				}
				pos++;
				continue;
			}
			if (inBlockComment) {
				if (char === '*' && nextChar === '/') {
					inBlockComment = false;
					pos += 2; // Skip '*/'
					continue;
				}
				pos++;
				continue;
			}

			// Check for comment start (only if not in string)
			if (!inString) {
				if (char === '/' && nextChar === '/') {
					inLineComment = true;
					pos += 2; // Skip '//'
					continue;
				}
				if (char === '/' && nextChar === '*') {
					inBlockComment = true;
					pos += 2; // Skip '/*'
					continue;
				}
			}

			// Only start tracking property if we're not in comments and find non-whitespace/comma
			if (propertyFullStart === -1 && !/\s|,/.test(char)) propertyFullStart = pos;
			
			// Handle strings
			if ((char === '"' || char === "'") && prevChar !== '\\') {
				if (!inString) { 
					inString = true; 
					stringChar = char; 
				} else if (char === stringChar) { 
					inString = false; 
				}
			}
			
			if (inString) { 
				pos++; 
				continue; 
			}
			
			// Track nested structures
			if (char === '{') braceDepth++; else if (char === '}') braceDepth--;
			if (char === '[') bracketDepth++; else if (char === ']') bracketDepth--;
			if (char === '(') parenDepth++; else if (char === ')') parenDepth--;
			
			// Track property name bounds
			if (nameStart === -1 && propertyFullStart !== -1 && !/\s/.test(char)) nameStart = pos;
			if (nameStart !== -1 && nameEnd === -1 && char === ':') { nameEnd = pos; colonPos = pos; }
			
			// Check for property end (comma or end of content at depth 0)
			if (propertyFullStart !== -1 && colonPos !== -1 && (char === ',' || pos === content.length - 1) && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
				const propertyFullEnd = (char === ',' ? pos : pos + 1);
				const nameText = content.substring(nameStart, nameEnd).trim();
				const name = this.trimQuotes(nameText);
				let valueStartLocal = colonPos + 1;
				while (valueStartLocal < propertyFullEnd && /\s/.test(content[valueStartLocal])) valueStartLocal++;
				let valueEndLocal = propertyFullEnd;
				while (valueEndLocal > valueStartLocal && (/\s/.test(content[valueEndLocal - 1]) || content[valueEndLocal - 1] === ',')) valueEndLocal--;

				properties.push({
					name, nameStart: contentStart + nameStart, nameEnd: contentStart + nameEnd,
					valueStart: contentStart + valueStartLocal, valueEnd: contentStart + valueEndLocal,
					start: contentStart + propertyFullStart, end: contentStart + propertyFullEnd
				});
				propertyFullStart = -1; nameStart = -1; nameEnd = -1; colonPos = -1;
			}
			pos++;
		}
		return properties;
	}
	private findPropertyByName(propertyName: string): { name: string; nameStart: number; nameEnd: number; valueStart: number; valueEnd: number; start: number; end: number; } | null {
		return this.parseProperties().find(prop => prop.name === propertyName) || null;
	}
	private isWhitespace(char: string): boolean { return /\s/.test(char); }
	private trimQuotes(text: string): string {
		text = text.trim();
		if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
			return text.substring(1, text.length - 1);
		}
		return text;
	}
}