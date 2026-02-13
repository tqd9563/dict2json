/**
 * Python Dict to JSON Converter
 *
 * Handles the following Python → JSON transformations:
 * - True/False → true/false
 * - None → null
 * - Single quotes → Double quotes
 * - Trailing commas → Removed
 * - Tuples (...) → Arrays [...]
 * - Python comments (#) → Removed
 * - Triple-quoted strings → Regular strings
 */

/**
 * Token types for the lexer
 */
enum TokenType {
    STRING,
    NUMBER,
    TRUE,
    FALSE,
    NONE,
    LBRACE,    // {
    RBRACE,    // }
    LBRACKET,  // [
    RBRACKET,  // ]
    LPAREN,    // (
    RPAREN,    // )
    COLON,     // :
    COMMA,     // ,
    EOF,
}

interface Token {
    type: TokenType;
    value: string;
    pos: number;
}

class PythonDictLexer {
    private input: string;
    private pos: number;
    private length: number;

    constructor(input: string) {
        this.input = input;
        this.pos = 0;
        this.length = input.length;
    }

    private peek(): string {
        return this.pos < this.length ? this.input[this.pos] : '';
    }

    private advance(): string {
        return this.input[this.pos++];
    }

    private skipWhitespaceAndComments(): void {
        while (this.pos < this.length) {
            const ch = this.peek();
            // Skip whitespace
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
                this.advance();
                continue;
            }
            // Skip Python line comments
            if (ch === '#') {
                while (this.pos < this.length && this.input[this.pos] !== '\n') {
                    this.advance();
                }
                continue;
            }
            break;
        }
    }

    private readString(quote: string): string {
        const startPos = this.pos;

        // Check for triple-quoted strings
        if (this.pos + 2 < this.length &&
            this.input[this.pos] === quote &&
            this.input[this.pos + 1] === quote) {
            // Skip the two remaining quotes (first was already consumed by caller)
            this.advance(); // second quote
            this.advance(); // third quote

            let result = '';
            while (this.pos < this.length) {
                if (this.input[this.pos] === quote &&
                    this.pos + 2 < this.length &&
                    this.input[this.pos + 1] === quote &&
                    this.input[this.pos + 2] === quote) {
                    this.pos += 3; // skip closing triple quotes
                    return result;
                }
                if (this.input[this.pos] === '\\') {
                    result += this.readEscapeSequence(quote);
                } else {
                    result += this.input[this.pos];
                    this.advance();
                }
            }
            throw new Error(`Unterminated triple-quoted string starting at position ${startPos}`);
        }

        // Regular single/double quoted string
        let result = '';
        while (this.pos < this.length) {
            const ch = this.input[this.pos];
            if (ch === quote) {
                this.advance(); // consume closing quote
                return result;
            }
            if (ch === '\\') {
                result += this.readEscapeSequence(quote);
            } else {
                result += ch;
                this.advance();
            }
        }
        throw new Error(`Unterminated string starting at position ${startPos}`);
    }

    private readEscapeSequence(quote: string): string {
        this.advance(); // skip backslash
        if (this.pos >= this.length) {
            throw new Error('Unexpected end of input in escape sequence');
        }
        const ch = this.advance();
        switch (ch) {
            case '\\': return '\\';
            case '/': return '/';
            case 'n': return '\n';
            case 'r': return '\r';
            case 't': return '\t';
            case 'b': return '\b';
            case 'f': return '\f';
            case '\'': return '\'';
            case '"': return '"';
            case '0': return '\0';
            case 'u': {
                // Unicode escape \uXXXX
                let hex = '';
                for (let i = 0; i < 4; i++) {
                    if (this.pos >= this.length) {
                        throw new Error('Unexpected end of input in unicode escape');
                    }
                    hex += this.advance();
                }
                return String.fromCharCode(parseInt(hex, 16));
            }
            case 'x': {
                // Hex escape \xXX
                let hex = '';
                for (let i = 0; i < 2; i++) {
                    if (this.pos >= this.length) {
                        throw new Error('Unexpected end of input in hex escape');
                    }
                    hex += this.advance();
                }
                return String.fromCharCode(parseInt(hex, 16));
            }
            default:
                // For unrecognized escapes, just return the character
                return ch;
        }
    }

    private readNumber(): string {
        let result = '';
        const start = this.pos;

        // Optional negative sign
        if (this.peek() === '-') {
            result += this.advance();
        }

        // Integer part
        if (this.peek() === '0') {
            result += this.advance();
            // Check for hex (0x), octal (0o), binary (0b) - convert to decimal
            if (this.peek() === 'x' || this.peek() === 'X') {
                this.advance(); // skip 'x'
                let hex = '';
                while (this.pos < this.length && /[0-9a-fA-F_]/.test(this.peek())) {
                    const ch = this.advance();
                    if (ch !== '_') { hex += ch; }
                }
                return String(parseInt(hex, 16));
            }
            if (this.peek() === 'o' || this.peek() === 'O') {
                this.advance();
                let oct = '';
                while (this.pos < this.length && /[0-7_]/.test(this.peek())) {
                    const ch = this.advance();
                    if (ch !== '_') { oct += ch; }
                }
                return String(parseInt(oct, 8));
            }
            if (this.peek() === 'b' || this.peek() === 'B') {
                this.advance();
                let bin = '';
                while (this.pos < this.length && /[01_]/.test(this.peek())) {
                    const ch = this.advance();
                    if (ch !== '_') { bin += ch; }
                }
                return String(parseInt(bin, 2));
            }
        }

        // Regular digits (allow Python underscore separators like 1_000_000)
        while (this.pos < this.length && /[0-9_]/.test(this.peek())) {
            const ch = this.advance();
            if (ch !== '_') { result += ch; }
        }

        // Decimal point
        if (this.peek() === '.' && this.pos + 1 < this.length && /[0-9]/.test(this.input[this.pos + 1])) {
            result += this.advance(); // '.'
            while (this.pos < this.length && /[0-9_]/.test(this.peek())) {
                const ch = this.advance();
                if (ch !== '_') { result += ch; }
            }
        }

        // Exponent
        if (this.peek() === 'e' || this.peek() === 'E') {
            result += this.advance();
            if (this.peek() === '+' || this.peek() === '-') {
                result += this.advance();
            }
            while (this.pos < this.length && /[0-9_]/.test(this.peek())) {
                const ch = this.advance();
                if (ch !== '_') { result += ch; }
            }
        }

        if (result === '' || result === '-') {
            throw new Error(`Invalid number at position ${start}`);
        }

        return result;
    }

    private readIdentifier(): string {
        let result = '';
        while (this.pos < this.length && /[a-zA-Z0-9_]/.test(this.peek())) {
            result += this.advance();
        }
        return result;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];

        while (true) {
            this.skipWhitespaceAndComments();

            if (this.pos >= this.length) {
                tokens.push({ type: TokenType.EOF, value: '', pos: this.pos });
                break;
            }

            const startPos = this.pos;
            const ch = this.peek();

            switch (ch) {
                case '{':
                    this.advance();
                    tokens.push({ type: TokenType.LBRACE, value: '{', pos: startPos });
                    break;
                case '}':
                    this.advance();
                    tokens.push({ type: TokenType.RBRACE, value: '}', pos: startPos });
                    break;
                case '[':
                    this.advance();
                    tokens.push({ type: TokenType.LBRACKET, value: '[', pos: startPos });
                    break;
                case ']':
                    this.advance();
                    tokens.push({ type: TokenType.RBRACKET, value: ']', pos: startPos });
                    break;
                case '(':
                    this.advance();
                    tokens.push({ type: TokenType.LPAREN, value: '(', pos: startPos });
                    break;
                case ')':
                    this.advance();
                    tokens.push({ type: TokenType.RPAREN, value: ')', pos: startPos });
                    break;
                case ':':
                    this.advance();
                    tokens.push({ type: TokenType.COLON, value: ':', pos: startPos });
                    break;
                case ',':
                    this.advance();
                    tokens.push({ type: TokenType.COMMA, value: ',', pos: startPos });
                    break;
                case '\'':
                case '"': {
                    this.advance(); // consume opening quote
                    const str = this.readString(ch);
                    tokens.push({ type: TokenType.STRING, value: str, pos: startPos });
                    break;
                }
                default: {
                    // Numbers (including negative numbers)
                    if (ch === '-' || (ch >= '0' && ch <= '9')) {
                        // For negative numbers, we need to check it's not just a minus sign
                        if (ch === '-') {
                            if (this.pos + 1 < this.length && /[0-9.]/.test(this.input[this.pos + 1])) {
                                const num = this.readNumber();
                                tokens.push({ type: TokenType.NUMBER, value: num, pos: startPos });
                            } else {
                                throw new Error(`Unexpected character '-' at position ${startPos}`);
                            }
                        } else {
                            const num = this.readNumber();
                            tokens.push({ type: TokenType.NUMBER, value: num, pos: startPos });
                        }
                    }
                    // Identifiers (True, False, None, etc.)
                    else if (/[a-zA-Z_]/.test(ch)) {
                        const ident = this.readIdentifier();
                        switch (ident) {
                            case 'True':
                                tokens.push({ type: TokenType.TRUE, value: 'true', pos: startPos });
                                break;
                            case 'False':
                                tokens.push({ type: TokenType.FALSE, value: 'false', pos: startPos });
                                break;
                            case 'None':
                                tokens.push({ type: TokenType.NONE, value: 'null', pos: startPos });
                                break;
                            case 'true':
                                tokens.push({ type: TokenType.TRUE, value: 'true', pos: startPos });
                                break;
                            case 'false':
                                tokens.push({ type: TokenType.FALSE, value: 'false', pos: startPos });
                                break;
                            case 'null':
                                tokens.push({ type: TokenType.NONE, value: 'null', pos: startPos });
                                break;
                            default:
                                // Treat unknown identifiers as strings (common in Python repr output)
                                tokens.push({ type: TokenType.STRING, value: ident, pos: startPos });
                                break;
                        }
                    }
                    else {
                        throw new Error(`Unexpected character '${ch}' at position ${startPos}`);
                    }
                }
            }
        }

        return tokens;
    }
}

