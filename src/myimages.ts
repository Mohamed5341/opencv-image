import * as vscode from 'vscode';
import * as Jimp from 'jimp';
import * as cv from '@techstark/opencv-js';
import * as fs from 'fs';

export class MyImagesHandler{
    savingLocation: vscode.Uri;
    imagesList: MyImage[] = [];

    constructor(path: vscode.Uri){
        this.savingLocation = path;
    }

    async addImage(varName: string, varRef: number, showImage: boolean, showMat: boolean){
        const session = vscode.debug.activeDebugSession;
        if(session){
            const response = await session.customRequest('variables', {variablesReference: varRef});
            const currentImg = new MyImage(response, this.savingLocation, varName, varRef);

            if(currentImg.valid){
                const loc = this.checkImageExists(currentImg);
    
                if(loc === -1){
                    this.imagesList.push(currentImg);
                }else{
                    this.imagesList[loc] = currentImg;
                }
    
                await currentImg.readImageFromMemory(showImage, showMat);
            }else{
                vscode.window.showWarningMessage("Please Initialize variable.");
            }

        }
    }

    async deleteAllImages(){
        for(var i = 0; i < this.imagesList.length; i++){
            this.imagesList[i].deleteImage();
        }
    }

    private checkImageExists(img: MyImage): number{
        var location: number = -1;
        for(var i = 0; i < this.imagesList.length; i++){
            if(this.imagesList[i].variableName === img.variableName){
                location = i;
            }
        }

        return location;
    }
    
}

class MyImage{
    type: any = cv.CV_8U;
    flags: number = 0;
    dims: number = 0;
    cols: number = 0;
    rows: number = 0;
    startAddress: string = "";
    endAddress: string = "";
    imagePath!: vscode.Uri;
    imageSaved: boolean = false;
    variableName: string = "";
    valid: boolean = false;
    numberOfChannels: number = 0;
    elementSize: number = 0;
    signed: boolean = false;
    isFloat: boolean = false;


    constructor(response: any, folderPath: vscode.Uri, varname: string, varRef: number){
        if("variables" in response){
            const varVal = response.variables;

            varVal.forEach(async (element: any) => {
                const name = element.name;
                switch (name) {
                    case 'flags':
                        this.flags = parseInt(element.value);
                        break;
                    case 'dims':
                        this.dims = parseInt(element.value);
                        break;
                    case 'rows':
                        this.rows = parseInt(element.value);
                        break;
                    case 'cols':
                        this.cols = parseInt(element.value);
                        break;
                    case 'datastart':
                        this.startAddress = this.getHexFromString(element.value);
                        break;
                    case 'dataend':
                        this.endAddress = this.getHexFromString(element.value);
                        break;
                    default:
                        break;
                }
            });

            this.imagePath = vscode.Uri.joinPath(folderPath, varname + "_" + varRef + ".jpg");

            this.variableName = varname + "_" + varRef;

            this.type = this.flags&0xFFF;
            if(this.dims !== 0 && this.cols !== 0 && this.rows !== 0){
                this.valid = true;


                if(this.type === cv.CV_8U || this.type === cv.CV_8UC1 || this.type === cv.CV_8UC2 || this.type === cv.CV_8UC3 || this.type === cv.CV_8UC4){
                    this.elementSize = 1;
                    this.signed = false;
                    this.isFloat = false;
                }else if(this.type === cv.CV_8S || this.type === cv.CV_8SC1 || this.type === cv.CV_8SC2 || this.type === cv.CV_8SC3 || this.type === cv.CV_8SC4){
                    this.elementSize = 1;
                    this.signed = true;
                    this.isFloat = false;
                }else if(this.type === cv.CV_16U || this.type === cv.CV_16UC1 || this.type === cv.CV_16UC2 || this.type === cv.CV_16UC3 || this.type === cv.CV_16UC4){
                    this.elementSize = 2;
                    this.signed = false;
                    this.isFloat = false;
                }else if(this.type === cv.CV_16S || this.type === cv.CV_16SC1 || this.type === cv.CV_16SC2 || this.type === cv.CV_16SC3 || this.type === cv.CV_16SC4){
                    this.elementSize = 2;
                    this.signed = true;
                    this.isFloat = false;
                }else if(this.type === cv.CV_32S || this.type === cv.CV_32SC1 || this.type === cv.CV_32SC2 || this.type === cv.CV_32SC3 || this.type === cv.CV_32SC4){
                    this.elementSize = 4;
                    this.signed = true;
                    this.isFloat = false;
                }else if(this.type === cv.CV_32F || this.type === cv.CV_32FC1 || this.type === cv.CV_32FC2 || this.type === cv.CV_32FC3 || this.type === cv.CV_32FC4){
                    this.elementSize = 4;
                    this.signed = true;
                    this.isFloat = true;
                }else if(this.type === cv.CV_64F || this.type === cv.CV_64FC1 || this.type === cv.CV_64FC2 || this.type === cv.CV_64FC3 || this.type === cv.CV_64FC4){
                    this.elementSize = 8;
                    this.signed = true;
                    this.isFloat = true;
                }

                const numberOfBytes: number = parseInt(this.endAddress) - parseInt(this.startAddress);
                if(this.elementSize !== 0){
                    this.numberOfChannels = numberOfBytes/(this.cols*this.rows*this.elementSize);
                }
                return;
            }
            
        }
    }

