import * as vscode from 'vscode';
import {MyImagesHandler} from "./myimages";

export function activate(context: vscode.ExtensionContext) {

	var folderUri!: vscode.Uri;

	if(vscode.workspace.workspaceFolders){
		folderUri = vscode.workspace.workspaceFolders[0].uri;
	}

	let imagesHandler = new MyImagesHandler(folderUri);

	let variableCmd = vscode.commands.registerCommand('opencv-image.imagevariable', async (variableObject) =>{
		// Variable is clicked
		const varName = variableObject.variable.name; 
		const varref = variableObject.variable.variablesReference;
		
		vscode.debug.activeDebugConsole.appendLine("*************************************************************");
		vscode.debug.activeDebugConsole.appendLine("Selected variable is: " + variableObject + " with name " + varName);

		imagesHandler.addImage(varName, varref);
	});

	vscode.debug.onDidTerminateDebugSession(e => {
		vscode.debug.activeDebugConsole.appendLine("debugging is terminated");
		imagesHandler.deleteAllImages();
	});

	context.subscriptions.push(variableCmd);
}

// This method is called when your extension is deactivated
export function deactivate() {}