class PythonDictParser {
    private tokens: Token[];
    private pos: number;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.pos = 0;
    }

    private current(): Token {
        return this.tokens[this.pos];
    }

    private expect(type: TokenType): Token {
        const token = this.current();
        if (token.type !== type) {
            throw new Error(
                `Expected ${TokenType[type]} but got ${TokenType[token.type]} ('${token.value}') at position ${token.pos}`
            );
        }
        this.pos++;
        return token;
    }

    private peek(): TokenType {
        return this.current().type;
    }

    /**
     * Parse entry point - parse a single value
     */
    parse(): unknown {
        const result = this.parseValue();
        // Allow trailing content (whitespace already skipped by lexer)
        if (this.peek() !== TokenType.EOF) {
            throw new Error(
                `Unexpected token ${TokenType[this.peek()]} ('${this.current().value}') at position ${this.current().pos}`
            );
        }
        return result;
    }

    private parseValue(): unknown {
        switch (this.peek()) {
            case TokenType.LBRACE:
                return this.parseDict();
            case TokenType.LBRACKET:
                return this.parseList();
            case TokenType.LPAREN:
                return this.parseTuple();
            case TokenType.STRING:
                return this.parseString();
            case TokenType.NUMBER:
                return this.parseNumber();
            case TokenType.TRUE:
                this.pos++;
                return true;
            case TokenType.FALSE:
                this.pos++;
                return false;
            case TokenType.NONE:
                this.pos++;
                return null;
            default:
                throw new Error(
                    `Unexpected token ${TokenType[this.peek()]} ('${this.current().value}') at position ${this.current().pos}`
                );
        }
    }

    private parseString(): string {
        const token = this.expect(TokenType.STRING);
        return token.value;
    }

    private parseNumber(): number {
        const token = this.expect(TokenType.NUMBER);
        const num = Number(token.value);
        if (isNaN(num)) {
            throw new Error(`Invalid number '${token.value}' at position ${token.pos}`);
        }
        return num;
    }

    private parseDict(): Record<string, unknown> {
        this.expect(TokenType.LBRACE);
        const result: Record<string, unknown> = {};

        if (this.peek() === TokenType.RBRACE) {
            this.pos++;
            return result;
        }

        while (true) {
            // Allow trailing comma before closing brace
            if (this.peek() === TokenType.RBRACE) {
                break;
            }

            // Parse key - can be string, number, True/False/None
            const key = this.parseDictKey();
            this.expect(TokenType.COLON);
            const value = this.parseValue();

            result[key] = value;

            if (this.peek() === TokenType.COMMA) {
                this.pos++;
            } else {
                break;
            }
        }

        this.expect(TokenType.RBRACE);
        return result;
    }

    private parseDictKey(): string {
        const token = this.current();
        switch (token.type) {
            case TokenType.STRING:
                this.pos++;
                return token.value;
            case TokenType.NUMBER:
                this.pos++;
                return token.value;
            case TokenType.TRUE:
                this.pos++;
                return 'true';
            case TokenType.FALSE:
                this.pos++;
                return 'false';
            case TokenType.NONE:
                this.pos++;
                return 'null';
            default:
                throw new Error(
                    `Invalid dict key: ${TokenType[token.type]} ('${token.value}') at position ${token.pos}`
                );
        }
    }

    private parseList(): unknown[] {
        this.expect(TokenType.LBRACKET);
        const result: unknown[] = [];

        if (this.peek() === TokenType.RBRACKET) {
            this.pos++;
            return result;
        }

        while (true) {
            // Allow trailing comma before closing bracket
            if (this.peek() === TokenType.RBRACKET) {
                break;
            }

            result.push(this.parseValue());

            if (this.peek() === TokenType.COMMA) {
                this.pos++;
            } else {
                break;
            }
        }

        this.expect(TokenType.RBRACKET);
        return result;
    }

    /**
     * Parse Python tuples as JSON arrays
     */
    private parseTuple(): unknown[] {
        this.expect(TokenType.LPAREN);
        const result: unknown[] = [];

        if (this.peek() === TokenType.RPAREN) {
            this.pos++;
            return result;
        }

        while (true) {
            // Allow trailing comma before closing paren
            if (this.peek() === TokenType.RPAREN) {
                break;
            }

            result.push(this.parseValue());

            if (this.peek() === TokenType.COMMA) {
                this.pos++;
            } else {
                break;
            }
        }

        this.expect(TokenType.RPAREN);
        return result;
    }
}

/**
 * Convert a Python dict string to a formatted JSON string.
 *
 * @param input - Python dict as a string
 * @param indent - Number of spaces for indentation (default: 4, like JSON Tools)
 * @returns Formatted JSON string
 */
export function pythonDictToJson(input: string, indent: number = 4): string {
    const trimmed = input.trim();
    if (!trimmed) {
        throw new Error('Input is empty');
    }

    const lexer = new PythonDictLexer(trimmed);
    const tokens = lexer.tokenize();
    const parser = new PythonDictParser(tokens);
    const result = parser.parse();

    return JSON.stringify(result, null, indent);
}

/**
 * Format an existing JSON string with proper indentation.
 *
 * @param input - JSON string
 * @param indent - Number of spaces for indentation (default: 4)
 * @returns Formatted JSON string
 */
export function formatJson(input: string, indent: number = 4): string {
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed, null, indent);
}

/**
 * Minify a JSON string (remove all whitespace).
 *
 * @param input - JSON string
 * @returns Minified JSON string
 */
export function minifyJson(input: string): string {
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed);
}
