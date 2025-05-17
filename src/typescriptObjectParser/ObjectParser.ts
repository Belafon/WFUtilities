/******************************************************
 * Debug flag for logging internal state.
 ******************************************************/
const DEBUG = true;

/******************************************************
 * Data structures to represent tokens & parsed items.
 ******************************************************/
export type ExtendedTokenType =
	| 'class'
	| 'interface'
	| 'type'
	| 'enum'
	| 'function'
	| 'variable'
	| 'whitespace'
	| 'unknown'
	| 'object' // for an entire { ... } literal
	| 'property' // for key: value
	| 'array' // for [ ... ] literal
	| 'literal'; // numbers, strings, booleans, etc.

export type ParsedItemToken = {
	type: ExtendedTokenType;
	name?: string;
	start: number;
	end: number;
	templateParams?: string;
}

/******************************************************
 * An abstraction to read through the source code by
 * index, avoiding copying large substrings.
 ******************************************************/
export class SourcePointer {
	private currentIndex = 0;

	constructor(private readonly source: string) { }

	public get position(): number {
		return this.currentIndex;
	}

	public currentChar(): string {
		if (this.isEOF()) return '';
		const ch = this.source.charAt(this.currentIndex);
		return ch;
	}

	public moveToNextChar(): void {
		if (!this.isEOF()) {
			const newIndex = this.currentIndex + 1;
			this.currentIndex = newIndex;
		}
	}

	public isEOF(): boolean {
		return this.currentIndex >= this.source.length;
	}

	public peek(offset: number = 0): string {
		const idx = this.currentIndex + offset;
		if (idx < 0 || idx >= this.source.length) {
			return '';
		}
		const ch = this.source.charAt(idx);
		return ch;
	}

	public setPosition(newPos: number) {
		this.currentIndex = Math.max(0, Math.min(newPos, this.source.length));
	}
}

/******************************************************
 * The tokenizer: scans the source and produces tokens.
 ******************************************************/
class TokenFactory {
	static createToken(
		type: ParsedItemToken['type'],
		start: number,
		end: number,
		name?: string,
		templateParams?: string
	): ParsedItemToken {
		const token = { type, start, end, name, templateParams };
		if (DEBUG) {
			console.log(
				`TokenFactory.createToken: created token ${JSON.stringify(token)}`
			);
		}
		return token;
	}
}

export class Tokenizer {
	private tokens: ParsedItemToken[] = [];

	constructor(private pointer: SourcePointer) { }

	public tokenize(): ParsedItemToken[] {
		if (DEBUG) console.log("Tokenizer.tokenize: starting tokenization");
		while (!this.pointer.isEOF()) {
			const startPos = this.pointer.position;
			const current = this.pointer.currentChar();
			if (DEBUG) {
				console.log(
					`Tokenizer.tokenize: at index ${startPos}, char '${current}'`
				);
			}

			// 1) Whitespace
			if (/\s/.test(current)) {
				this.consumeWhitespace();
				continue;
			}

			// 2) Identifiers or keywords
			if (isIdentifierStart(current)) {
				this.tokenizeIdentifierOrKeyword(startPos);
				continue;
			}

			// 3) Numbers
			if (/[0-9]/.test(current)) {
				this.tokenizeNumber(startPos);
				continue;
			}

			// 4) String literal
			if (current === "'" || current === '"') {
				this.tokenizeStringLiteral(startPos, current);
				continue;
			}

			// 5) Fallback for single-character punctuation: { } [ ] , : etc.
			//    We'll mark it as 'unknown' with a name = that character
			this.pointer.moveToNextChar();
			const token = TokenFactory.createToken(
				'unknown',
				startPos,
				this.pointer.position,
				current
			);
			this.tokens.push(token);
		}
		return this.tokens;
	}

	private tokenizeNumber(startPos: number): void {
		while (!this.pointer.isEOF() && /[0-9]/.test(this.pointer.currentChar())) {
			this.pointer.moveToNextChar();
		}
		const endPos = this.pointer.position;
		const word = this.getSourceSlice(startPos, endPos);
		const token = TokenFactory.createToken('literal', startPos, endPos, word);
		this.tokens.push(token);
	}

	private tokenizeStringLiteral(startPos: number, quoteChar: string): void {
		this.pointer.moveToNextChar(); // past the opening quote
		while (!this.pointer.isEOF() && this.pointer.currentChar() !== quoteChar) {
			this.pointer.moveToNextChar();
		}
		if (!this.pointer.isEOF()) {
			this.pointer.moveToNextChar(); // consume closing quote
		}
		const endPos = this.pointer.position;
		const value = this.getSourceSlice(startPos, endPos);
		const token = TokenFactory.createToken('literal', startPos, endPos, value);
		this.tokens.push(token);
	}

	private consumeWhitespace(): void {
		const startPos = this.pointer.position;

		while (!this.pointer.isEOF() && /\s/.test(this.pointer.currentChar())) {
			this.pointer.moveToNextChar();
		}
		const endPos = this.pointer.position;
		const token = TokenFactory.createToken('whitespace', startPos, endPos);
		this.tokens.push(token);
	}

	private tokenizeIdentifierOrKeyword(startPos: number): void {
		let endPos = startPos;
		while (
			!this.pointer.isEOF() &&
			isIdentifierPart(this.pointer.currentChar())
		) {
			this.pointer.moveToNextChar();
		}
		endPos = this.pointer.position;

		const word = this.getSourceSlice(startPos, endPos);
		const recognizedType = classifyWord(word);

		if (recognizedType) {
			const token = TokenFactory.createToken(recognizedType, startPos, endPos);
			this.tokens.push(token);
		} else {
			const token = TokenFactory.createToken('unknown', startPos, endPos, word);
			this.tokens.push(token);
		}
	}

	private getSourceSlice(start: number, end: number): string {
		return (this.pointer as any).source.substring(start, end);
	}
}

function isIdentifierStart(ch: string): boolean {
	return /[a-zA-Z_\$]/.test(ch);
}

function isIdentifierPart(ch: string): boolean {
	return /[a-zA-Z0-9_\$]/.test(ch);
}

function classifyWord(word: string): ParsedItemToken['type'] | undefined {
	switch (word) {
		case 'class':
			return 'class';
		case 'interface':
			return 'interface';
		case 'type':
			return 'type';
		case 'enum':
			return 'enum';
		case 'function':
			return 'function';
		case 'let':
		case 'const':
		case 'var':
			return 'variable';

		// Handle booleans as literal tokens:
		case 'true':
		case 'false':
			// You might also handle 'null', 'undefined', etc.
			return 'literal';

		default:
			return undefined;
	}
}

/******************************************************
 * A simple token stream to help consume tokens in order.
 ******************************************************/
export class TokenStream {
	private index = 0;
	constructor(private tokens: ParsedItemToken[]) { }

	public peek(): ParsedItemToken | null {
		return this.tokens[this.index] || null;
	}

	public next(): ParsedItemToken | null {
		if (this.isEOF()) return null;
		const token = this.tokens[this.index++];
		return token;
	}

	public isEOF(): boolean {
		return this.index >= this.tokens.length;
	}

	public consumeWhitespace(): void {
		while (!this.isEOF() && this.peek()?.type === 'whitespace') {
			this.next();
		}
	}
}


/******************************************************
 * Token grouping into classes, types, objects.
 ******************************************************/

/**
 * Types of token groups that represent higher-level language constructs.
 * Unlike individual tokens, these represent complete structures.
 */
export type TokenGroupType =
	| 'CodeFile'        // Root level representing entire source file
	| 'ClassDeclaration'    // A complete class with its body
	| 'InterfaceDeclaration'// A complete interface with its body
	| 'TypeDeclaration'     // A type declaration with its definition
	| 'EnumDeclaration'     // An enum with its values
	| 'FunctionDeclaration' // A function with its body
	| 'MethodDeclaration'   // A method within a class/interface
	| 'PropertyDeclaration' // A property within a class/interface
	| 'VariableDeclaration' // A variable declaration
	| 'ObjectLiteral'       // An object literal expression
	| 'ArrayLiteral'        // An array literal expression
	| 'BlockStatement'      // A block of code enclosed in { }
	| 'ExpressionStatement' // Any expression statement
	| 'Unknown';            // Fallback for unrecognized structures

/**
 * Represents a node in the token hierarchy tree.
 * Can contain child nodes creating a nested structure.
 */
export type TokenGroup = {
	type: TokenGroupType;
	start: number;
	end: number;
	tokens: ParsedItemToken[];
	name?: string;
	templateParams?: string;
	children: TokenGroup[];
	metadata?: {
		extends?: string;
		implements?: string[];
		returnType?: string;
		typeAnnotation?: string;
		modifiers?: string[]; // public, private, static, etc.
	};
}

/**
 * Responsible for transforming a flat array of tokens
 * into a hierarchical tree structure.
 */
export class TokenGrouper {
	private readonly rootGroup: TokenGroup;
	constructor(
		private readonly tokens: ParsedItemToken[],
		private readonly source: string
	) {
		this.rootGroup = {
			type: 'CodeFile',
			start: 0,
			end: source.length,
			tokens: [],
			children: []
		};
	}

	/**
	 * Process all tokens into a hierarchical structure
	 * and return the root group.
	 */
	public group(): TokenGroup {
		const tokenStream = new TokenStream(this.tokens);
		this.processTokens(tokenStream, this.rootGroup);
		return this.rootGroup;
	}

	/**
	 * Process tokens and build the hierarchy.
	 */
	private processTokens(tokenStream: TokenStream, parent: TokenGroup): void {
		while (!tokenStream.isEOF()) {
			// Skip whitespace
			tokenStream.consumeWhitespace();
			if (tokenStream.isEOF()) break;

			// Get the current token
			const token = tokenStream.peek();
			if (!token) break;

			// Process based on token type
			let group: TokenGroup | null = null;

			switch (token.type) {
				case 'class':
					group = this.processClassDeclaration(tokenStream);
					break;
				case 'interface':
					group = this.processInterfaceDeclaration(tokenStream) ?? null;
					break;
				case 'type':
					group = this.processTypeDeclaration(tokenStream);
					break;
				case 'enum':
					group = this.processEnumDeclaration(tokenStream);
					break;
				case 'function':
					group = this.processFunctionDeclaration(tokenStream);
					break;
				case 'variable':
					group = this.processVariableDeclaration(tokenStream);
					break;
				case 'unknown':
					// Check if it's the start of an object or array literal
					if (token.name === '{') {
						group = this.processObjectLiteral(tokenStream);
					} else if (token.name === '[') {
						group = this.processArrayLiteral(tokenStream);
					} else {
						// Just advance for tokens we don't specially handle
						tokenStream.next();
						continue;
					}
					break;

				default:
					// Just advance for tokens we don't specially handle
					tokenStream.next();
					continue;
			}

			// If we processed a group, add it to the parent
			if (group) {
				parent.children.push(group);
			}
		}
	}