    async readImageFromMemory(viewImage: boolean, viewMat: boolean){
        const session = vscode.debug.activeDebugSession;

        if(session){
            try{
                const numberOfBytes: number = parseInt(this.endAddress) - parseInt(this.startAddress);
                const response = await session.customRequest('readMemory', {memoryReference: this.startAddress, offset: 0, count: numberOfBytes});
                let imageArray: number[] = this.decodeImage(response.data);
                
    
                if(viewImage && viewMat){
                    let imageSrc = cv.matFromArray(this.rows, this.cols, this.type, imageArray);
                    if(this.numberOfChannels === 1){
                        cv.cvtColor(imageSrc, imageSrc, cv.COLOR_GRAY2RGB);
                    }
                    new Jimp({width: this.cols, height: this.rows, data: Buffer.from(imageSrc.data)}).write(this.imagePath.fsPath);
                    imageSrc.delete();
                    this.imageSaved = true;

                    const panel = vscode.window.createWebviewPanel("imageMat", this.variableName, vscode.ViewColumn.Two);
                    panel.webview.html = this.getHtml(panel.webview.asWebviewUri(this.imagePath), imageArray, true);
                }else if(viewImage){
                    let imageSrc = cv.matFromArray(this.rows, this.cols, this.type, imageArray);
                    if(this.numberOfChannels === 1){
                        cv.cvtColor(imageSrc, imageSrc, cv.COLOR_GRAY2RGB);
                    }
                    new Jimp({width: this.cols, height: this.rows, data: Buffer.from(imageSrc.data)}).write(this.imagePath.fsPath);
                    this.imageSaved = true;
                    this.showImage();
                    imageSrc.delete();
                }else if(viewMat){
                    const panel = vscode.window.createWebviewPanel("imageMat", this.variableName, vscode.ViewColumn.Two);
                    panel.webview.html = this.getHtml(panel.webview.asWebviewUri(this.imagePath), imageArray, false);
                }
            }catch(e: any){
                vscode.window.showErrorMessage("Error Handling image" + e);
            }
        }
    }

