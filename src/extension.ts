import * as vscode from 'vscode';
import {MyImagesHandler} from "./myimages";

export function activate(context: vscode.ExtensionContext) {

	let imagesHandler = new MyImagesHandler(vscode.workspace.workspaceFolders[0].uri);

	let variableCmd = vscode.commands.registerCommand('opencv-image.imagevariable', async (variableObject) =>{
		// Variable is clicked
		const varName = variableObject.variable.name; 
		const varref = variableObject.variable.variablesReference;
		
		imagesHandler.addImage(varName, varref);
	});

	vscode.debug.onDidTerminateDebugSession(e => {
		imagesHandler.deleteAllImages();
	});

	context.subscriptions.push(variableCmd);
}

// This method is called when your extension is deactivated
export function deactivate() {}