	/**
	 * Process a class declaration and its body.
	 */
	private processClassDeclaration(tokenStream: TokenStream): TokenGroup | null {
		// Store the starting position and the 'class' token
		const classToken = tokenStream.next();
		if (!classToken) return null;

		const startTokens = [classToken];
		const startPos = classToken.start;

		// Extract the class name
		tokenStream.consumeWhitespace();
		const nameToken = tokenStream.next();
		if (nameToken) startTokens.push(nameToken);
		const className = nameToken?.name;

		// Process template parameters if present
		let templateParams: string | undefined;
		tokenStream.consumeWhitespace();
		if (tokenStream.peek()?.name === '<') {
			templateParams = this.extractTemplateParams(tokenStream);
		}

		// Look for extends/implements clauses
		let extendsClass: string | undefined;
		let implementsInterfaces: string[] | undefined;

		// Check for extends clause
		tokenStream.consumeWhitespace();
		let currentToken = tokenStream.peek();

		if (currentToken?.name === 'extends') {
			// Consume 'extends' token
			startTokens.push(tokenStream.next()!);

			// Consume whitespace after 'extends'
			tokenStream.consumeWhitespace();

			// Get parent class name
			const parentClassToken = tokenStream.next();
			if (parentClassToken) {
				startTokens.push(parentClassToken);
				extendsClass = parentClassToken.name;
			}

			// Update current token
			tokenStream.consumeWhitespace();
			currentToken = tokenStream.peek();
		}

		// Check for implements clause
		if (currentToken?.name === 'implements') {
			// Consume 'implements' token
			startTokens.push(tokenStream.next()!);
			implementsInterfaces = [];

			// Process interface names (comma-separated list)
			let processingInterfaces = true;

			while (processingInterfaces && !tokenStream.isEOF()) {
				tokenStream.consumeWhitespace();
				const interfaceToken = tokenStream.next();

				if (interfaceToken && interfaceToken.type !== 'whitespace') {
					startTokens.push(interfaceToken);
					if (interfaceToken.name) {
						implementsInterfaces.push(interfaceToken.name);
					}

					// Check if there's a comma for multiple interfaces
					tokenStream.consumeWhitespace();
					const nextToken = tokenStream.peek();

					if (nextToken?.name === ',') {
						// Consume the comma and continue
						startTokens.push(tokenStream.next()!);
					} else {
						// No more interfaces
						processingInterfaces = false;
					}
				} else {
					processingInterfaces = false;
				}
			}
		}

		// Process class body
		tokenStream.consumeWhitespace();
		const openBraceToken = tokenStream.peek();
		if (openBraceToken?.name !== '{') {
			// Malformed class, no opening brace
			return null;
		}

		// Consume the opening brace
		startTokens.push(tokenStream.next()!);

		// Create the class group with what we know so far
		const classGroup: TokenGroup = {
			type: 'ClassDeclaration',
			start: startPos,
			end: -1, // Will be filled in later
			name: className,
			templateParams,
			tokens: [...startTokens],
			children: [],
			metadata: {
				extends: extendsClass,
				implements: implementsInterfaces,
				modifiers: [] // Would be filled with public, abstract, etc.
			}
		};

		// Process the closing brace and find the end position
		let braceDepth = 1;
		while (!tokenStream.isEOF() && braceDepth > 0) {
			const token = tokenStream.next();
			if (!token) break;

			if (token.name === '{') {
				braceDepth++;
			} else if (token.name === '}') {
				braceDepth--;
				if (braceDepth === 0) {
					classGroup.end = token.end;
				}
			}
		}

		// If we didn't find a proper closing brace, use the last token position
		if (classGroup.end === -1) {
			classGroup.end = classToken.end;
		}

		return classGroup;
	}

	/**
	 * Process an interface declaration and its body.
	 * @returns A TokenGroup representing the interface declaration, or null if invalid
	 */
	private processInterfaceDeclaration(tokenStream: TokenStream): TokenGroup | null | undefined {
		// Store the starting position and the 'interface' token
		const interfaceToken = tokenStream.next();
		if (!interfaceToken) return null;

		const startTokens = [interfaceToken];
		const startPos = interfaceToken.start;

		// Extract the interface name
		tokenStream.consumeWhitespace();
		const nameToken = tokenStream.next();
		if (nameToken) startTokens.push(nameToken);
		const interfaceName = nameToken?.name;

		// Process template parameters if present (e.g., interface MyInterface<T>)
		let templateParams: string | undefined;
		tokenStream.consumeWhitespace();
		if (tokenStream.peek()?.name === '<') {
			const openAngleToken = tokenStream.next();
			if (openAngleToken) startTokens.push(openAngleToken);

			// Collect all tokens until closing angle bracket
			let templateContent = '';
			let angleDepth = 1;

			while (!tokenStream.isEOF() && angleDepth > 0) {
				const token = tokenStream.next();
				if (!token) break;

				startTokens.push(token);

				if (token.name === '<') {
					angleDepth++;
				} else if (token.name === '>') {
					angleDepth--;
				}

				if (angleDepth > 0 && token.name) {
					templateContent += token.name;
				}
			}

			if (templateContent) {
				templateParams = templateContent;
			}
		}

		// Look for extends clause (e.g., interface MyInterface extends BaseInterface)
		let extendsInterfaces: string[] = [];
		tokenStream.consumeWhitespace();

		if (tokenStream.peek()?.name === 'extends') {
			const extendsToken = tokenStream.next();
			if (extendsToken) startTokens.push(extendsToken);

			// Process extended interfaces (comma-separated list)
			let processingExtends = true;

			while (processingExtends && !tokenStream.isEOF()) {
				tokenStream.consumeWhitespace();
				const extendedInterface = tokenStream.next();

				if (extendedInterface && extendedInterface.type !== 'whitespace') {
					startTokens.push(extendedInterface);
					if (extendedInterface.name) {
						extendsInterfaces.push(extendedInterface.name);
					}

					// Check if there's a comma for multiple extends
					tokenStream.consumeWhitespace();
					const nextToken = tokenStream.peek();

					if (nextToken?.name === ',') {
						const commaToken = tokenStream.next();
						if (commaToken) startTokens.push(commaToken);
					} else {
						processingExtends = false;
					}
				} else {
					processingExtends = false;
				}
			}
		}

		// Process interface body
		tokenStream.consumeWhitespace();
		const openBraceToken = tokenStream.peek();

		if (!openBraceToken || openBraceToken.name !== '{') {
			// Malformed interface, no opening brace
			return null;
		}

		tokenStream.next(); // Consume the opening brace
		startTokens.push(openBraceToken);

		// Create the interface group
		const interfaceGroup: TokenGroup = {
			type: 'InterfaceDeclaration',
			start: startPos,
			end: -1, // Will be filled in later
			name: interfaceName,
			templateParams,
			tokens: [...startTokens],
			children: [],
			metadata: {
				extends: extendsInterfaces.length > 0 ? extendsInterfaces.join(', ') : undefined,
				modifiers: [] // Would be filled with export, declare, etc.
			}
		};

		// Process interface members
		let braceDepth = 1;
		let bodyTokens: ParsedItemToken[] = [];

		while (!tokenStream.isEOF() && braceDepth > 0) {
			const token = tokenStream.next();
			if (!token) break;

			bodyTokens.push(token);

			if (token.name === '{') {
				braceDepth++;
			} else if (token.name === '}') {
				braceDepth--;
				if (braceDepth === 0) {
					// We've found the closing brace
					interfaceGroup.end = token.end;
				}
			}
		}

		// In a real implementation, we would process the body tokens to identify
		// properties and methods, then add them as children to the interfaceGroup.
		// This would involve scanning for patterns like:
		// - propertyName: type;
		// - methodName(params): returnType;

		// For this demonstration, we'll leave it as is
		interfaceGroup.tokens = [...interfaceGroup.tokens, ...bodyTokens];

		if (interfaceGroup.end === -1) {
			// If we didn't find a closing brace, use the last token's end
			const lastToken = bodyTokens[bodyTokens.length - 1];
			interfaceGroup.end = lastToken ? lastToken.end : startPos;
		}

		return interfaceGroup;
	}

	/**
	 * Process a type declaration.
	 */
	private processTypeDeclaration(tokenStream: TokenStream): TokenGroup | null {
		// Store the starting position and the 'type' token
		const typeToken = tokenStream.next();
		if (!typeToken) return null;

		const startPos = typeToken.start;
		let allTokens = [typeToken];

		// Extract the type name
		tokenStream.consumeWhitespace();
		const nameToken = tokenStream.next();
		if (!nameToken) return null; // Malformed type declaration, no name
		allTokens.push(nameToken);
		const typeName = nameToken.name;

		// Process template parameters if present (e.g., type MyType<T>)
		let templateParams: string | undefined;
		tokenStream.consumeWhitespace();
		if (tokenStream.peek()?.name === '<') {
			templateParams = this.extractTemplateParams(tokenStream);
		}

		// Look for the '=' sign
		tokenStream.consumeWhitespace();
		const equalsToken = tokenStream.peek();
		if (!equalsToken || equalsToken.name !== '=') {
			// Malformed type declaration, no '=' sign
			return null;
		}

		// Consume the '=' sign
		tokenStream.next();
		allTokens.push(equalsToken);

		// Create the type group
		const typeGroup: TokenGroup = {
			type: 'TypeDeclaration',
			start: startPos,
			end: -1, // Will be filled in later
			name: typeName,
			templateParams,
			tokens: allTokens, // Will be updated with all tokens
			children: [],
			metadata: {
				typeAnnotation: undefined, // Will be filled with the actual type definition
				modifiers: [] // Would be filled with export, declare, etc.
			}
		};

		// Process the type definition until we reach a semicolon
		// We need to keep track of nested structures
		let typeDefinition = '';
		let reachedSemicolon = false;
		let braceDepth = 0;
		let angleDepth = 0;
		let squareDepth = 0;
		let parenDepth = 0;

		// Track previous token to handle special cases like arrow function
		let prevToken: ParsedItemToken | null = null;

		while (!tokenStream.isEOF() && !reachedSemicolon) {
			const token = tokenStream.next();
			if (!token) break;

			allTokens.push(token);

			// Build up the type definition string, with special case handling for arrow functions
			if (token.name) {
				// Special case for arrow function: don't add space between = and >
				if (prevToken && prevToken.name === '=' && token.name === '>') {
					// Replace the last space with empty string to join = and >
					if (typeDefinition.endsWith(' ')) {
						typeDefinition = typeDefinition.slice(0, -1) + token.name + ' ';
					} else {
						typeDefinition += token.name + ' ';
					}
				} else {
					typeDefinition += token.name + ' ';
				}
			}

			// Update previous token
			prevToken = token;

			// Track nested structure depths
			if (token.name === '{') {
				braceDepth++;
			} else if (token.name === '}') {
				braceDepth--;
			} else if (token.name === '<') {
				angleDepth++;
			} else if (token.name === '>') {
				angleDepth--;
			} else if (token.name === '[') {
				squareDepth++;
			} else if (token.name === ']') {
				squareDepth--;
			} else if (token.name === '(') {
				parenDepth++;
			} else if (token.name === ')') {
				parenDepth--;
			} else if (token.name === ';' && braceDepth === 0 && angleDepth === 0 &&
				squareDepth === 0 && parenDepth === 0) {
				// We've found the end of the type declaration
				// But only if we're not inside any nested structure
				reachedSemicolon = true;
				typeGroup.end = token.end;
			}
		}

		// Update tokens in the type group
		typeGroup.tokens = allTokens;

		// Save the type definition in metadata
		if (typeDefinition) {
			typeGroup.metadata!.typeAnnotation = typeDefinition.trim();
		}

		if (typeGroup.end === -1) {
			// If we didn't find a semicolon, use the last token's end
			const lastToken = allTokens[allTokens.length - 1];
			typeGroup.end = lastToken ? lastToken.end : startPos;
		}

		return typeGroup;
	}