    private getHtml(imgUri: vscode.Uri, dataBuffer: number[], showImage: boolean): string{
        let tablesString = "";
        
        tablesString += "<table><thead><tr><th>#</th><th>" + Array.from({length: this.cols}, (value, index) => index).join("</th><th>") + "</th></tr></thead><tbody>";
        
        for(var j = 0; j < this.rows; j++){
            
            const currentRawStartIndex = j*this.cols;
            const currentRawEndIndex = currentRawStartIndex + this.cols*this.numberOfChannels;
            let rowElements = [];
            for(var i = currentRawStartIndex; i < currentRawEndIndex; i += this.numberOfChannels){
                rowElements.push(dataBuffer.slice(i, i+this.numberOfChannels).join(','));
            }
            tablesString += '<tr><th>' + j + '</th><td>' + rowElements.join("</td><td>") + "</td></tr>";
        }

        tablesString += "</tbody></table>";
        //vscode.debug.activeDebugConsole.appendLine();
    
        let imageTag = "";
        if(showImage){
            imageTag = `<h1>Image</h1><img src="${imgUri}"/>`;
        }

        let result = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Display image matrix</title>
            <style>
                table {
                    font-size: 125%;
                    white-space: nowrap;
                    margin: 0;
                    border: none;
                    border-collapse: separate;
                    border-spacing: 0;
                    table-layout: fixed;
                    border: 1px solid black;
                }
                table td,
                table th {
                    border: 1px solid black;
                    padding: 0.5rem 1rem;
                }
                table thead th {
                    padding: 3px;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    width: 25vw;
                    background: white;
                }
                table td {
                    background: #fff;
                    padding: 4px 5px;
                    text-align: center;
                }
                
                table tbody th {
                    font-weight: 100;
                    font-style: italic;
                    text-align: left;
                    position: relative;
                }
                table thead th:first-child {
                    position: sticky;
                    left: 0;
                    z-index: 2;
                }
                table tbody th {
                    position: sticky;
                    left: 0;
                    background: white;
                    z-index: 1;
                }
            </style>
        </head>
        <body>
            ${imageTag}
            <h1>Image Matrix</h1>
            <p style="font-size:160%;">Image is ${this.rows}x${this.cols}x${this.numberOfChannels}</p>
            ${tablesString}
        </body>
        </html>`;

        return result;
    }


    private decodeImage(responseBuffer: string): number[]{
        let initialized = false;
        let result: number[] = new Array<number>(this.numberOfChannels*this.rows*this.cols).fill(0);
        let inputBuffer = Buffer.from(responseBuffer, 'base64');

        if(this.isFloat){
            if(this.elementSize === 4){
                for(var i = 0; i < result.length; i++){
                    result[i] = inputBuffer.readFloatLE(i*this.elementSize);
                }
                initialized = true;
            }else if(this.elementSize === 8){
                for(var i = 0; i < result.length; i++){
                    result[i] = inputBuffer.readDoubleLE(i*this.elementSize);
                }
                initialized = true;
            }
        }else
        {
            if(this.signed){
                for(var i = 0; i < result.length; i++){
                    result[i] = inputBuffer.readIntLE(i*this.elementSize, this.elementSize);
                }
                initialized = true;
            }else{
                for(var i = 0; i < result.length; i++){
                    result[i] = inputBuffer.readUIntLE(i*this.elementSize, this.elementSize);
                }
                initialized = true;
            }
        }

        if(initialized){
            return result;
        }
        return [];
    }

    private getHexFromString(str: string): string{
        let result = "";
        const hexChars = "0123456789ABCDEFabcdef";

        if(str.charAt(0) === '0' && str.charAt(1).toLowerCase() === 'x'){
            result = "0x";
            for(var i = 2; i < str.length; i++){
                if(hexChars.includes(str.charAt(i))){
                    result += str.charAt(i);
                }else{
                    break;
                }
            }
        }else{
            result = "0x00";
        }

        return result;
    }

    showImage(){
        vscode.commands.executeCommand('vscode.open', this.imagePath, {viewColumn: vscode.ViewColumn.Two, preview: false});
    }

    deleteImage(){
        try{
            if(fs.existsSync(this.imagePath.fsPath)){
                vscode.workspace.fs.delete(this.imagePath);
            }
        }catch{

        }
    }
}

