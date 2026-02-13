import * as vscode from 'vscode';
import { pythonDictToJson, formatJson, minifyJson } from './pythonDictParser';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "dict2json" is now active!');

	// Command 1: Convert Python dict to formatted JSON
	const convertCommand = vscode.commands.registerCommand('dict2json.convert', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('No active editor found.');
			return;
		}

		const document = editor.document;
		const selection = editor.selection;
		const indent = getIndentSize();

		// Use selection if there is one, otherwise use the entire document
		const text = selection.isEmpty
			? document.getText()
			: document.getText(selection);

		if (!text.trim()) {
			vscode.window.showWarningMessage('No text to convert.');
			return;
		}

		try {
			const json = pythonDictToJson(text, indent);
			await applyEdit(editor, selection, json);
			vscode.window.showInformationMessage('Python dict converted to JSON successfully.');
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Failed to convert: ${message}`);
		}
	});

	// Command 2: Format JSON (pretty print)
	const formatCommand = vscode.commands.registerCommand('dict2json.formatJson', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('No active editor found.');
			return;
		}

		const document = editor.document;
		const selection = editor.selection;
		const indent = getIndentSize();

		const text = selection.isEmpty
			? document.getText()
			: document.getText(selection);

		if (!text.trim()) {
			vscode.window.showWarningMessage('No text to format.');
			return;
		}

		try {
			const json = formatJson(text, indent);
			await applyEdit(editor, selection, json);
			vscode.window.showInformationMessage('JSON formatted successfully.');
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Failed to format JSON: ${message}`);
		}
	});

	// Command 3: Minify JSON
	const minifyCommand = vscode.commands.registerCommand('dict2json.minifyJson', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('No active editor found.');
			return;
		}

		const document = editor.document;
		const selection = editor.selection;

		const text = selection.isEmpty
			? document.getText()
			: document.getText(selection);

		if (!text.trim()) {
			vscode.window.showWarningMessage('No text to minify.');
			return;
		}

		try {
			const json = minifyJson(text);
			await applyEdit(editor, selection, json);
			vscode.window.showInformationMessage('JSON minified successfully.');
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Failed to minify JSON: ${message}`);
		}
	});

	context.subscriptions.push(convertCommand, formatCommand, minifyCommand);
}

/**
 * Apply the result text to the editor, replacing either the selection or the entire document.
 */
async function applyEdit(
	editor: vscode.TextEditor,
	selection: vscode.Selection,
	newText: string
): Promise<void> {
	const range = selection.isEmpty
		? new vscode.Range(
			editor.document.positionAt(0),
			editor.document.positionAt(editor.document.getText().length)
		)
		: new vscode.Range(selection.start, selection.end);

	await editor.edit((editBuilder) => {
		editBuilder.replace(range, newText);
	});
}

/**
 * Get the configured indent size from VS Code settings,
 * defaulting to 4 (matching JSON Tools behavior).
 */
function getIndentSize(): number {
	const config = vscode.workspace.getConfiguration('dict2json');
	return config.get<number>('indentSize', 4);
}

export function deactivate() {}