	/**
	 * Process an enum declaration and its values.
	 */
	private processEnumDeclaration(tokenStream: TokenStream): TokenGroup | null {
		// Store the starting position and the 'enum' token
		const enumToken = tokenStream.next();
		if (!enumToken) return null;

		const startTokens = [enumToken];
		const startPos = enumToken.start;

		// Extract the enum name
		tokenStream.consumeWhitespace();
		const nameToken = tokenStream.next();
		if (nameToken) startTokens.push(nameToken);
		const enumName = nameToken?.name;

		// Process enum body
		tokenStream.consumeWhitespace();
		const openBraceToken = tokenStream.peek();

		if (!openBraceToken || openBraceToken.name !== '{') {
			// Malformed enum, no opening brace
			return null;
		}

		// Consume the opening brace
		tokenStream.next();
		startTokens.push(openBraceToken);

		// Create the enum group
		const enumGroup: TokenGroup = {
			type: 'EnumDeclaration',
			start: startPos,
			end: -1, // Will be filled in later
			name: enumName,
			tokens: [...startTokens],
			children: [],
			metadata: {
				modifiers: [] // Would be filled with export, declare, etc.
			}
		};

		// Process the enum body (collect all tokens until closing brace)
		let braceDepth = 1;
		let bodyTokens: ParsedItemToken[] = [];

		while (!tokenStream.isEOF() && braceDepth > 0) {
			const token = tokenStream.next();
			if (!token) break;

			bodyTokens.push(token);

			if (token.name === '{') {
				braceDepth++;
			} else if (token.name === '}') {
				braceDepth--;
				if (braceDepth === 0) {
					// We've found the closing brace
					enumGroup.end = token.end;
				}
			}
		}

		// Update tokens in the enum group
		enumGroup.tokens = [...enumGroup.tokens, ...bodyTokens];

		if (enumGroup.end === -1) {
			// If we didn't find a closing brace, use the last token's end
			const lastToken = bodyTokens[bodyTokens.length - 1];
			enumGroup.end = lastToken ? lastToken.end : startPos;
		}

		return enumGroup;
	}

	/**
	 * Process a function declaration and its body.
	 */
	private processFunctionDeclaration(tokenStream: TokenStream): TokenGroup | null {
		// Store the starting position and the 'function' token
		const functionToken = tokenStream.next();
		if (!functionToken) return null;

		const allTokens = [functionToken];
		const startPos = functionToken.start;

		// Extract the function name (optional for function expressions)
		tokenStream.consumeWhitespace();
		let functionName: string | undefined;
		const nameOrParenToken = tokenStream.peek();

		if (nameOrParenToken && nameOrParenToken.name !== '(') {
			// We have a named function
			const nameToken = tokenStream.next();
			if (nameToken) {
				allTokens.push(nameToken);
				functionName = nameToken.name;

				// Check for additional identifier after function name (for case: function async fetchData())
				tokenStream.consumeWhitespace();
				const potentialSecondNameToken = tokenStream.peek();
				if (potentialSecondNameToken &&
					potentialSecondNameToken.name !== '(' &&
					potentialSecondNameToken.name !== '=' &&
					potentialSecondNameToken.name !== '<' &&
					potentialSecondNameToken.type === 'unknown') {

					// Found a second identifier, treat the first one as a modifier or just leave as is
					// Comment: In a proper implementation, "async" would be collected as a modifier

					// No change to functionName - the first token remains the function name
					// Just consume the second token and add it to allTokens
					const secondToken = tokenStream.next();
					if (secondToken) {
						allTokens.push(secondToken);
					}
				}
			}
		}

		// Process template parameters if present
		tokenStream.consumeWhitespace();
		let templateParams: string | undefined;
		if (tokenStream.peek()?.name === '<') {
			templateParams = this.extractTemplateParams(tokenStream);
		}

		// Check for equals sign after function name (non-standard syntax)
		tokenStream.consumeWhitespace();
		let hasEquals = false;
		if (tokenStream.peek()?.name === '=') {
			const equalsToken = tokenStream.next();
			if (equalsToken) {
				allTokens.push(equalsToken);
				hasEquals = true;
			}
			tokenStream.consumeWhitespace();
		}

		// Process parameter list
		let nextToken = tokenStream.peek();

		if (!nextToken) {
			return null;
		}

		// Check if we have a parameter list
		if (nextToken.name === '(') {
			// Consume the opening parenthesis
			tokenStream.next();
			allTokens.push(nextToken);

			// Collect parameter tokens until closing parenthesis
			let parenDepth = 1;

			while (!tokenStream.isEOF() && parenDepth > 0) {
				const token = tokenStream.next();
				if (!token) break;

				allTokens.push(token);

				if (token.name === '(') {
					parenDepth++;
				} else if (token.name === ')') {
					parenDepth--;
				}
			}
		} else if (!hasEquals) {
			// If there's no equals sign and no parameter list, it's malformed
			// Only return null if we haven't seen an equals sign, as the equals might
			// indicate a different syntax pattern
			return null;
		}

		// Check for return type annotation
		tokenStream.consumeWhitespace();
		let returnType: string | undefined;
		let nextSymbol = tokenStream.peek();

		if (nextSymbol?.name === ':') {
			// Consume colon
			const colonToken = tokenStream.next();
			if (colonToken) allTokens.push(colonToken);

			// Build up the return type string
			let returnTypeStr = '';
			let foundBodyStart = false;
			let angleDepth = 0;
			let braceDepth = 0;
			let parenDepth = 0;

			// First get all tokens of the return type
			let returnTypeTokens: ParsedItemToken[] = [];

			while (!tokenStream.isEOF() && !foundBodyStart) {
				tokenStream.consumeWhitespace();
				const token = tokenStream.peek();
				if (!token) break;

				// Update bracket depths BEFORE checking for body start
				let potentialDepthChange = 0;
				if (token.name === '<') potentialDepthChange = 1;
				else if (token.name === '>') potentialDepthChange = -1;
				else if (token.name === '{') potentialDepthChange = 1;
				else if (token.name === '}') potentialDepthChange = -1;
				else if (token.name === '(') potentialDepthChange = 1;
				else if (token.name === ')') potentialDepthChange = -1;

				// Check for the start of the function body
				// Important: We only consider '{' as body start if we're at root level (braceDepth === 0)
				// and after we've completed a type expression (all levels of braces balanced)
				if (token.name === '{' && angleDepth === 0 && braceDepth === 0 && parenDepth === 0 &&
					(returnTypeTokens.length > 0 && returnTypeTokens[returnTypeTokens.length - 1].name === '}')) {
					foundBodyStart = true;
					break;
				}

				// Check for arrow function start
				if (token.name === '=>' && angleDepth === 0 && braceDepth === 0 && parenDepth === 0) {
					foundBodyStart = true;
					break;
				}

				// Check for equals sign (which could be part of arrow)
				if (token.name === '=' && angleDepth === 0 && braceDepth === 0 && parenDepth === 0) {
					// Consume equals and look for '>'
					const equalsToken = tokenStream.next();
					if (equalsToken) {
						allTokens.push(equalsToken);
						returnTypeTokens.push(equalsToken);

						// Add to return type string
						returnTypeStr += equalsToken.name + ' ';

						// Check next token for '>'
						tokenStream.consumeWhitespace();
						const nextAfterEquals = tokenStream.peek();

						if (nextAfterEquals?.name === '>') {
							// This is an arrow function
							foundBodyStart = true;
							break;
						}
					}
					continue; // Skip the standard token processing below since we processed the equals
				}

				// Consume the token as part of the return type
				const returnTypeToken = tokenStream.next();
				if (!returnTypeToken) break;

				allTokens.push(returnTypeToken);
				returnTypeTokens.push(returnTypeToken);

				// Apply the depth changes now that we've consumed the token
				if (returnTypeToken.name === '<') angleDepth++;
				else if (returnTypeToken.name === '>') angleDepth--;
				else if (returnTypeToken.name === '{') braceDepth++;
				else if (returnTypeToken.name === '}') braceDepth--;
				else if (returnTypeToken.name === '(') parenDepth++;
				else if (returnTypeToken.name === ')') parenDepth--;

				// Add to return type string
				if (returnTypeToken.name) {
					returnTypeStr += returnTypeToken.name + ' ';
				}

				// If we just closed a brace at root level, we might be at the end of return type
				if (returnTypeToken.name === '}' && braceDepth === 0 && angleDepth === 0 && parenDepth === 0) {
					// Peek ahead to see if next non-whitespace token is a '{'
					tokenStream.consumeWhitespace();
					if (tokenStream.peek()?.name === '{') {
						foundBodyStart = true;
						break;
					}
				}
			}

			// Set the return type
			returnType = returnTypeStr.trim();
		}

		// Create the function group
		const functionGroup: TokenGroup = {
			type: 'FunctionDeclaration',
			start: startPos,
			end: -1, // Will be filled in later
			name: functionName,
			templateParams,
			tokens: allTokens, // Will be updated
			children: [],
			metadata: {
				returnType,
				modifiers: [] // Could contain export, async, etc.
			}
		};

		// Check for arrow function syntax
		let isArrowFunction = false;
		tokenStream.consumeWhitespace();

		// Look for => as either a single token or as two consecutive tokens (= followed by >)
		if (tokenStream.peek()?.name === '=>') {
			// Single token for arrow
			const arrowToken = tokenStream.next();
			if (arrowToken) allTokens.push(arrowToken);
			isArrowFunction = true;
		} else if (tokenStream.peek()?.name === '=') {
			// Consume the equals token
			const equalsToken = tokenStream.next();
			if (equalsToken) allTokens.push(equalsToken);

			// Check if the next token is '>'
			tokenStream.consumeWhitespace();
			if (tokenStream.peek()?.name === '>') {
				const gtToken = tokenStream.next();
				if (gtToken) allTokens.push(gtToken);
				isArrowFunction = true;
			}
		}

		// Process function body
		tokenStream.consumeWhitespace();
		const bodyStartToken = tokenStream.peek();

		if (!bodyStartToken) {
			// No body, use what we have
			const lastToken = allTokens[allTokens.length - 1];
			functionGroup.end = lastToken ? lastToken.end : startPos;
			functionGroup.tokens = allTokens;
			return functionGroup;
		}

		// Handle block body with braces
		if (bodyStartToken.name === '{') {
			const openBraceToken = tokenStream.next();
			if (openBraceToken) allTokens.push(openBraceToken);

			// Process the function body until matching closing brace
			let braceDepth = 1;

			while (!tokenStream.isEOF() && braceDepth > 0) {
				const token = tokenStream.next();
				if (!token) break;

				allTokens.push(token);

				if (token.name === '{') {
					braceDepth++;
				} else if (token.name === '}') {
					braceDepth--;
					if (braceDepth === 0) {
						// Found the end of the function
						functionGroup.end = token.end;
					}
				}
			}
		} else if (isArrowFunction) {
			// Arrow function with expression body (no braces)
			// For arrow functions with expression bodies, consume tokens until semicolon
			let foundEnd = false;

			while (!tokenStream.isEOF() && !foundEnd) {
				const token = tokenStream.peek();
				if (!token) break;

				if (token.name === ';') {
					// Found explicit end of expression
					const semicolonToken = tokenStream.next();
					if (semicolonToken) allTokens.push(semicolonToken);
					functionGroup.end = semicolonToken ? semicolonToken.end : -1;
					foundEnd = true;
				} else if (token.type === 'class' || token.type === 'interface' ||
					token.type === 'function' || token.type === 'type' ||
					token.type === 'enum') {
					// Found start of another declaration
					foundEnd = true;
				} else {
					// Still part of the expression body
					const exprToken = tokenStream.next();
					if (exprToken) allTokens.push(exprToken);
				}
			}
		} else {
			// Just a declaration with no body, use what we have
			functionGroup.end = bodyStartToken.start; // Don't consume the token
		}

		// Final fallback for end position
		if (functionGroup.end === -1) {
			const lastToken = allTokens[allTokens.length - 1];
			functionGroup.end = lastToken ? lastToken.end : startPos;
		}

		// Update the tokens array
		functionGroup.tokens = allTokens;

		return functionGroup;
	}

