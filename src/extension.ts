import * as vscode from 'vscode';
import {MyImagesHandler} from "./myimages";
import * as cv from '@techstark/opencv-js';

export function activate(context: vscode.ExtensionContext) {
	try{
		cv.onRuntimeInitialized;
		var folderUri!: vscode.Uri;
	
		if(vscode.workspace.workspaceFolders){
			folderUri = vscode.workspace.workspaceFolders[0].uri;
		}
	
		let imagesHandler = new MyImagesHandler(folderUri);
	
		let variableCmd = vscode.commands.registerCommand('opencv-image.image', async (variableObject) =>{
			// Variable is clicked
			const varName = variableObject.variable.name; 
			const varref = variableObject.variable.variablesReference;
			
			imagesHandler.addImage(varName, varref, true, false);
		});
	
		let variableCmd2 = vscode.commands.registerCommand('opencv-image.imageandmatrix', async (variableObject) =>{
			const varName = variableObject.variable.name; 
			const varref = variableObject.variable.variablesReference;
			
			imagesHandler.addImage(varName, varref, true, true);
		});
	
		let variableCmd3 = vscode.commands.registerCommand('opencv-image.matrix', async (variableObject) =>{
			const varName = variableObject.variable.name; 
			const varref = variableObject.variable.variablesReference;
			
			imagesHandler.addImage(varName, varref, false, true);
		});
	
		vscode.debug.onDidTerminateDebugSession(e => {
			imagesHandler.deleteAllImages();
		});
	
		context.subscriptions.push(variableCmd);
		context.subscriptions.push(variableCmd2);
		context.subscriptions.push(variableCmd3);
	}catch{
		vscode.window.showErrorMessage("Couldnt activate Extension");
	}

}

// This method is called when your extension is deactivated
export function deactivate() {}
