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
		
		imagesHandler.addImage(varName, varref, false);
	});

	let variableCmd2 = vscode.commands.registerCommand('opencv-image.imagematrix', async (variableObject) =>{
		const varName = variableObject.variable.name; 
		const varref = variableObject.variable.variablesReference;
		
		imagesHandler.addImage(varName, varref, true);
	});

	vscode.debug.onDidTerminateDebugSession(e => {
		imagesHandler.deleteAllImages();
	});

	context.subscriptions.push(variableCmd);
	context.subscriptions.push(variableCmd2);
}

// This method is called when your extension is deactivated
export function deactivate() {}