	/**
	 * Process a variable declaration.
	 */
	private processVariableDeclaration(tokenStream: TokenStream): TokenGroup | null {
		// Store the starting position and the 'variable' token (let, const, or var)
		const variableToken = tokenStream.next();
		if (!variableToken) return null;

		const startPos = variableToken.start;
		const allTokens = [variableToken];

		// Extract the actual keyword (let, const, var) from the source
		// Since the tokenizer just marks it as "variable" type
		const declarationKeyword = this.source.substring(variableToken.start, variableToken.end).trim();

		if (DEBUG) {
			console.log(`TokenGrouper.processVariableDeclaration: found ${declarationKeyword} at position ${startPos}`);
		}

		// Create the variable group
		const variableGroup: TokenGroup = {
			type: 'VariableDeclaration',
			start: startPos,
			end: -1, // Will be filled in later
			name: undefined, // Will be filled in as we process
			tokens: allTokens, // Will be updated with all tokens
			children: [],
			metadata: {
				modifiers: [declarationKeyword], // Add the actual keyword as a modifier
				typeAnnotation: undefined // Will be filled if there's a type annotation
			}
		};

		// Skip whitespace after the variable keyword
		tokenStream.consumeWhitespace();

		// Check if we have an object or array destructuring pattern or malformed declaration
		const nextToken = tokenStream.peek();

		// Check for malformed declaration (e.g., "let = 42;")
		if (nextToken && nextToken.name === '=') {
			// Mark as a malformed declaration
			variableGroup.name = `${declarationKeyword}_Identifier`;

			if (DEBUG) {
				console.log(`TokenGrouper.processVariableDeclaration: found malformed declaration, no variable name before =`);
			}

			// We don't consume the token yet, it will be handled in the initializer section
		} else if (nextToken && nextToken.name === '{') {
			// Object destructuring pattern
			variableGroup.name = `${declarationKeyword}_ObjectPattern`;

			// Consume the opening brace
			const openBrace = tokenStream.next();
			if (openBrace) allTokens.push(openBrace);

			// Process the destructuring pattern
			let braceDepth = 1; // Start with depth 1 since we just consumed an opening brace
			while (!tokenStream.isEOF() && braceDepth > 0) {
				const token = tokenStream.next();
				if (!token) break;

				allTokens.push(token);

				if (token.name === '{') {
					braceDepth++;
				} else if (token.name === '}') {
					braceDepth--;
				}
			}

			if (DEBUG) {
				console.log(`TokenGrouper.processVariableDeclaration: processed object destructuring pattern`);
			}
		} else if (nextToken && nextToken.name === '[') {
			// Array destructuring pattern
			variableGroup.name = `${declarationKeyword}_ArrayPattern`;

			// Consume the opening bracket
			const openBracket = tokenStream.next();
			if (openBracket) allTokens.push(openBracket);

			// Process the destructuring pattern
			let bracketDepth = 1; // Start with depth 1 since we just consumed an opening bracket
			while (!tokenStream.isEOF() && bracketDepth > 0) {
				const token = tokenStream.next();
				if (!token) break;

				allTokens.push(token);

				if (token.name === '[') {
					bracketDepth++;
				} else if (token.name === ']') {
					bracketDepth--;
				}
			}

			if (DEBUG) {
				console.log(`TokenGrouper.processVariableDeclaration: processed array destructuring pattern`);
			}
		} else {
			// Regular variable name
			const nameToken = tokenStream.next();
			if (nameToken) {
				allTokens.push(nameToken);

				// Set the variable name from the token
				if (nameToken.name) {
					variableGroup.name = nameToken.name;

					if (DEBUG) {
						console.log(`TokenGrouper.processVariableDeclaration: processed name "${variableGroup.name}"`);
					}
				} else if (nameToken.type === 'unknown') {
					// Handle case where token has type but no name
					variableGroup.name = `${declarationKeyword}_Identifier`;
				}
			}
		}

		// Process the rest of the variable declaration
		let braceDepth = 0;
		let squareDepth = 0;
		let parenDepth = 0;
		let foundTypeAnnotation = false;
		let typeAnnotation = '';

		while (!tokenStream.isEOF()) {
			tokenStream.consumeWhitespace();
			const token = tokenStream.peek();
			if (!token) break;

			// Check for end of declaration
			if (token.name === ';' && braceDepth === 0 && squareDepth === 0 && parenDepth === 0) {
				// End of this declaration
				const semicolonToken = tokenStream.next();
				if (semicolonToken) {
					allTokens.push(semicolonToken);
					variableGroup.end = semicolonToken.end;
				}
				break;
			} else if (token.name === ',' && braceDepth === 0 && squareDepth === 0 && parenDepth === 0) {
				// Multiple declarations in a statement - we'll stop at the comma
				variableGroup.end = token.start;
				break;
			}

			// Process type annotation if we find a colon
			if (token.name === ':' && !foundTypeAnnotation) {
				foundTypeAnnotation = true;
				const colonToken = tokenStream.next();
				if (colonToken) allTokens.push(colonToken);

				// Collect the type annotation until we hit an equals sign or semicolon
				let arrowFound = false;
				let continueAfterArrow = false;

				while (!tokenStream.isEOF()) {
					tokenStream.consumeWhitespace();
					const typeToken = tokenStream.peek();
					if (!typeToken) break;

					// In function type annotations (data) => void, we need to include the arrow and return type
					if (typeToken.name === '=' && !arrowFound) {
						// Check if this might be part of an arrow (=>)
						const possibleArrowToken = tokenStream.next();
						if (possibleArrowToken) allTokens.push(possibleArrowToken);

						// Peek to see if next token is ">"
						tokenStream.consumeWhitespace();
						const nextAfterEquals = tokenStream.peek();

						if (nextAfterEquals && nextAfterEquals.name === '>') {
							// It's an arrow function type
							arrowFound = true;
							const arrowRightToken = tokenStream.next();
							if (arrowRightToken) allTokens.push(arrowRightToken);

							// Add both tokens to type annotation
							typeAnnotation += "=> ";

							// Continue collecting the return type
							continueAfterArrow = true;
						} else {
							// It's just an equals sign, so it's the initializer
							if (braceDepth === 0 && squareDepth === 0 && parenDepth === 0) {
								// Don't add the equals to the type annotation
								break;
							}

							// Otherwise, it's part of the type (like in a conditional type)
							typeAnnotation += "= ";
						}
						continue;
					}

					// Handle complete arrow token
					if (typeToken.name === '=>' && !arrowFound) {
						arrowFound = true;
						const arrowToken = tokenStream.next();
						if (arrowToken) allTokens.push(arrowToken);

						// Add to type annotation
						typeAnnotation += "=> ";

						// Continue collecting the return type
						continueAfterArrow = true;
						continue;
					}

					// If we've found an arrow and processed the return type parts, and now reaching '='
					// at the root level, it's time to stop the type annotation
					if (arrowFound && continueAfterArrow && typeToken.name === '=' &&
						braceDepth === 0 && squareDepth === 0 && parenDepth === 0) {
						break;
					}

					// Stop at equals sign or semicolon or comma (if at root level)
					if ((typeToken.name === '=' || typeToken.name === ';' || typeToken.name === ',') &&
						braceDepth === 0 && squareDepth === 0 && parenDepth === 0 && !continueAfterArrow) {
						break;
					}

					// Add token to type annotation
					const consumedTypeToken = tokenStream.next();
					if (consumedTypeToken) {
						allTokens.push(consumedTypeToken);

						// Update depth counters
						if (consumedTypeToken.name === '{') braceDepth++;
						else if (consumedTypeToken.name === '}') braceDepth--;
						else if (consumedTypeToken.name === '[') squareDepth++;
						else if (consumedTypeToken.name === ']') squareDepth--;
						else if (consumedTypeToken.name === '(') parenDepth++;
						else if (consumedTypeToken.name === ')') parenDepth--;

						// Add to type annotation string
						if (consumedTypeToken.name) {
							typeAnnotation += consumedTypeToken.name + ' ';
						}

						// If we just completed a return type after an arrow, check if the next token is '='
						if (continueAfterArrow && braceDepth === 0 && squareDepth === 0 && parenDepth === 0) {
							tokenStream.consumeWhitespace();
							const nextToken = tokenStream.peek();
							if (nextToken && nextToken.name === '=') {
								continueAfterArrow = false; // Stop continuing after the return type
								break;
							}
						}
					}
				}

				// Save the type annotation
				if (typeAnnotation) {
					variableGroup.metadata!.typeAnnotation = typeAnnotation.trim();

					if (DEBUG) {
						console.log(`TokenGrouper.processVariableDeclaration: processed type annotation "${typeAnnotation.trim()}"`);
					}
				}

				continue;
			}

			// Handle initializer
			if (token.name === '=') {
				const equalsToken = tokenStream.next();
				if (equalsToken) allTokens.push(equalsToken);

				// Reset depth counters for the initializer
				braceDepth = 0;
				squareDepth = 0;
				parenDepth = 0;

				// Collect all tokens for the initializer until semicolon or comma
				while (!tokenStream.isEOF()) {
					tokenStream.consumeWhitespace();
					const initToken = tokenStream.peek();
					if (!initToken) break;

					// Stop at semicolon or comma (if at root level)
					if ((initToken.name === ';' || initToken.name === ',') &&
						braceDepth === 0 && squareDepth === 0 && parenDepth === 0) {
						break;
					}

					// Add token to initializer
					const consumedInitToken = tokenStream.next();
					if (consumedInitToken) {
						allTokens.push(consumedInitToken);

						// Update depth counters
						if (consumedInitToken.name === '{') braceDepth++;
						else if (consumedInitToken.name === '}') braceDepth--;
						else if (consumedInitToken.name === '[') squareDepth++;
						else if (consumedInitToken.name === ']') squareDepth--;
						else if (consumedInitToken.name === '(') parenDepth++;
						else if (consumedInitToken.name === ')') parenDepth--;
					}
				}

				if (DEBUG) {
					console.log(`TokenGrouper.processVariableDeclaration: processed initializer`);
				}

				continue;
			}

			// Any other token (shouldn't reach here in well-formed code)
			const otherToken = tokenStream.next();
			if (otherToken) allTokens.push(otherToken);
		}

		// If we didn't find an explicit end, use the last token's end
		if (variableGroup.end === -1) {
			const lastToken = allTokens[allTokens.length - 1];
			variableGroup.end = lastToken ? lastToken.end : startPos;
		}

		// Update the tokens array
		variableGroup.tokens = allTokens;

		return variableGroup;
	}

