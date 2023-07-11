import * as vscode from 'vscode';
import {MyImagesHandler} from "./myimages";
import * as cv from '@techstark/opencv-js';

export function activate(context: vscode.ExtensionContext) {
	try{
		printToConsole("Loading OpenCV library");
		cv.onRuntimeInitialized;
		var folderUri!: vscode.Uri;
	
		if(vscode.workspace.workspaceFolders){
			folderUri = vscode.workspace.workspaceFolders[0].uri;
			printToConsole("Workspace folder URI is: " + folderUri);
		}
	
		let imagesHandler = new MyImagesHandler(folderUri);
		printToConsole("Created Image Handeler");
	
		let variableCmd = vscode.commands.registerCommand('opencv-image.image', async (variableObject) =>{
			// Variable is clicked
			const varName = variableObject.variable.name; 
			const varref = variableObject.variable.variablesReference;
			printToConsole("You clicked show image on variable: " + varName);
			printToConsole("Start adding " + varName + "to images list");
			
			imagesHandler.addImage(varName, varref, true, false);
		});
	
		let variableCmd2 = vscode.commands.registerCommand('opencv-image.imageandmatrix', async (variableObject) =>{
			const varName = variableObject.variable.name; 
			const varref = variableObject.variable.variablesReference;
			printToConsole("You clicked show image and matrix on variable: " + varName);
			printToConsole("Start adding " + varName + "to images list");
			
			imagesHandler.addImage(varName, varref, true, true);
		});
	
		let variableCmd3 = vscode.commands.registerCommand('opencv-image.matrix', async (variableObject) =>{
			const varName = variableObject.variable.name; 
			const varref = variableObject.variable.variablesReference;
			printToConsole("You clicked show matrix on variable: " + varName);
			printToConsole("Start adding " + varName + "to images list");
			
			imagesHandler.addImage(varName, varref, false, true);
		});
	
		vscode.debug.onDidTerminateDebugSession(e => {
			printToConsole("Ending debug session");
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

export function printToConsole(s: string){
	let extSettings: any = vscode.workspace.getConfiguration().get("conf.settingsEditor.debugSettings");
	if(extSettings.prop1){
		vscode.debug.activeDebugConsole.appendLine(s);
	}
}