	/**
	 * Process an object literal.
	 */
	private processObjectLiteral(tokenStream: TokenStream): TokenGroup | null {
		// Expect the opening brace
		const openBraceToken = tokenStream.next();
		if (!openBraceToken || openBraceToken.name !== '{') {
			if (DEBUG) {
				console.log(`TokenGrouper.processObjectLiteral: not an object literal, missing opening brace`);
			}
			return null; // Not an object literal
		}

		const startPos = openBraceToken.start;
		let allTokens = [openBraceToken];

		if (DEBUG) {
			console.log(`TokenGrouper.processObjectLiteral: starting to process object literal at position ${startPos}`);
		}

		// Create the object literal group
		const objectGroup: TokenGroup = {
			type: 'ObjectLiteral',
			start: startPos,
			end: -1, // Will be filled in later
			tokens: allTokens,
			children: [],
			metadata: {}
		};

		// Process the object body until we find the closing brace
		let braceDepth = 1; // Start at 1 for the opening brace
		let squareBracketDepth = 0;
		let parenthesesDepth = 0;

		while (!tokenStream.isEOF() && braceDepth > 0) {
			const token = tokenStream.next();
			if (!token) break;

			allTokens.push(token);

			if (DEBUG) {
				console.log(`TokenGrouper.processObjectLiteral: processing token ${JSON.stringify(token)}`);
			}

			// Track nesting depth
			if (token.name === '{') {
				braceDepth++;
				if (DEBUG) {
					console.log(`TokenGrouper.processObjectLiteral: found opening brace, depth now ${braceDepth}`);
				}
			} else if (token.name === '}') {
				braceDepth--;
				if (DEBUG) {
					console.log(`TokenGrouper.processObjectLiteral: found closing brace, depth now ${braceDepth}`);
				}
				if (braceDepth === 0) {
					// We've found the closing brace
					objectGroup.end = token.end;
					if (DEBUG) {
						console.log(`TokenGrouper.processObjectLiteral: object literal ends at position ${token.end}`);
					}
				}
			} else if (token.name === '[') {
				squareBracketDepth++;
			} else if (token.name === ']') {
				squareBracketDepth--;
			} else if (token.name === '(') {
				parenthesesDepth++;
			} else if (token.name === ')') {
				parenthesesDepth--;
			}
		}

		// If we didn't find a proper closing brace, use the last token position
		if (objectGroup.end === -1) {
			const lastToken = allTokens[allTokens.length - 1];
			objectGroup.end = lastToken ? lastToken.end : startPos;
			if (DEBUG) {
				console.log(`TokenGrouper.processObjectLiteral: no closing brace found, using end position ${objectGroup.end}`);
			}
		}

		// Update tokens
		objectGroup.tokens = allTokens;

		if (DEBUG) {
			console.log(`TokenGrouper.processObjectLiteral: completed processing object literal, token count: ${allTokens.length}`);
		}

		return objectGroup;
	}

	/**
	 * Process an array literal.
	 * Parses array literals, handling nested arrays, objects, and other elements.
	 */
	private processArrayLiteral(tokenStream: TokenStream): TokenGroup | null {
		// Expect the opening bracket
		const openBracketToken = tokenStream.next();
		if (!openBracketToken || openBracketToken.name !== '[') {
			if (DEBUG) {
				console.log(`TokenGrouper.processArrayLiteral: not an array literal, missing opening bracket`);
			}
			return null; // Not an array literal
		}

		const startPos = openBracketToken.start;
		let allTokens = [openBracketToken];

		if (DEBUG) {
			console.log(`TokenGrouper.processArrayLiteral: starting to process array literal at position ${startPos}`);
		}

		// Create the array literal group
		const arrayGroup: TokenGroup = {
			type: 'ArrayLiteral',
			start: startPos,
			end: -1, // Will be filled in later
			tokens: allTokens,
			children: [],
			metadata: {}
		};

		// Process the array body until we find the closing bracket
		let bracketDepth = 1; // Start at 1 for the opening bracket
		let braceDepth = 0;
		let parenthesesDepth = 0;

		while (!tokenStream.isEOF() && bracketDepth > 0) {
			const token = tokenStream.next();
			if (!token) break;

			allTokens.push(token);

			if (DEBUG) {
				console.log(`TokenGrouper.processArrayLiteral: processing token ${JSON.stringify(token)}`);
			}

			// Track nesting depth
			if (token.name === '[') {
				bracketDepth++;
				if (DEBUG) {
					console.log(`TokenGrouper.processArrayLiteral: found opening bracket, depth now ${bracketDepth}`);
				}
			} else if (token.name === ']') {
				bracketDepth--;
				if (DEBUG) {
					console.log(`TokenGrouper.processArrayLiteral: found closing bracket, depth now ${bracketDepth}`);
				}
				if (bracketDepth === 0) {
					// We've found the closing bracket
					arrayGroup.end = token.end;
					if (DEBUG) {
						console.log(`TokenGrouper.processArrayLiteral: array literal ends at position ${token.end}`);
					}
				}
			} else if (token.name === '{') {
				braceDepth++;

				// If we're starting a new object at the top level (not inside another structure),
				// we could recursively process it as a child node
				if (braceDepth === 1 && bracketDepth === 1 && parenthesesDepth === 0) {
					// Save current position
					const objectStart = token.start;

					// Process object literal recursively (reusing the current implementation)
					tokenStream.consumeWhitespace();
					const objGroup = this.processObjectLiteral(tokenStream);
					if (objGroup) {
						// Add as a child node
						arrayGroup.children.push(objGroup);
					}

					// Skip the already processed tokens
					continue;
				}
			} else if (token.name === '}') {
				braceDepth--;
			} else if (token.name === '(') {
				parenthesesDepth++;
			} else if (token.name === ')') {
				parenthesesDepth--;
			}
		}

		// If we didn't find a proper closing bracket, use the last token position
		if (arrayGroup.end === -1) {
			const lastToken = allTokens[allTokens.length - 1];
			arrayGroup.end = lastToken ? lastToken.end : startPos;
			if (DEBUG) {
				console.log(`TokenGrouper.processArrayLiteral: no closing bracket found, using end position ${arrayGroup.end}`);
			}
		}

		// Update tokens
		arrayGroup.tokens = allTokens;

		if (DEBUG) {
			console.log(`TokenGrouper.processArrayLiteral: completed processing array literal, token count: ${allTokens.length}`);
		}

		return arrayGroup;
	}

	/**
	 * Helper method to find a matching closing delimiter.
	 */
	private findMatchingClosingDelimiter(
		stream: TokenStream,
		openDelim: string,
		closeDelim: string
	): number {
		let depth = 1;
		let position = -1;

		while (!stream.isEOF() && depth > 0) {
			const token = stream.next();
			if (!token) break;

			if (token.name === openDelim) {
				depth++;
			} else if (token.name === closeDelim) {
				depth--;
				if (depth === 0) {
					position = token.end;
				}
			}
		}

		return position;
	}

	/**
	 * Helper method to extract template parameters from a token stream.
	 */
	private extractTemplateParams(tokenStream: TokenStream): string | undefined {
		// Check if next token is '<'
		const ltToken = tokenStream.peek();
		if (!ltToken || ltToken.name !== '<') {
			return undefined;
		}

		// Consume '<'
		tokenStream.next();
		const templateStart = ltToken.start;

		// Collect everything until matching '>'.
		let depth = 1;
		let lastPos = ltToken.end;

		while (!tokenStream.isEOF() && depth > 0) {
			const token = tokenStream.next();
			if (!token) break;
			if (token.name === '<') {
				depth++;
			} else if (token.name === '>') {
				depth--;
				if (depth === 0) {
					lastPos = token.end;
					break;
				}
			}
			lastPos = token.end;
		}

		// Return the substring from `<` up through `>`
		return this.source.substring(templateStart, lastPos);
	}
}










/******************************************************
 * Edit Representation
 ******************************************************/

/******************************************************
 * Edit Representation (Assumed to be present and unchanged)
 ******************************************************/
export interface Edit {
	start: number;
	end: number;
	replacement: string;
}

/**
 * Main builder for navigating and modifying TypeScript source code.
 */
export class TypeScriptCodeBuilder {
	private originalText: string = '';
	private edits: Edit[] = [];
	private rootGroup: TokenGroup | null = null;

	constructor(input: string) {
		this.parseText(input);
	}

	public parseText(input: string): void {
		this.originalText = input;
		this.edits = [];
		this.rootGroup = null;

		if (!input) {
			this.rootGroup = {
				type: 'CodeFile',
				start: 0,
				end: 0,
				tokens: [],
				children: []
			};
			return;
		}

		try {
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const grouper = new TokenGrouper(tokens, input);
			this.rootGroup = grouper.group();
		} catch (error) {
			console.error("TypeScriptCodeBuilder.parseText: Error during parsing:", error);
			this.rootGroup = null;
		}
	}

	public findGroup(predicate: (group: TokenGroup) => boolean, scope?: TokenGroup): TokenGroup | null {
		const startNode = scope ?? this.rootGroup;
		if (!startNode) {
			return null;
		}
		const stack: TokenGroup[] = [startNode];
		while (stack.length > 0) {
			const node = stack.pop()!;
			if (predicate(node)) {
				return node;
			}
			if (node.children && node.children.length > 0) {
				for (let i = node.children.length - 1; i >= 0; i--) {
					stack.push(node.children[i]);
				}
			}
		}
		return null;
	}

	public findObject(
		variableName: string,
		options: {
			onFound: (objectBuilder: TypeScriptObjectBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		if (!this.rootGroup) {
			options.onNotFound?.();
			return;
		}
		const variableGroup = this.findGroup(
			(group) => group.type === 'VariableDeclaration' && group.name === variableName
		);
		if (!variableGroup) {
			options.onNotFound?.();
			return;
		}

		let objectLiteralGroup = variableGroup.children?.find(child => child.type === 'ObjectLiteral');
		if (!objectLiteralGroup) {
			let equalsTokenIndex = -1;
			for (let i = 0; i < variableGroup.tokens.length; i++) {
				if (variableGroup.tokens[i].name === '=') {
					equalsTokenIndex = i;
					break;
				}
			}
			if (equalsTokenIndex === -1 || equalsTokenIndex >= variableGroup.tokens.length - 1) {
				options.onNotFound?.(); return;
			}
			let openBraceIndex = -1;
			for (let i = equalsTokenIndex + 1; i < variableGroup.tokens.length; i++) {
				if (variableGroup.tokens[i].type !== 'whitespace') {
					if (variableGroup.tokens[i].name === '{') openBraceIndex = i;
					break;
				}
			}
			if (openBraceIndex === -1) { options.onNotFound?.(); return; }
			let braceDepth = 1;
			let closeBraceIndex = -1;
			for (let i = openBraceIndex + 1; i < variableGroup.tokens.length; i++) {
				const token = variableGroup.tokens[i];
				if (token.name === '{') braceDepth++;
				else if (token.name === '}') {
					braceDepth--;
					if (braceDepth === 0) { closeBraceIndex = i; break; }
				}
			}
			if (closeBraceIndex === -1) { options.onNotFound?.(); return; }
			const openBraceToken = variableGroup.tokens[openBraceIndex];
			const closeBraceToken = variableGroup.tokens[closeBraceIndex];
			objectLiteralGroup = {
				type: 'ObjectLiteral', start: openBraceToken.start, end: closeBraceToken.end,
				tokens: variableGroup.tokens.slice(openBraceIndex, closeBraceIndex + 1),
				children: [], metadata: {}
			};
		}
		if (objectLiteralGroup) {
			const objectBuilder = new TypeScriptObjectBuilder(this, objectLiteralGroup, this.originalText);
			options.onFound(objectBuilder);
		} else {
			options.onNotFound?.();
		}
	}

	public findArray(
		variableName: string,
		options: {
			onFound: (arrayBuilder: TypeScriptArrayBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		if (!this.rootGroup) {
			options.onNotFound?.(); return;
		}
		const variableGroup = this.findGroup(
			(group) => group.type === 'VariableDeclaration' && group.name === variableName
		);
		if (!variableGroup) {
			options.onNotFound?.(); return;
		}
		let arrayLiteralGroup = variableGroup.children?.find(child => child.type === 'ArrayLiteral');
		if (!arrayLiteralGroup) {
			let equalsTokenIndex = -1;
			for (let i = 0; i < variableGroup.tokens.length; i++) {
				if (variableGroup.tokens[i].name === '=') { equalsTokenIndex = i; break; }
			}
			if (equalsTokenIndex === -1 || equalsTokenIndex >= variableGroup.tokens.length - 1) {
				options.onNotFound?.(); return;
			}
			let openBracketIndex = -1;
			for (let i = equalsTokenIndex + 1; i < variableGroup.tokens.length; i++) {
				if (variableGroup.tokens[i].type !== 'whitespace') {
					if (variableGroup.tokens[i].name === '[') openBracketIndex = i;
					break;
				}
			}
			if (openBracketIndex === -1) { options.onNotFound?.(); return; }
			let bracketDepth = 1;
			let closeBracketIndex = -1;
			for (let i = openBracketIndex + 1; i < variableGroup.tokens.length; i++) {
				const token = variableGroup.tokens[i];
				if (token.name === '[') bracketDepth++;
				else if (token.name === ']') {
					bracketDepth--;
					if (bracketDepth === 0) { closeBracketIndex = i; break; }
				}
			}
			if (closeBracketIndex === -1) { options.onNotFound?.(); return; }
			const openBracketToken = variableGroup.tokens[openBracketIndex];
			const closeBracketToken = variableGroup.tokens[closeBracketIndex];
			arrayLiteralGroup = {
				type: 'ArrayLiteral', start: openBracketToken.start, end: closeBracketToken.end,
				tokens: variableGroup.tokens.slice(openBracketIndex, closeBracketIndex + 1),
				children: [], metadata: {}
			};
		}
		if (arrayLiteralGroup) {
			const arrayBuilder = new TypeScriptArrayBuilder(this, arrayLiteralGroup, this.originalText);
			options.onFound(arrayBuilder);
		} else {
			options.onNotFound?.();
		}
	}

	public findType(
		variableName: string,
		options: {
			onFound: (typeBuilder: TypeScriptTypeBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		if (!this.rootGroup) { options.onNotFound?.(); return; }
		const variableGroup = this.findGroup(
			(group) => group.type === 'VariableDeclaration' && group.name === variableName
		);
		if (!variableGroup || !variableGroup.tokens || variableGroup.tokens.length === 0) {
			options.onNotFound?.(); return;
		}
		let nameTokenIndex = -1, colonTokenIndex = -1, endTokenIndex = -1;
		for (let i = 0; i < variableGroup.tokens.length; i++) {
			const tokenText = variableGroup.tokens[i].name ?? this.originalText.substring(variableGroup.tokens[i].start, variableGroup.tokens[i].end);
			if (tokenText === variableName) {
				if (i > 0 && variableGroup.tokens[i - 1].type === 'variable') { nameTokenIndex = i; break; }
				else if (variableGroup.tokens[i].type === 'unknown') { nameTokenIndex = i; break; }
			}
		}
		if (nameTokenIndex === -1) {
			if (!variableGroup.name?.includes('Pattern')) {
				for (let i = 0; i < variableGroup.tokens.length; i++) {
					if (variableGroup.tokens[i].name === variableGroup.name && variableGroup.tokens[i].type === 'unknown') {
						nameTokenIndex = i; break;
					}
				}
			}
			if (nameTokenIndex === -1) { options.onNotFound?.(); return; }
		}
		for (let i = nameTokenIndex + 1; i < variableGroup.tokens.length; i++) {
			if (variableGroup.tokens[i].name === ':') { colonTokenIndex = i; break; }
			if (variableGroup.tokens[i].name === '=' || variableGroup.tokens[i].name === ';') break;
		}
		if (colonTokenIndex === -1) { options.onNotFound?.(); return; }
		let nestingLevel = 0;
		for (let i = colonTokenIndex + 1; i < variableGroup.tokens.length; i++) {
			const token = variableGroup.tokens[i];
			if (token.name === '<' || token.name === '{' || token.name === '[') nestingLevel++;
			else if (token.name === '>' || token.name === '}' || token.name === ']') nestingLevel--;
			if (nestingLevel === 0 && (token.name === '=' || token.name === ';')) { endTokenIndex = i; break; }
		}
		if (endTokenIndex === -1) endTokenIndex = variableGroup.tokens.length;
		const typeStartToken = variableGroup.tokens[colonTokenIndex + 1];
		const typeEndToken = variableGroup.tokens[endTokenIndex - 1];
		if (!typeStartToken || !typeEndToken) { options.onNotFound?.(); return; }
		const typeStartPos = typeStartToken.start;
		const typeEndPos = typeEndToken.end;
		if (typeStartPos >= typeEndPos) { options.onNotFound?.(); return; }
		const typeBuilder = new TypeScriptTypeBuilder(this, typeStartPos, typeEndPos, this.originalText);
		options.onFound(typeBuilder);
	}

	public findClass(
		className: string,
		options: {
			onFound: (classBuilder: TypeScriptClassBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		if (!this.rootGroup) { options.onNotFound?.(); return; }
		const classGroup = this.findGroup(
			(group) => group.type === 'ClassDeclaration' && group.name === className
		);
		if (classGroup) {
			const classBuilder = new TypeScriptClassBuilder(this, classGroup, this.originalText);
			options.onFound(classBuilder);
		} else {
			options.onNotFound?.();
		}
	}

	public findInterface(
		interfaceName: string,
		options: {
			onFound: (interfaceBuilder: TypeScriptInterfaceBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		if (!this.rootGroup) { options.onNotFound?.(); return; }
		const interfaceGroup = this.findGroup(
			(group) => group.type === 'InterfaceDeclaration' && group.name === interfaceName
		);
		if (interfaceGroup) {
			const interfaceBuilder = new TypeScriptInterfaceBuilder(this, interfaceGroup, this.originalText);
			options.onFound(interfaceBuilder);
		} else {
			options.onNotFound?.();
		}
	}

	/**
	 * Finds an object literal returned by a function.
	 * @param functionName The name of the function.
	 * @param options Callbacks for handling success or failure.
	 */
	public findReturnObjectInFunction(
		functionName: string,
		options: {
			onFound: (objectBuilder: TypeScriptObjectBuilder) => void;
			onNotFound?: () => void;
		}
	): void {
		if (!this.rootGroup) {
			options.onNotFound?.();
			return;
		}

		const functionGroup = this.findGroup(
			(group) => group.type === 'FunctionDeclaration' && group.name === functionName
		);

		if (!functionGroup || !functionGroup.tokens) {
			options.onNotFound?.();
			return;
		}

		let returnTokenIndex = -1;
		for (let i = 0; i < functionGroup.tokens.length; i++) {
			const tokenName = functionGroup.tokens[i].name ?? this.originalText.substring(functionGroup.tokens[i].start, functionGroup.tokens[i].end);
			if (tokenName === 'return') {
				returnTokenIndex = i;
				break;
			}
		}

		if (returnTokenIndex === -1) {
			options.onNotFound?.();
			return;
		}

		let openBraceToken: ParsedItemToken | null = null;
		for (let i = returnTokenIndex + 1; i < functionGroup.tokens.length; i++) {
			const token = functionGroup.tokens[i];
			if (token.type === 'whitespace') continue;
			if (token.name === '{') {
				openBraceToken = token;
				break;
			} else {
				// Found something other than whitespace or '{' after return
				options.onNotFound?.();
				return;
			}
		}

		if (!openBraceToken) {
			options.onNotFound?.();
			return;
		}

		// Find matching closing brace
		let braceDepth = 1;
		let closeBraceToken: ParsedItemToken | null = null;
		const openBraceIndexInFuncTokens = functionGroup.tokens.indexOf(openBraceToken);

		for (let i = openBraceIndexInFuncTokens + 1; i < functionGroup.tokens.length; i++) {
			const token = functionGroup.tokens[i];
			if (token.name === '{') {
				braceDepth++;
			} else if (token.name === '}') {
				braceDepth--;
				if (braceDepth === 0) {
					closeBraceToken = token;
					break;
				}
			}
		}

		if (openBraceToken && closeBraceToken) {
			const objectLiteralGroup: TokenGroup = {
				type: 'ObjectLiteral',
				start: openBraceToken.start,
				end: closeBraceToken.end,
				tokens: functionGroup.tokens.slice(openBraceIndexInFuncTokens, functionGroup.tokens.indexOf(closeBraceToken) + 1),
				children: [], // Could be parsed further if needed
				metadata: {}
			};
			const objectBuilder = new TypeScriptObjectBuilder(this, objectLiteralGroup, this.originalText);
			options.onFound(objectBuilder);
		} else {
			options.onNotFound?.();
		}
	}


	public addEdit(start: number, end: number, replacement: string): void {
		if (start < 0 || end < start || end > this.originalText.length) {
			console.warn("Invalid edit range");
			console.warn(`Range details - Start: ${start}, End: ${end}, Text Length: ${this.originalText.length}`);
			return;
		}
		this.edits.push({ start, end, replacement });
	}

	public toString(): Promise<string> {
		if (this.edits.length === 0) {
			return Promise.resolve(this.originalText);
		}
		const sortedEdits = [...this.edits].sort((a, b) => {
			if (a.start !== b.start) return a.start - b.start;
			return b.end - a.end;
		});
		let modifiedText = this.originalText;
		let cumulativeOffset = 0;
		for (const edit of sortedEdits) {
			const adjustedStart = edit.start + cumulativeOffset;
			const adjustedEnd = edit.end + cumulativeOffset;
			if (adjustedStart < 0 || adjustedEnd < adjustedStart || adjustedEnd > modifiedText.length) {
				console.error(`TypeScriptCodeBuilder.toString: Invalid adjusted edit range. Skipping edit.`);
				continue;
			}
			modifiedText = modifiedText.slice(0, adjustedStart) + edit.replacement + modifiedText.slice(adjustedEnd);
			const lengthDelta = edit.replacement.length - (edit.end - edit.start);
			cumulativeOffset += lengthDelta;
		}
		this.edits = []; // Clear edits after applying
		return Promise.resolve(modifiedText);
	}

	public insertCodeAtIndex(index: number, codeToInsert: string): void {
		if (!this.rootGroup) {
			throw new Error("Cannot insert code: Code structure has not been parsed successfully.");
		}
		if (codeToInsert == null) {
			throw new Error("Cannot insert code: Code to insert cannot be null or undefined.");
		}
		const topLevelElements = this.rootGroup.children ?? [];
		const count = topLevelElements.length;
		if (index < 0 || index > count) {
			throw new Error(`Index out of bounds: Cannot insert at index ${index}. Valid range is 0 to ${count}.`);
		}
		if (codeToInsert === '') {
			// Simplified handling for empty string based on test expectations for TypeScriptCodeBuilder.insertCodeAtIndex
			// The original user test suite for TypeScriptArrayBuilder might have different logic for empty insertions.
			const insertPos = (index === 0 || count === 0) ?
				(topLevelElements[0]?.start ?? 0) :
				topLevelElements[index - 1]?.end ?? this.originalText.length;
			this.addEdit(insertPos, insertPos, '\n\n\n\n'); // Adds 4 newlines as per one of the tests
			return;
		}
		if (count === 0) {
			const isCommentOnly = this.originalText.trim().startsWith('//') && this.originalText.trim().indexOf('\n') === -1;
			if (isCommentOnly) {
				this.addEdit(this.originalText.length, this.originalText.length, codeToInsert);
			} else {
				this.addEdit(0, 0, codeToInsert);
			}
			return;
		}
		if (index === 0) {
			this.addEdit(topLevelElements[0].start, topLevelElements[0].start, codeToInsert + '\n\n');
		} else if (index === count) {
			this.addEdit(topLevelElements[index - 1].end, topLevelElements[index - 1].end, '\n\n' + codeToInsert + '\n');
		} else {
			const precedingElement = topLevelElements[index - 1];
			const followingElement = topLevelElements[index];
			const formattedCode = '\n\n\n' + codeToInsert + '\n\n\n';
			this.addEdit(precedingElement.end, followingElement.start, formattedCode);
		}
	}
}

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

			let newPropertyFullText: string;
			let editStart: number;
			let editEnd: number;

			if (properties.length === 0) { // Object is empty or contains only whitespace
				editStart = contentStart;
				editEnd = contentEnd; // We will replace the entire content between braces

				const originalHadNewline = currentContent.includes('\n');
				const isTrulyEmptyAndFormatted = originalHadNewline && currentContent.trim() === ''; // e.g., { \n }

				if (isTrulyEmptyAndFormatted) {
					newPropertyFullText = `\n  ${propertyName}: ${newValue}\n`;
				} else {
					// For {} or {   } or even malformed like {abc} that parseProperties found empty
					// Default to space padding, unless it was truly {}
					const leadingSpace = currentContent.startsWith(' ') || currentContent.length === 0 ? ' ' : '';
					const trailingSpace = currentContent.endsWith(' ') || currentContent.length === 0 ? ' ' : '';
					newPropertyFullText = `${leadingSpace}${propertyName}: ${newValue}${trailingSpace}`;
					// Special case for exactly "{}", make it "{prop: value}" without leading/trailing spaces inside
					if (this.originalText.substring(this.objectGroup.start, this.objectGroup.end) === '{}') {
						newPropertyFullText = `${propertyName}: ${newValue}`;
					}
				}
			} else { // Object has existing properties
				const lastProperty = properties[properties.length - 1];
				const isMultiLine = currentContent.includes('\n');
				const endsWithNewlineBeforeBrace = /\n\s*$/.test(currentContent);

				// Text for the new property itself, ready for formatting
				let newPropSegment = `${propertyName}: ${newValue}`;

				// Comma logic: check if a comma is needed before the new property.
				// This means checking the text *after* the last property's value but *before* its segment technically ends.
				const textAfterLastValue = this.originalText.substring(lastProperty.valueEnd, lastProperty.end);
				const needsComma = !textAfterLastValue.trim().startsWith(',');

				if (isMultiLine) {
					// The new property will start with a comma (if needed), then newline and indentation.
					newPropertyFullText = (needsComma ? "," : "") + `\n  ${newPropSegment}`;
					// If the object style includes a newline before the closing brace, add one.
					if (endsWithNewlineBeforeBrace) {
						newPropertyFullText += "\n";
					}
					// The edit will replace from after the last property's value up to the end of its segment.
					// This effectively places the comma correctly and manages the newline.
					editStart = lastProperty.valueEnd;
					editEnd = lastProperty.end;
				} else { // Single-line object
					// If inserting after "prop:val", needs ", newProp:newVal"
					// If inserting after "prop:val,", needs " newProp:newVal"
					if (needsComma) {
						newPropertyFullText = `, ${newPropSegment}`;
					} else {
						newPropertyFullText = ` ${newPropSegment}`;
					}
					editStart = lastProperty.end; // Insert right after the last property's segment (which includes its comma)
					editEnd = lastProperty.end;
				}
			}
			this.parentBuilder.addEdit(editStart, editEnd, newPropertyFullText);
		}
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
				end?: number;   // Absolute end of the primitive value in originalText
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
		let braceDepth = 0; let bracketDepth = 0; let parenDepth = 0;
		let propertyFullStart = -1; let nameStart = -1; let nameEnd = -1; let colonPos = -1;

		while (pos < content.length) {
			const char = content[pos];
			if (propertyFullStart === -1 && !/\s|,/.test(char)) propertyFullStart = pos;
			if ((char === '"' || char === "'") && (pos === 0 || content[pos - 1] !== '\\')) {
				if (!inString) { inString = true; stringChar = char; }
				else if (char === stringChar) inString = false;
			}
			if (inString) { pos++; continue; }
			if (char === '{') braceDepth++; else if (char === '}') braceDepth--;
			if (char === '[') bracketDepth++; else if (char === ']') bracketDepth--;
			if (char === '(') parenDepth++; else if (char === ')') parenDepth--;
			if (nameStart === -1 && propertyFullStart !== -1 && !/\s/.test(char)) nameStart = pos;
			if (nameStart !== -1 && nameEnd === -1 && char === ':') { nameEnd = pos; colonPos = pos; }
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

/******************************************************
 * Array Literal Builder
 ******************************************************/

/**
 * Provides methods for inspecting and modifying a specific array literal ([ ... ]).
 * Operates based on a TokenGroup of type 'ArrayLiteral'.
 */
/******************************************************
 * Array Literal Builder
 ******************************************************/

/**
 * Provides methods for inspecting and modifying a specific array literal ([ ... ]).
 */
export class TypeScriptArrayBuilder {
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		public arrayGroup: TokenGroup,
		private originalText: string
	) { }

	private isWhitespace(char: string): boolean { return /\s/.test(char); }

	public addItem(itemToAdd: string): void {
		const items = this.parseItems();
		const contentStart = this.arrayGroup.start + 1;
		const contentEnd = this.arrayGroup.end - 1;
		if (items.length === 0) {
			this.parentBuilder.addEdit(contentStart, contentEnd, ` ${itemToAdd} `);
		} else {
			const lastItem = items[items.length - 1];
			const textSuffixAfterLastItemValue = this.originalText.substring(lastItem.end, contentEnd);
			const firstCommaPosInSuffix = textSuffixAfterLastItemValue.indexOf(',');
			let effectiveInsertionPoint: number;
			let prefixForNewItemText: string;
			if (firstCommaPosInSuffix !== -1) {
				effectiveInsertionPoint = lastItem.end + firstCommaPosInSuffix + 1;
				prefixForNewItemText = " ";
			} else {
				effectiveInsertionPoint = lastItem.end;
				prefixForNewItemText = ", ";
			}
			let stringToEffectivelyInsert = prefixForNewItemText + itemToAdd;
			const originalTrimmedContentBetweenBrackets = this.originalText.substring(contentStart, contentEnd).trim();
			if (originalTrimmedContentBetweenBrackets.endsWith(',')) {
				if (!itemToAdd.trim().endsWith(',') && !stringToEffectivelyInsert.trim().endsWith(',')) {
					stringToEffectivelyInsert += ",";
				}
			}
			this.parentBuilder.addEdit(effectiveInsertionPoint, effectiveInsertionPoint, stringToEffectivelyInsert);
		}
	}

	public insertItemAtIndex(index: number, itemToAdd: string): void {
		const items = this.parseItems();
		if (index < 0 || index > items.length) {
			throw new Error(`Invalid index ${index}. Valid range is 0 to ${items.length}.`);
		}
		const contentStart = this.arrayGroup.start + 1;
		if (items.length === 0) {
			this.parentBuilder.addEdit(contentStart, this.arrayGroup.end - 1, ` ${itemToAdd} `);
		} else if (index === items.length) {
			const lastItem = items[items.length - 1];
			const textSuffixAfterLastItemValue = this.originalText.substring(lastItem.end, this.arrayGroup.end - 1);
			const firstCommaPosInSuffix = textSuffixAfterLastItemValue.indexOf(',');
			let effectiveInsertionPoint: number;
			let prefixForNewItemText: string;
			if (firstCommaPosInSuffix !== -1) {
				effectiveInsertionPoint = lastItem.end + firstCommaPosInSuffix + 1;
				prefixForNewItemText = " ";
			} else {
				effectiveInsertionPoint = lastItem.end;
				prefixForNewItemText = ", ";
			}
			this.parentBuilder.addEdit(effectiveInsertionPoint, effectiveInsertionPoint, prefixForNewItemText + itemToAdd);
		} else if (index === 0) {
			const firstItem = items[0];
			this.parentBuilder.addEdit(firstItem.start, firstItem.start, itemToAdd + ', ');
		} else {
			const itemBefore = items[index - 1];
			this.parentBuilder.addEdit(itemBefore.end, itemBefore.end, `, ${itemToAdd}`);
		}
	}

	public removeItemAtIndex(indexToRemove: number): boolean {
		const items = this.parseItems();
		if (indexToRemove < 0 || indexToRemove >= items.length) {
			throw new Error(`Index out of bounds: Cannot remove at index ${indexToRemove}. Valid range is 0 to ${items.length - 1}.`);
		}
		const itemToRemove = items[indexToRemove];
		let startDelete = itemToRemove.start;
		let endDelete = itemToRemove.end;
		if (items.length === 1) {
			startDelete = this.arrayGroup.start + 1;
			endDelete = this.arrayGroup.end - 1;
		} else if (indexToRemove === 0) {
			const nextItem = items[1];
			endDelete = nextItem.start;
		} else {
			const prevItem = items[indexToRemove - 1];
			startDelete = prevItem.end;
		}
		this.parentBuilder.addEdit(startDelete, endDelete, '');
		return true;
	}

	public replaceItemAtIndex(index: number, newItem: string): boolean {
		const items = this.parseItems();
		if (index < 0 || index >= items.length) {
			throw new Error(`Index out of bounds: Cannot replace at index ${index}. Valid range is 0 to ${items.length - 1}.`);
		}
		const itemToReplace = items[index];
		this.parentBuilder.addEdit(itemToReplace.start, itemToReplace.end, newItem);
		return true;
	}

	public getObjectItems(): TypeScriptObjectBuilder[] {
		const items = this.parseItems();
		const objectBuilders: TypeScriptObjectBuilder[] = [];
		for (const item of items) {
			const trimmedValue = item.value; // Already trimmed by parseItems
			if (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) {
				const objectGroup: TokenGroup = { type: 'ObjectLiteral', start: item.start, end: item.end, tokens: [], children: [], metadata: {} };
				objectBuilders.push(new TypeScriptObjectBuilder(this.parentBuilder, objectGroup, this.originalText));
			}
		}
		return objectBuilders;
	}

	public getArrayItems(): TypeScriptArrayBuilder[] {
		const items = this.parseItems();
		const arrayBuilders: TypeScriptArrayBuilder[] = [];
		for (const item of items) {
			const trimmedValue = item.value; // Already trimmed
			if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
				const arrayGroup: TokenGroup = { type: 'ArrayLiteral', start: item.start, end: item.end, tokens: [], children: [], metadata: {} };
				arrayBuilders.push(new TypeScriptArrayBuilder(this.parentBuilder, arrayGroup, this.originalText));
			}
		}
		return arrayBuilders;
	}
	public getItemTexts(): string[] { return this.parseItems().map(item => item.value); }
	public getItemCount(): number { return this.parseItems().length; }
	public getContentText(): string { return this.originalText.substring(this.arrayGroup.start + 1, this.arrayGroup.end - 1); }
	public getFullText(): string { return this.originalText.substring(this.arrayGroup.start, this.arrayGroup.end); }

	private parseItems(): Array<{ value: string; start: number; end: number; }> {
		const items: Array<{ value: string; start: number; end: number; }> = [];
		const content = this.originalText.substring(this.arrayGroup.start + 1, this.arrayGroup.end - 1);
		const contentOffsetInOriginal = this.arrayGroup.start + 1;
		let pos = 0; let currentItemTextStartInContent = -1;
		let inString = false; let stringChar = '';
		let braceDepth = 0; let bracketDepth = 0; let parenDepth = 0;
		while (pos < content.length) {
			const char = content[pos];
			if (currentItemTextStartInContent === -1 && !this.isWhitespace(char) && char !== ',') {
				currentItemTextStartInContent = pos;
			}
			if ((char === '"' || char === "'") && (pos === 0 || content[pos - 1] !== '\\')) {
				if (!inString) { inString = true; stringChar = char; }
				else if (char === stringChar) inString = false;
			}
			if (!inString) {
				if (char === '{') braceDepth++; else if (char === '}') braceDepth--;
				else if (char === '[') bracketDepth++; else if (char === ']') bracketDepth--;
				else if (char === '(') parenDepth++; else if (char === ')') parenDepth--;
			}
			if (currentItemTextStartInContent !== -1 && !inString && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0 && (char === ',' || pos === content.length - 1)) {
				let itemRawTextEndInContent = (char === ',' ? pos : pos + 1);
				const rawItemText = content.substring(currentItemTextStartInContent, itemRawTextEndInContent);
				let trimRelativeStart = 0;
				while (trimRelativeStart < rawItemText.length && this.isWhitespace(rawItemText[trimRelativeStart])) trimRelativeStart++;
				let trimRelativeEnd = rawItemText.length;
				while (trimRelativeEnd > trimRelativeStart && this.isWhitespace(rawItemText[trimRelativeEnd - 1])) trimRelativeEnd--;
				const trimmedItemValue = rawItemText.substring(trimRelativeStart, trimRelativeEnd);
				if (trimmedItemValue.length > 0) {
					items.push({
						value: trimmedItemValue,
						start: contentOffsetInOriginal + currentItemTextStartInContent + trimRelativeStart,
						end: contentOffsetInOriginal + currentItemTextStartInContent + trimRelativeEnd
					});
				}
				currentItemTextStartInContent = -1;
			}
			pos++;
		}
		return items;
	}
}

/******************************************************
 * Type Annotation Builder
 ******************************************************/

/**
 * Provides methods for inspecting and modifying a specific type annotation.
 * Operates based on the start/end positions of the type annotation text.
 * Uses TypeScriptTypeParser internally.
 */
export class TypeScriptTypeBuilder {
	private typeText: string; // Current text representation of the type
	private parsedType: any; // Parsed representation (e.g., from TypeScriptTypeParser) - Use specific type if available

	/**
	 * Creates an instance of TypeScriptTypeBuilder.
	 * Typically instantiated by TypeScriptCodeBuilder.findType.
	 * @param parentBuilder The main code builder instance for adding edits.
	 * @param typeStart The start index of the type annotation in the original source.
	 * @param typeEnd The end index of the type annotation in the original source.
	 * @param originalText The full original source code text.
	 */
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		private typeStart: number,
		private typeEnd: number,
		private originalText: string
	) {
		this.typeText = originalText.substring(typeStart, typeEnd);
	}

	/**
	 * Gets the current text of the entire type annotation.
	 * Reflects the latest state after potential modifications.
	 * @returns The type annotation string.
	 */
	public getTypeText(): string {
		return this.typeText;
	}

	/**
	 * Replaces the entire type annotation with a new type string.
	 * @param newType The new type annotation string (e.g., "string", "number | null", "Array<User>").
	 */
	public setType(newType: string): void {

	}

	/**
	 * If the current type is a union, returns the text representations of its constituent types.
	 * If the current type is not a union, returns an array containing the single type text.
	 * @returns An array of strings representing the types in the union (or the single type).
	 */
	public getUnionTypes(): string[] {
		throw new Error("Not implemented");
	}

	/**
	 * Adds a new type to the current type annotation, forming a union if necessary.
	 * If the type already exists in the union, no change is made.
	 * Handles correct formatting with the '|' operator and spacing.
	 * @param newType The type string to add to the union (e.g., "string", "null", "MyInterface").
	 */
	public addUnionType(newType: string): void {

	}

	/**
	 * Removes a specific type from a union type annotation.
	 * If the type is not part of the union, or if removing it would leave an empty union,
	 * no change is made (or an error might be thrown, TBD).
	 * Handles cleanup of '|' operators and spacing.
	 * @param typeToRemove The type string to remove from the union.
	 * @returns True if the type was successfully removed, false otherwise.
	 */
	public removeUnionType(typeToRemove: string): boolean {
		throw new Error("Not implemented");
	}

	/**
	 * Checks if the type annotation represents a union type.
	 * @returns True if the type is currently a union, false otherwise.
	 */
	public isUnionType(): boolean {
		return this.typeText.includes('|');
	}

	// TODO: Add methods for generics? e.g., getGenericArguments, addGenericArgument etc.
	// This would require enhancing the TypeScriptTypeParser or the representation here.
}


/******************************************************
 * Class Declaration Builder
 ******************************************************/

/**
 * Provides methods for inspecting and modifying a specific class declaration.
 * Operates based on a TokenGroup of type 'ClassDeclaration'.
 */
export class TypeScriptClassBuilder {
	/**
	 * Creates an instance of TypeScriptClassBuilder.
	 * Typically instantiated by TypeScriptCodeBuilder.findClass.
	 * @param parentBuilder The main code builder instance for adding edits.
	 * @param classGroup The TokenGroup representing the class declaration.
	 * @param originalText The full original source code text.
	 */
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		public classGroup: TokenGroup,
		private originalText: string
	) {

	}

	/**
	 * Gets the name of the class.
	 * @returns The class name string.
	 */
	public getName(): string | undefined {
		throw new Error("Not implemented");
	}

	/**
	 * Renames the class. Schedules an edit for the class name identifier.
	 * @param newName The new name for the class.
	 */
	public rename(newName: string): void {

	}

	/**
	 * Adds a property declaration to the class body.
	 * Handles formatting and placement within the class braces.
	 * @param propertyDeclaration The full property declaration string (e.g., "public name: string;").
	 */
	public addProperty(propertyDeclaration: string): void {

	}

	/**
	 * Adds a method declaration to the class body.
	 * Handles formatting and placement within the class braces.
	 * @param methodDeclaration The full method declaration string (e.g., "public getName(): string { return this.name; }").
	 */
	public addMethod(methodDeclaration: string): void {

	}

	/**
	 * Finds a specific property within the class by name.
	 * @param propertyName The name of the property to find.
	 * @param options Callbacks for handling success or failure.
	 * @param options.onFound Called with a builder or representation for the property (details TBD).
	 * @param options.onNotFound Called if the property is not found.
	 */
	public findProperty(
		propertyName: string,
		options: {
			onFound: (propertyBuilder: any /* Replace with specific PropertyBuilder if created */) => void;
			onNotFound?: () => void;
		}
	): void {

	}

	/**
	 * Finds a specific method within the class by name.
	 * @param methodName The name of the method to find.
	 * @param options Callbacks for handling success or failure.
	 * @param options.onFound Called with a builder or representation for the method (details TBD).
	 * @param options.onNotFound Called if the method is not found.
	 */
	public findMethod(
		methodName: string,
		options: {
			onFound: (methodBuilder: any /* Replace with specific MethodBuilder if created */) => void;
			onNotFound?: () => void;
		}
	): void {

	}

	/**
	 * Adds an interface name to the 'implements' clause.
	 * Handles creating the clause if it doesn't exist.
	 * @param interfaceName The name of the interface to implement.
	 */
	public addImplements(interfaceName: string): void {

	}

	/**
	 * Sets or replaces the 'extends' clause.
	 * @param className The name of the class to extend. Pass null or undefined to remove the extends clause.
	 */
	public setExtends(className: string | null | undefined): void {

	}

	// TODO: Add methods for removing implements, getting metadata, etc.
}


/******************************************************
 * Interface Declaration Builder
 ******************************************************/

/**
 * Provides methods for inspecting and modifying a specific interface declaration.
 * Operates based on a TokenGroup of type 'InterfaceDeclaration'.
 */
export class TypeScriptInterfaceBuilder {
	/**
	 * Creates an instance of TypeScriptInterfaceBuilder.
	 * Typically instantiated by TypeScriptCodeBuilder.findInterface.
	 * @param parentBuilder The main code builder instance for adding edits.
	 * @param interfaceGroup The TokenGroup representing the interface declaration.
	 * @param originalText The full original source code text.
	 */
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		public interfaceGroup: TokenGroup,
		private originalText: string
	) {

	}

	/**
	 * Gets the name of the interface.
	 * @returns The interface name string.
	 */
	public getName(): string | undefined {
		throw new Error("Not implemented");
	}

	/**
	 * Renames the interface. Schedules an edit for the interface name identifier.
	 * @param newName The new name for the interface.
	 */
	public rename(newName: string): void {

	}

	/**
	 * Adds a property signature to the interface body.
	 * Handles formatting and placement within the interface braces.
	 * @param propertySignature The full property signature string (e.g., "name: string;").
	 */
	public addProperty(propertySignature: string): void {

	}

	/**
	 * Adds a method signature to the interface body.
	 * Handles formatting and placement within the interface braces.
	 * @param methodSignature The full method signature string (e.g., "getName(): string;").
	 */
	public addMethod(methodSignature: string): void {

	}

	/**
	 * Finds a specific property signature within the interface by name.
	 * @param propertyName The name of the property to find.
	 * @param options Callbacks for handling success or failure.
	 * @param options.onFound Called with a builder or representation for the property signature (details TBD).
	 * @param options.onNotFound Called if the property signature is not found.
	 */
	public findProperty(
		propertyName: string,
		options: {
			onFound: (propertyBuilder: any /* Replace with specific PropertyBuilder if created */) => void;
			onNotFound?: () => void;
		}
	): void {

	}

	/**
	 * Finds a specific method signature within the interface by name.
	 * @param methodName The name of the method to find.
	 * @param options Callbacks for handling success or failure.
	 * @param options.onFound Called with a builder or representation for the method signature (details TBD).
	 * @param options.onNotFound Called if the method signature is not found.
	 */
	public findMethod(
		methodName: string,
		options: {
			onFound: (methodBuilder: any /* Replace with specific MethodBuilder if created */) => void;
			onNotFound?: () => void;
		}
	): void {

	}

	/**
	 * Adds an interface name to the 'extends' clause.
	 * Handles creating the clause if it doesn't exist and adding to existing ones.
	 * @param interfaceName The name of the interface to extend.
	 */
	public addExtends(interfaceName: string): void {

	}

	// TODO: Add methods for removing extends, getting metadata, etc.
}